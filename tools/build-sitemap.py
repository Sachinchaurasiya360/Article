"""Regenerate sitemap.xml from the series registry in assets/js/series.js.

Usage:  python tools/build-sitemap.py

Needs Node.js on PATH (used only to evaluate series.js, so the sitemap always
matches what the site actually routes). Articles whose .md file is missing on
disk are skipped. <lastmod> comes from the file's last git commit date.
"""
import json
import os
import subprocess
from datetime import date
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://article-pied-two.vercel.app"

NODE_DUMP = (
    "const fs=require('fs'),vm=require('vm'),c={};"
    "vm.runInNewContext(fs.readFileSync('assets/js/series.js','utf8')+';this.S=SERIES',c);"
    "process.stdout.write(JSON.stringify(c.S.map(s=>({id:s.id,files:s.articles.map(a=>a.file)}))))"
)


def lastmod(rel_path):
    out = subprocess.run(
        ["git", "log", "-1", "--format=%cs", "--", rel_path],
        cwd=ROOT, capture_output=True, text=True,
    ).stdout.strip()
    return out or date.today().isoformat()


def main():
    series = json.loads(subprocess.run(
        ["node", "-e", NODE_DUMP], cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout)

    today = date.today().isoformat()
    urls = [(f"{SITE}/", today, "1.0")]
    for s in series:
        files = [f for f in s["files"] if os.path.isfile(os.path.join(ROOT, f))]
        if not files:
            continue
        mods = [lastmod(f) for f in files]
        urls.append((f"{SITE}/series.html?id={s['id']}", max(mods), "0.8"))
        for f, mod in zip(files, mods):
            urls.append((f"{SITE}/article.html?path={f}", mod, "0.7"))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, mod, prio in urls:
        lines.append(f"  <url><loc>{escape(loc)}</loc><lastmod>{mod}</lastmod><priority>{prio}</priority></url>")
    lines.append("</urlset>")

    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")
    print(f"sitemap.xml: {len(urls)} URLs")


if __name__ == "__main__":
    main()
