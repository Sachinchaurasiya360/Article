#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
medium-publish.py

Pushes a prepared `.medium.md` file into the Medium editor as a DRAFT (default)
using a real, logged-in browser (Playwright). No Medium API token is needed —
Medium shut the API down for new users in 2025, so this drives the editor the
same way you would by hand, but in one command.

How it works:
  1. Reads the markdown, pulls the first `# Heading` out as the post title.
  2. Rewrites local image paths (e.g. medium-assets/.../diagram-0.png) into
     absolute URLs on your live site so Medium can fetch & re-host them.
  3. Converts the body to HTML and pastes it into a fresh Medium story.
  4. Leaves it as an unpublished draft for you to review (or --publish to go live).

First run only: a browser window opens. Log into Medium once. Your session is
saved to a local profile folder, so every run after that is fully automatic.

Usage:
  python tools/medium-publish.py RAG/rag-deep-dive-part-0.medium.md
  python tools/medium-publish.py RAG/rag-deep-dive-part-0.medium.md --publish
  python tools/medium-publish.py <file> --base-url https://your.site --keep-open

Flags:
  --publish        Publish immediately instead of saving a draft (experimental).
  --base-url URL   Override the site base used for image URLs.
  --profile DIR    Browser profile dir (default: tools/.medium-profile).
  --keep-open      Leave the browser open after finishing so you can inspect.
  --headless       Run without a visible window (only works once logged in).

Requirements:
  pip install playwright markdown
  python -m playwright install chromium
"""

import re
import time
import argparse
from pathlib import Path

# Live site base. medium-assets PNGs are committed to the repo and served here,
# so Medium can fetch them when the HTML is pasted.
DEFAULT_BASE_URL = "https://blog.sachinchaurasiya.xyz"

REPO_ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# Markdown -> (title, html)
# ---------------------------------------------------------------------------

def extract_title(md: str):
    """Pull the first level-1 heading out to use as the Medium post title."""
    lines = md.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r'^#\s+(.+?)\s*$', line)
        if m:
            title = m.group(1).strip()
            del lines[i]
            return title, "\n".join(lines)
    return "Untitled", md


def absolute_image_base(src: Path, base_url: str) -> str:
    """Base URL for resolving folder-relative image paths in this file."""
    base_url = base_url.rstrip("/")
    try:
        folder_rel = src.parent.relative_to(REPO_ROOT).as_posix()
    except ValueError:
        folder_rel = ""
    return f"{base_url}/{folder_rel}".rstrip("/")


def rewrite_image_urls(md: str, img_base: str) -> str:
    """Turn local image refs into absolute URLs; leave http(s) refs untouched."""
    def repl(m):
        alt, url = m.group(1), m.group(2).strip()
        if url.startswith(("http://", "https://", "data:")):
            return m.group(0)
        url = url.lstrip("./")
        return f'![{alt}]({img_base}/{url})'
    return re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', repl, md)


def markdown_to_html(body_md: str) -> str:
    try:
        import markdown
    except ImportError:
        print("  markdown not installed:  pip install markdown")
        sys.exit(1)
    return markdown.markdown(
        body_md,
        extensions=["extra", "fenced_code", "tables", "sane_lists", "nl2br"],
    )


# ---------------------------------------------------------------------------
# Browser automation
# ---------------------------------------------------------------------------

# Candidate selectors for Medium's editor (Medium changes these occasionally;
# the first visible match wins).
TITLE_SELECTORS = [
    'h3[data-testid="editor-titleParagraph"]',
    'h3.graf--title',
    'div[aria-label="Post Title"]',
    'div[aria-label="Title"]',
]
BODY_SELECTORS = [
    'div[data-testid="editor-bodyParagraph"]',
    'p[data-testid="editor-bodyParagraph"]',
    'div.section-inner p',
    'div[aria-label="Post Body"]',
]


def first_visible(page, selectors, timeout=15000):
    """Return the first selector whose element is visible, else None."""
    deadline = time.time() + timeout / 1000
    while time.time() < deadline:
        for sel in selectors:
            loc = page.locator(sel).first
            try:
                if loc.is_visible():
                    return loc
            except Exception:
                pass
        page.wait_for_timeout(300)
    return None


def is_logged_in(page) -> bool:
    """Heuristic: the new-story editor only renders for authenticated users."""
    return first_visible(page, TITLE_SELECTORS, timeout=6000) is not None


def paste_html(page, html: str):
    """Put HTML on the clipboard and paste it into the focused editor."""
    page.evaluate(
        """async (html) => {
            const item = new ClipboardItem({
                'text/html':  new Blob([html], {type: 'text/html'}),
                'text/plain': new Blob([html], {type: 'text/plain'}),
            });
            await navigator.clipboard.write([item]);
        }""",
        html,
    )
    page.keyboard.press("Control+v")


# JS injected before any page script runs — erases the automation fingerprints
# Cloudflare looks for (navigator.webdriver, missing plugins/languages, etc.).
STEALTH_INIT = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
Object.defineProperty(navigator, 'plugins',   {get: () => [1, 2, 3, 4, 5]});
window.chrome = window.chrome || {runtime: {}};
const _q = navigator.permissions && navigator.permissions.query;
if (_q) {
  navigator.permissions.query = (p) =>
    p && p.name === 'notifications'
      ? Promise.resolve({state: Notification.permission})
      : _q(p);
}
"""

# Args/flags that strip the "controlled by automated software" signals.
STEALTH_ARGS = [
    "--start-maximized",
    "--disable-blink-features=AutomationControlled",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-infobars",
]
IGNORE_DEFAULT_ARGS = ["--enable-automation"]

REAL_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
)

CF_MARKERS = ("just a moment", "checking your browser", "verify you are human",
              "needs to review the security", "cf-chl", "challenge-platform")


def default_chrome_user_data() -> Path:
    """Location of the system Chrome 'User Data' folder for the current OS."""
    import os
    if sys.platform.startswith("win"):
        base = os.environ.get("LOCALAPPDATA", "")
        return Path(base) / "Google" / "Chrome" / "User Data"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Google" / "Chrome"
    return Path.home() / ".config" / "google-chrome"


def _is_profile_locked_error(e: Exception) -> bool:
    msg = str(e).lower()
    return any(s in msg for s in (
        "processsingleton", "profile appears to be in use",
        "failed to create", "cannot create a file when", "already in use",
    ))


# Cache/transient subfolders not worth copying when cloning a profile, plus the
# lock files that would otherwise re-trigger a ProcessSingleton conflict.
_CACHE_DIRS = {
    "Cache", "Code Cache", "GPUCache", "DawnCache", "DawnGraphiteCache",
    "DawnWebGPUCache", "GraphiteDawnCache", "GrShaderCache", "ShaderCache",
    "Service Worker", "Crashpad", "component_crx_cache", "extensions_crx_cache",
    "Download Service", "optimization_guide_model_store",
}
_SINGLETON_FILES = {"SingletonLock", "SingletonCookie", "SingletonSocket", "lockfile"}


def _safe_copytree(src: Path, dst: Path):
    """Recursive copy that skips caches/lock files and ignores locked files."""
    import shutil
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        if item.name in _SINGLETON_FILES:
            continue
        if item.is_dir():
            if item.name in _CACHE_DIRS:
                continue
            _safe_copytree(item, dst / item.name)
        else:
            try:
                shutil.copy2(item, dst / item.name)
            except Exception:
                pass  # file held open by a running Chrome — skip it


def seed_system_profile(data_dir: Path, profile: str, dest: Path):
    """Clone a real Chrome profile into `dest` so Chrome 136+ allows CDP there.

    Chrome refuses remote debugging on the default user-data dir (a security
    change in Chrome 136). Driving a *copy* in a non-default dir is the supported
    workaround; the copy carries your cookies, so the Medium login and any
    Cloudflare clearance come with it.
    """
    import shutil
    src_prof = data_dir / profile
    if not src_prof.exists():
        avail = [d.name for d in data_dir.iterdir()
                 if d.is_dir() and (d.name == "Default" or d.name.startswith("Profile"))]
        print(f"  Profile '{profile}' not found in {data_dir}")
        print(f"  Available profiles: {', '.join(avail) or '(none)'}")
        print("  Pick one with --chrome-profile (see chrome://version → Profile Path).")
        sys.exit(1)

    if dest.exists():
        shutil.rmtree(dest, ignore_errors=True)
    dest.mkdir(parents=True, exist_ok=True)

    # 'Local State' (at the User Data root) holds the DPAPI-wrapped key Chrome
    # uses to decrypt cookies — it MUST travel with the copy or login is lost.
    try:
        shutil.copy2(data_dir / "Local State", dest / "Local State")
    except Exception as e:
        print(f"  (warning: couldn't copy Local State — login may not carry: {e})")

    print(f"  Cloning profile '{profile}' (carries your login)…")
    _safe_copytree(src_prof, dest / profile)
    print(f"  Clone ready: {dest}")


def launch_context(p, profile_dir: Path, headless: bool, system_profile=None):
    """Persistent context that looks like a normal hand-driven browser.

    With system_profile set, drives your *real* Chrome profile (where you're
    already a trusted, logged-in human) — the most reliable way past Cloudflare.
    Otherwise prefers real installed Chrome and falls back to bundled Chromium.

    system_profile: {"data_dir": Path, "profile": str} or None.
    """
    # chromium_sandbox=True keeps the OS sandbox ON, which removes Playwright's
    # default --no-sandbox flag (that flag triggers Chrome's "unsupported flag"
    # warning bar and is itself a bot signal).
    opts = dict(
        headless=headless,
        ignore_default_args=IGNORE_DEFAULT_ARGS,
        permissions=["clipboard-read", "clipboard-write"],
        viewport=None,
        chromium_sandbox=True,
    )

    if system_profile:
        data_dir = Path(system_profile["data_dir"])
        prof = system_profile.get("profile", "Default")
        clone = Path(system_profile["clone_dir"])
        refresh = system_profile.get("refresh", False)
        if not data_dir.exists():
            print(f"  Chrome user-data dir not found: {data_dir}")
            print("  Pass the correct path with --chrome-user-data.")
            sys.exit(1)

        # Chrome 136+ ignores the debugging pipe on the *default* dir, so we
        # drive a copy in a dedicated dir. Seed it on first use or --refresh.
        if refresh or not (clone / prof).exists():
            seed_system_profile(data_dir, prof, clone)
        else:
            print(f"  Reusing existing profile clone (use --refresh-profile to re-pull login).")

        print(f"  Browser     : real Chrome — clone of system profile '{prof}'")
        print(f"  Profile copy: {clone}")
        # No user_agent override: let real Chrome send its native UA so it
        # matches the TLS fingerprint of the actual binary.
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(clone),
            channel="chrome",
            args=STEALTH_ARGS + [f"--profile-directory={prof}"],
            **opts,
        )
        ctx.add_init_script(STEALTH_INIT)
        return ctx

    opts["args"] = STEALTH_ARGS
    for channel in ("chrome", None):
        try:
            if channel:  # real Chrome: native UA matches the binary
                ctx = p.chromium.launch_persistent_context(
                    user_data_dir=str(profile_dir), channel=channel, **opts)
            else:        # bundled Chromium: spoof a real-Chrome UA
                ctx = p.chromium.launch_persistent_context(
                    user_data_dir=str(profile_dir), user_agent=REAL_UA, **opts)
            print(f"  Browser     : {'real Chrome' if channel else 'bundled Chromium'}")
            ctx.add_init_script(STEALTH_INIT)
            return ctx
        except Exception as e:
            if channel:
                print(f"  (real Chrome not available: {str(e).splitlines()[0]}; "
                      f"falling back to Chromium)")
            else:
                raise


def wait_through_cloudflare(page, headless: bool):
    """If a Cloudflare interstitial shows, give the user a chance to clear it."""
    def on_challenge():
        try:
            html = (page.content() or "").lower()
            title = (page.title() or "").lower()
        except Exception:
            return False
        return any(m in title or m in html for m in CF_MARKERS)

    if not on_challenge():
        return
    print("\n  ⚠ Cloudflare check detected.")
    if headless:
        print("  Cloudflare challenges can't be solved headless. Re-run WITHOUT "
              "--headless, clear it once, and the clearance cookie is saved to "
              "your profile for next time.")
        return
    print("  Complete the 'Verify you are human' checkbox in the browser window.")
    # Auto-detect clearance for up to 90s, but let the user hit ENTER too.
    for _ in range(90):
        page.wait_for_timeout(1000)
        if not on_challenge():
            print("  Cloudflare cleared. Continuing…")
            return
    input("  Press ENTER once the page has loaded past the check… ")


def open_editor(page, headless: bool):
    """Navigate the controlled tab to a new Medium story, with retries.

    Using a real profile, Chrome may restore old tabs; we drive our own fresh
    tab and make sure it actually lands on medium.com.
    """
    try:
        page.bring_to_front()
    except Exception:
        pass
    last_err = None
    for attempt in range(3):
        try:
            page.goto("https://medium.com/new-story",
                      wait_until="domcontentloaded", timeout=45000)
        except Exception as e:
            last_err = e
            print(f"  navigation retry {attempt + 1}/3: {str(e).splitlines()[0]}")
            page.wait_for_timeout(1500)
            continue
        wait_through_cloudflare(page, headless)
        if "medium.com" in (page.url or ""):
            return
        page.wait_for_timeout(1000)
    if last_err and "medium.com" not in (page.url or ""):
        print(f"  Could not reach Medium ({str(last_err).splitlines()[0]}).")


def run(md_path: str, base_url: str, profile_dir: Path,
        publish: bool, keep_open: bool, headless: bool, system_profile=None):
    from playwright.sync_api import sync_playwright

    src = Path(md_path).resolve()
    if not src.exists():
        print(f"Error: file not found: {md_path}")
        sys.exit(1)

    raw = src.read_text(encoding="utf-8")
    title, body_md = extract_title(raw)
    img_base = absolute_image_base(src, base_url)
    body_md = rewrite_image_urls(body_md, img_base)
    html = markdown_to_html(body_md)

    print(f"  Title       : {title}")
    print(f"  Image base  : {img_base}")
    print(f"  Mode        : {'PUBLISH' if publish else 'DRAFT'}")
    print(f"  Profile     : {profile_dir}")
    print("─" * 60)

    profile_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        context = launch_context(p, profile_dir, headless, system_profile)
        # Always drive a fresh tab — with a real profile, restored tabs may sit
        # at about:blank and steal pages[0].
        page = context.new_page()

        print("  Opening Medium editor…")
        open_editor(page, headless)

        if not is_logged_in(page):
            if headless:
                print("\n  Not logged in and running headless. Re-run WITHOUT "
                      "--headless once to sign in, then headless will work.")
                context.close()
                sys.exit(1)
            print("\n  ┌─────────────────────────────────────────────────────┐")
            print("  │  Not logged in yet.                                   │")
            print("  │  Log into Medium in the browser window that opened.   │")
            print("  │  (You only have to do this once.)                     │")
            print("  └─────────────────────────────────────────────────────┘")
            input("\n  Press ENTER here after you've logged in… ")
            open_editor(page, headless)
            if not is_logged_in(page):
                print("  Still can't see the editor. Aborting.")
                context.close()
                sys.exit(1)

        # --- Title ---
        title_loc = first_visible(page, TITLE_SELECTORS)
        if not title_loc:
            print("  Could not find the title field. Medium may have changed "
                  "its layout — open an issue / tweak TITLE_SELECTORS.")
            if keep_open:
                input("  Press ENTER to close the browser… ")
            context.close()
            sys.exit(1)
        title_loc.click()
        page.keyboard.type(title, delay=10)
        page.keyboard.press("Enter")
        page.wait_for_timeout(400)

        # --- Body ---
        body_loc = first_visible(page, BODY_SELECTORS, timeout=5000)
        if body_loc:
            body_loc.click()
        print("  Pasting article body…")
        paste_html(page, html)
        page.wait_for_timeout(2500)  # let Medium fetch images & autosave

        # --- Wait for autosave ---
        try:
            page.get_by_text(re.compile("Saved|Draft saved", re.I)).first.wait_for(timeout=8000)
            print("  Draft saved by Medium.")
        except Exception:
            print("  (Didn't see a 'Saved' indicator — Medium autosaves every "
                  "few seconds; the draft is almost certainly saved.)")

        draft_url = page.url
        print(f"\n  Draft URL   : {draft_url}")
        print(f"  Find it under: https://medium.com/me/stories/drafts")

        if publish:
            print("\n  --publish requested. Attempting to publish…")
            _try_publish(page)

        if keep_open:
            input("\n  Browser left open. Press ENTER here to close it… ")

        context.close()

    print("\n  Done. ✅")


def _try_publish(page):
    """Best-effort publish flow. Medium's publish UI changes often."""
    try:
        page.get_by_role("button", name=re.compile("Publish", re.I)).first.click()
        page.wait_for_timeout(1500)
        # The confirm dialog has a "Publish now" button.
        page.get_by_role("button", name=re.compile("Publish now", re.I)).first.click()
        page.wait_for_timeout(3000)
        print("  Publish clicked. Double-check the live post in your browser.")
    except Exception as e:
        print(f"  Couldn't complete auto-publish ({e}).")
        print("  The draft is saved — just click Publish manually.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    ap = argparse.ArgumentParser(add_help=True, description="Publish a .medium.md to Medium as a draft.")
    ap.add_argument("file", nargs="?", help="Path to the .medium.md (or .md) file")
    ap.add_argument("--publish", action="store_true", help="Publish live instead of saving a draft")
    ap.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Site base for image URLs")
    ap.add_argument("--profile", default=str(REPO_ROOT / "tools" / ".medium-profile"),
                    help="Browser profile directory (keeps you logged in)")
    ap.add_argument("--keep-open", action="store_true", help="Leave the browser open at the end")
    ap.add_argument("--headless", action="store_true", help="Run without a visible window")
    ap.add_argument("--use-system-profile", action="store_true",
                    help="Drive your real, everyday Chrome profile (best for beating Cloudflare). "
                         "Requires all Chrome windows closed first.")
    ap.add_argument("--chrome-profile", default="Default",
                    help="Which Chrome profile to use, e.g. 'Default' or 'Profile 1' (with --use-system-profile)")
    ap.add_argument("--chrome-user-data", default=None,
                    help="Override the Chrome 'User Data' folder path (with --use-system-profile)")
    ap.add_argument("--refresh-profile", action="store_true",
                    help="Re-copy the system profile (use if your login/clearance expired)")
    args = ap.parse_args()

    if not args.file:
        print(__doc__)
        sys.exit(0)

    system_profile = None
    if args.use_system_profile:
        data_dir = Path(args.chrome_user_data) if args.chrome_user_data else default_chrome_user_data()
        system_profile = {
            "data_dir": data_dir,
            "profile": args.chrome_profile,
            "clone_dir": str(REPO_ROOT / "tools" / ".medium-profile-system"),
            "refresh": args.refresh_profile,
        }

    run(
        md_path=args.file,
        base_url=args.base_url,
        profile_dir=Path(args.profile).resolve(),
        publish=args.publish,
        keep_open=args.keep_open,
        headless=args.headless,
        system_profile=system_profile,
    )
