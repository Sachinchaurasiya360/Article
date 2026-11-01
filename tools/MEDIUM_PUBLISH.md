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

## Known issues & fixes (learned publishing Redis Part 3, Nov 2026)

Read this before every publish. Each one broke a real draft.

### Getting into Medium
- **Cloudflare blocks the Playwright-launched Chrome** (`post-to-medium.ps1` waits on
  "Verify you are human" and dies). A fresh Playwright MCP browser is also not logged in.
- **Fix: drive your already-logged-in Chrome over CDP** (browser-use). One-time setup:
  open `chrome://inspect/#remote-debugging`, enable it, and click **Allow** on the
  prompt when the agent connects.
- The tab runs in the background, so **CDP key presses (Enter, Delete, Ctrl+A,
  Backspace) do nothing in the editor**, even with focus emulation. Don't rely on
  keystrokes. Use JS selection ranges + synthetic `paste` events for everything.
- **Grammarly** injects into the editor and garbled typed text (the title landed in
  the body placeholder). Paste-based input avoids it; disabling Grammarly on
  medium.com makes it safer still.

### Title
- Typing the title, or pasting `<h1>` with the body, loses it (it ends up as a body
  line or below an empty title row). **Fix:** put the selection inside
  `h3[data-testid=editorTitleParagraph]` and dispatch a `paste` with **text/plain**
  title only. Then move the selection to the body `p.graf--p` and paste the body.
- Strip doubled spaces from the title (the em-dash removal leaves `Series  Part`).

### Numbered lists (the "numbering is wrong" bug)
- Python-Markdown wraps items of *loose* lists (blank line between items) in `<p>`
  with newlines around them. **Medium turns that whitespace into empty numbered
  items**, so 4 items show as 1, 2(empty), 3… (seen in "jemalloc Architecture").
  **Fix:** unwrap `<p>` inside `<li>` and drop whitespace text nodes in `<ol>/<ul>`.
- A list split by a code block or sub-bullets **restarts at 1** in Medium (it ignores
  `start=`). E.g. "4. Set rdb-del-sync-files" showed as "1.". **Fix:** render lists
  with `start != 1` or nested lists as paragraphs with a literal `N. ` prefix.
- Medium has no nested lists; 3-space-indented sub-bullets become a separate `<ul>`.

### Images and paste order
- Pasting the whole article at once truncates after the first image (already handled
  by chunking at `<img>`).
- **After an image is pasted, the caret sits in the image caption.** The next chunk
  then becomes the caption (13 headings like "Key concepts:" turned into captions).
- Pasting `<img>` + the following text as one chunk fixes captions, **but the caret
  then stays above that content, so later chunks land above earlier ones** (sections
  came out in reverse order).
- **Working recipe:** chunk = `<img>` + the text that follows it. Before each paste,
  set the selection to the end of the last non-`FIGURE` block in
  `.section-inner` (for a list, its last `<li>`), then paste and wait for the
  editor HTML length to stop changing.

### Verify before publishing (all automatable via JS)
- Title `h3.graf--title` text is correct.
- `img` count matches the prepped images and all `src` are `cdn-images-1.medium.com`.
- No `figcaption` contains real text (only the "Type caption…" placeholder).
- Section headings `1.`…`N.` appear in order.
- Every `<ol>` has the expected item count and no empty `<li>`.
- The article ending, including the internhack.xyz footer, is present.

### Content conventions
- End every Medium post with:
  *Looking for more study material? Check out [internhack.xyz](https://internhack.xyz) for interview prep, system design notes, and more deep dives.*

### Cleanup
- Failed attempts leave extra drafts. "Delete story" in a draft's ⋯ menu deletes
  **immediately with no confirm**, so match the row to the draft ID before clicking.
