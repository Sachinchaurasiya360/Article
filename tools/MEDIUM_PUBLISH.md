# Publishing to Medium (one command)

Medium shut its public API down for new users in 2025 (no new integration
tokens), so we drive the real editor in a logged-in browser instead. No token
needed.

## One-click

```powershell
./tools/post-to-medium.ps1 RAG/rag-deep-dive-part-0.md
```

This does two things:

1. **`medium-prep.py`** — converts mermaid diagrams and markdown tables to PNGs
   and writes `RAG/rag-deep-dive-part-0.medium.md`.
2. **`medium-publish.py`** — opens Medium, pastes the article, and leaves it as a
   **draft** for you to review.

### First run only

A browser window opens. Log into Medium once. Your session is saved to
`tools/.medium-profile/` (gitignored), so every run after that is automatic.

## Options

```powershell
./tools/post-to-medium.ps1 RAG/rag-deep-dive-part-0.md -Publish    # go live instead of draft
./tools/post-to-medium.ps1 RAG/rag-deep-dive-part-0.md -KeepOpen   # keep browser open to inspect
./tools/post-to-medium.ps1 RAG/rag-deep-dive-part-0.medium.md -SkipPrep   # already prepped
```

Or call the publisher directly:

```powershell
python tools/medium-publish.py RAG/rag-deep-dive-part-0.medium.md
python tools/medium-publish.py <file> --base-url https://blog.sachinchaurasiya.xyz --keep-open
```

## How images work

The PNGs live in the repo and are served from the live site
(`https://blog.sachinchaurasiya.xyz/...`). The publisher rewrites local image
paths to those absolute URLs; Medium fetches and re-hosts them when the article
is pasted. **So push/deploy the article (and its `medium-assets/`) before
publishing**, otherwise the images 404 in the draft.

## Requirements

```bash
pip install playwright markdown requests
python -m playwright install chromium
```

## Cloudflare / "verify you are human"

The publisher drives your **real installed Chrome** (not bundled Chromium) and
strips the usual automation fingerprints, so Cloudflare normally lets it
through. If a check still appears, the script pauses — just tick the checkbox in
the window once. The clearance cookie is saved in `tools/.medium-profile/`, so
later runs skip it. (Challenges can't be cleared with `--headless`; clear it
once in a visible window first.)

### If Cloudflare still blocks: clone your real Chrome profile

The surest way past Cloudflare is to reuse the Chrome profile you actually
browse with — you're already a trusted, logged-in human there:

```powershell
# Close ALL Chrome windows first, then:
./tools/post-to-medium.ps1 RAG/rag-deep-dive-part-0.medium.md -SkipPrep -SystemProfile
```

**Why it copies your profile instead of using it directly:** Chrome 136+ (you're
on 149) refuses remote debugging — which Playwright needs — on the *default*
profile directory, as an anti-malware measure. So the tool **copies** your
chosen profile into `tools/.medium-profile-system/` (a non-default dir Chrome
allows) and drives that. The copy includes your cookies, so your Medium login
and Cloudflare clearance come along.

- **Close Chrome fully before the first run** so cookies copy cleanly. The
  wrapper warns you and can force-close it. (Only needed when it's copying —
  i.e. the first run or `-RefreshProfile`.)
- It clones the `Default` profile. For another profile:
  `-SystemProfile -ChromeProfile "Profile 1"` (find yours at `chrome://version`
  → **Profile Path**).
- The copy happens **once**; later runs reuse the clone. If your login or
  Cloudflare clearance later expires, re-pull it with `-RefreshProfile`.
- **If the login doesn't carry** (Chrome's newer App-Bound cookie encryption can
  block a copied cookie store from decrypting): you'll just see Medium's
  login + the Cloudflare checkbox **once** in the cloned window. Clear them once
  — the clone is a real-Chrome, non-default-dir profile, so it persists and every
  later run is automatic.

## If it breaks

Medium occasionally changes its editor DOM. If the title/body can't be found,
update `TITLE_SELECTORS` / `BODY_SELECTORS` near the top of `medium-publish.py`,
or run with `--keep-open` to inspect the page.
