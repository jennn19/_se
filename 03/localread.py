#!/usr/bin/env python3
import hashlib
import html
import re
import ssl
import sys
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

BASE = Path(__file__).resolve().parent
ARTICLES = BASE / "articles"
INDEX = BASE / "index.html"

SKIP_TAGS = {
    "script", "style", "nav", "footer", "header", "aside",
    "noscript", "form", "svg", "template",
}
BLOCK_TAGS = {
    "p", "br", "div", "li", "h1", "h2", "h3", "h4", "h5", "h6",
    "tr", "section", "article", "blockquote", "pre",
}


class Extractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self._skip = 0
        self._parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        elif tag in SKIP_TAGS:
            self._skip += 1
        elif tag in BLOCK_TAGS and self._skip == 0:
            self._parts.append("\n")

    def handle_startendtag(self, tag, attrs):
        if tag in BLOCK_TAGS and self._skip == 0:
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag in SKIP_TAGS and self._skip:
            self._skip -= 1
        elif tag in BLOCK_TAGS and self._skip == 0:
            self._parts.append("\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif self._skip == 0:
            self._parts.append(data)

    def text(self):
        raw = "".join(self._parts)
        lines = [re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in raw.split("\n")]
        lines = [line for line in lines if line]
        return "\n\n".join(lines)


def _read(req, context=None):
    with urlopen(req, timeout=20, context=context) as res:
        return res.read(), res.headers.get_content_charset()


def fetch(url):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; LocalRead/1.0)"})
    try:
        raw, charset = _read(req)
    except URLError as exc:
        reason = getattr(exc, "reason", exc)
        if "CERTIFICATE_VERIFY_FAILED" not in str(reason):
            raise
        print("憑證驗證失敗，改用不驗證模式重試（僅限個人本機使用）")
        raw, charset = _read(req, ssl._create_unverified_context())
    if not charset:
        match = re.search(rb'charset=["\']?([\w-]+)', raw[:4096], re.I)
        charset = match.group(1).decode("ascii", "ignore") if match else "utf-8"
    try:
        return raw.decode(charset, errors="replace")
    except LookupError:
        return raw.decode("utf-8", errors="replace")


def slugify(text):
    text = re.sub(r'[\\/:*?"<>|]', "", text)
    text = re.sub(r"\s+", "-", text).strip("-")
    return text[:50] or "article"


def existing_urls():
    urls = set()
    for path in ARTICLES.glob("*.md"):
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.startswith("- 來源："):
                urls.add(line[len("- 來源："):].strip())
                break
    return urls


def save_article(url):
    ARTICLES.mkdir(exist_ok=True)
    if url in existing_urls():
        print(f"已存在，略過：{url}")
        return

    print(f"抓取中：{url}")
    page = fetch(url)
    parser = Extractor()
    parser.feed(page)
    title = parser.title.strip() or url
    body = parser.text() or "（無法擷取內文，請開啟原文閱讀）"

    now = datetime.now()
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:6]
    name = f"{now:%Y%m%d-%H%M%S}-{digest}-{slugify(title)}.md"
    content = f"# {title}\n- 來源：{url}\n- 儲存：{now:%Y-%m-%d %H:%M}\n\n{body}\n"
    (ARTICLES / name).write_text(content, encoding="utf-8")
    print(f"已儲存：articles/{name}")


def build_index():
    ARTICLES.mkdir(exist_ok=True)
    files = sorted(ARTICLES.glob("*.md"), key=lambda p: p.stat().st_mtime, reverse=True)
    cards = []

    for path in files:
        header, _, content = path.read_text(encoding="utf-8").partition("\n\n")
        lines = header.splitlines()
        title = lines[0][2:].strip() if lines and lines[0].startswith("# ") else path.stem
        source = ""
        saved = ""
        for line in lines[1:]:
            if line.startswith("- 來源："):
                source = line[len("- 來源："):].strip()
            elif line.startswith("- 儲存："):
                saved = line[len("- 儲存："):].strip()

        paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
        excerpt = (paragraphs[0] if paragraphs else "")[:160]
        body = "\n".join(f"<p>{html.escape(p)}</p>" for p in paragraphs) or "<p>（無內文）</p>"
        link = html.escape(source, quote=True)
        cards.append(
            '<article class="card">'
            f"<h2>{html.escape(title)}</h2>"
            f'<p class="meta">{html.escape(saved)} · <a href="{link}" target="_blank" rel="noreferrer">開啟原文</a></p>'
            f'<p class="excerpt">{html.escape(excerpt)}…</p>'
            f"<details><summary>閱讀全文</summary>{body}</details>"
            "</article>"
        )

    updated = datetime.now().strftime("%Y-%m-%d %H:%M")
    head = """<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LocalRead</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #f6f6f4;
    --card: #ffffff;
    --text: #1c1c1c;
    --muted: #6b6b6b;
    --accent: #2f6f4f;
    --border: #e4e4e0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #15171a;
      --card: #1e2126;
      --text: #e8e8e6;
      --muted: #9aa0a6;
      --accent: #7cc4a0;
      --border: #2c3036;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 16px 64px;
    background: var(--bg);
    color: var(--text);
    font-family: system-ui, -apple-system, "Segoe UI", "Microsoft JhengHei", sans-serif;
    line-height: 1.7;
  }
  header, main, footer { max-width: 760px; margin: 0 auto; }
  header h1 { margin: 0 0 4px; font-size: 1.8rem; }
  header p { margin: 0 0 28px; color: var(--muted); }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px 22px;
    margin-bottom: 16px;
  }
  .card h2 { margin: 0 0 6px; font-size: 1.15rem; line-height: 1.4; }
  .meta { margin: 0 0 10px; color: var(--muted); font-size: 0.85rem; }
  .meta a, .card a { color: var(--accent); }
  .excerpt { margin: 0 0 10px; color: var(--muted); }
  details summary { cursor: pointer; color: var(--accent); font-size: 0.9rem; }
  details p { margin: 12px 0 0; }
  .empty { color: var(--muted); text-align: center; padding: 48px 0; }
  code { background: var(--border); padding: 2px 6px; border-radius: 6px; }
  footer { margin-top: 32px; color: var(--muted); font-size: 0.8rem; text-align: center; }
</style>
</head>
<body>
<header>
  <h1>LocalRead</h1>
  <p>共 __COUNT__ 篇 · 更新於 __UPDATED__</p>
</header>
<main>
"""
    head = head.replace("__COUNT__", str(len(files))).replace("__UPDATED__", updated)
    if cards:
        body = "\n".join(cards)
    else:
        body = '<p class="empty">還沒有文章，執行 <code>python localread.py &lt;網址&gt;</code> 開始收藏。</p>'

    page = head + body + "\n</main>\n<footer>LocalRead · 資料只存在你的電腦</footer>\n</body>\n</html>\n"
    INDEX.write_text(page, encoding="utf-8")
    return INDEX


def main():
    args = sys.argv[1:]

    if not args:
        print(f"已更新：{build_index()}")
        return

    if args[0] in {"-h", "--help"}:
        print("用法：")
        print("  python localread.py <網址>   儲存文章並更新 index.html")
        print("  python localread.py          重新產生 index.html")
        print("  python localread.py list     列出已儲存文章")
        return

    if args[0] == "list":
        files = sorted(ARTICLES.glob("*.md"), reverse=True)
        if not files:
            print("尚無文章")
        for path in files:
            print(path.stem)
        return

    url = args[0]
    if not url.startswith(("http://", "https://")):
        print("請輸入 http:// 或 https:// 開頭的網址")
        sys.exit(1)

    save_article(url)
    print(f"已更新：{build_index()}")


if __name__ == "__main__":
    main()
