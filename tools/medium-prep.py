#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
"""
medium-prep.py

Prepares a markdown file for Medium publishing by:
  - Converting mermaid blocks to PNG images via mermaid.ink API
  - Converting markdown tables to PNG images via matplotlib

Usage:
  python tools/medium-prep.py <input.md>
  python tools/medium-prep.py <folder/>     # process all .md files in folder

Output:
  <input>.medium.md                   - modified markdown with image references
  medium-assets/<stem>/diagram-N.png  - mermaid images
  medium-assets/<stem>/table-N.png    - table images

Requirements:
  pip install matplotlib requests
"""

import re
import base64
from pathlib import Path


# ---------------------------------------------------------------------------
# Mermaid
# ---------------------------------------------------------------------------

def mermaid_ink_url(code: str) -> str:
    encoded = base64.urlsafe_b64encode(code.encode("utf-8")).decode("utf-8")
    return f"https://mermaid.ink/img/{encoded}?type=png"


def download_mermaid_png(code: str, out_path: Path) -> bool:
    try:
        import requests
        resp = requests.get(mermaid_ink_url(code), timeout=15)
        if resp.status_code == 200 and resp.content[:4] == b'\x89PNG':
            out_path.write_bytes(resp.content)
            return True
        print(f"    mermaid.ink status {resp.status_code} - using URL fallback")
        return False
    except Exception as e:
        print(f"    Could not download mermaid image: {e} - using URL fallback")
        return False


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

def _clean_cell(text: str) -> str:
    """Strip markdown bold/italic markers from a table cell."""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)  # **bold** -> bold
    text = re.sub(r'\*(.+?)\*',     r'\1', text)   # *italic* -> plain
    text = re.sub(r'`(.+?)`',       r'\1', text)   # `code` -> plain
    return text.strip()


def _parse_md_table(text: str):
    lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    lines = [l for l in lines if not re.match(r'^[\|\s\-:]+$', l)]
    def split_row(line):
        return [_clean_cell(c) for c in line.strip().strip('|').split('|')]
    if not lines:
        return [], []
    return split_row(lines[0]), [split_row(l) for l in lines[1:]]


def table_to_png(table_text: str, out_path: Path) -> bool:
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
    except ImportError:
        print("    matplotlib not installed: pip install matplotlib")
        return False

    headers, rows = _parse_md_table(table_text)
    if not headers:
        return False

    n_cols = max(len(headers), max((len(r) for r in rows), default=0))
    headers = headers + [''] * (n_cols - len(headers))
    rows    = [r + [''] * (n_cols - len(r)) for r in rows]

    fig_w = max(7, n_cols * 2.4)
    fig_h = max(1.5, (len(rows) + 1) * 0.44 + 0.5)

    fig, ax = plt.subplots(figsize=(fig_w, fig_h))
    ax.axis('off')

    tbl = ax.table(
        cellText=rows if rows else [[''] * n_cols],
        colLabels=headers, loc='center', cellLoc='left',
    )
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(10)
    tbl.auto_set_column_width(col=list(range(n_cols)))
    tbl.scale(1, 1.45)

    for j in range(n_cols):
        c = tbl[0, j]
        c.set_facecolor('#1e293b')
        c.set_text_props(color='#f8fafc', fontweight='bold')
        c.set_edgecolor('#334155')

    for i in range(len(rows)):
        for j in range(n_cols):
            c = tbl[i + 1, j]
            c.set_facecolor('#f8fafc' if i % 2 == 0 else '#ffffff')
            c.set_edgecolor('#e2e8f0')

    plt.tight_layout(pad=0.2)
    plt.savefig(out_path, dpi=150, bbox_inches='tight', facecolor='white', edgecolor='none')
    plt.close()
    return True


# ---------------------------------------------------------------------------
# Main processor
# ---------------------------------------------------------------------------

def process_file(input_path: str, download_mermaid: bool = True):
    src = Path(input_path).resolve()
    if not src.exists():
        print(f"Error: file not found: {input_path}")
        sys.exit(1)

    content = src.read_text(encoding='utf-8')
    assets_dir = src.parent / 'medium-assets' / src.stem
    assets_dir.mkdir(parents=True, exist_ok=True)

    mermaid_idx   = [0]
    table_idx     = [0]
    mermaid_count = [0]
    table_count   = [0]

    # ---- Replace mermaid blocks ----
    def replace_mermaid(match):
        code = match.group(1).strip()
        idx  = mermaid_idx[0]
        mermaid_idx[0] += 1

        if download_mermaid:
            img_path = assets_dir / f'diagram-{idx}.png'
            if download_mermaid_png(code, img_path):
                mermaid_count[0] += 1
                rel = img_path.relative_to(src.parent).as_posix()
                print(f"  [mermaid {idx}] saved -> {rel}")
                return f'![Diagram]({rel})\n'

        url = mermaid_ink_url(code)
        mermaid_count[0] += 1
        print(f"  [mermaid {idx}] URL -> {url[:68]}...")
        return f'![Diagram]({url})\n'

    content = re.sub(r'```mermaid\r?\n([\s\S]*?)\r?\n```', replace_mermaid, content)

    # ---- Replace markdown tables ----
    def replace_table(match):
        table_text = match.group(0)
        if len([l for l in table_text.strip().splitlines() if l.strip()]) < 2:
            return table_text
        idx = table_idx[0]
        table_idx[0] += 1
        img_path = assets_dir / f'table-{idx}.png'
        if table_to_png(table_text, img_path):
            table_count[0] += 1
            rel = img_path.relative_to(src.parent).as_posix()
            print(f"  [table  {idx}] saved -> {rel}")
            return f'![Table]({rel})\n\n'
        print(f"  [table  {idx}] render failed, keeping original")
        return table_text

    content = re.sub(r'(?:^\|.+\r?\n)+', replace_table, content, flags=re.MULTILINE)

    out_file = src.parent / f'{src.stem}.medium.md'
    out_file.write_text(content, encoding='utf-8')

    print(f"\n{'─' * 50}")
    print(f"  Mermaid diagrams : {mermaid_count[0]}")
    print(f"  Tables           : {table_count[0]}")
    print(f"  Output           : {out_file.name}")
    print(f"  Assets           : medium-assets/{src.stem}/")
    print(f"{'─' * 50}")


# ---------------------------------------------------------------------------
# Batch mode
# ---------------------------------------------------------------------------

def process_folder(folder_path: str, download_mermaid: bool = True):
    folder   = Path(folder_path).resolve()
    md_files = [f for f in sorted(folder.glob('*.md')) if '.medium.' not in f.name]
    if not md_files:
        print(f"No .md files found in {folder}")
        return
    print(f"Processing {len(md_files)} files in {folder.name}/\n")
    for f in md_files:
        print(f"\n-- {f.name}")
        process_file(str(f), download_mermaid)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    args     = [a for a in sys.argv[1:] if not a.startswith('--')]
    download = '--no-download' not in sys.argv

    if not args:
        print(__doc__)
        sys.exit(0)

    target = Path(args[0])
    if target.is_dir():
        process_folder(str(target), download)
    elif target.is_file():
        process_file(str(target), download)
    else:
        print(f"Error: '{args[0]}' is not a file or directory")
        sys.exit(1)
