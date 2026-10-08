"""Собирает тексты и фото страниц проектов со старого сайта botu.su (Tilda).
Пишет beacon/data/<slug>.json и скачивает фото в /tmp/beacon-src/<slug>/NN.<ext>."""
import json, os, re, sys, html, urllib.request
from html.parser import HTMLParser

SLUGS = sys.argv[1:]
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()

class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.stack=[]; s.texts=[]; s.cur=None; s.depth=0
    def handle_starttag(s, tag, a):
        a = dict(a); cls = a.get("class") or ""
        if s.cur is None and tag in ("div","h1","h2","h3","span") and re.search(r"\bt(n)?-(title|descr|text|name|uptitle|heading|subtitle|atom__text)", cls) or (s.cur is None and a.get("field","").startswith(("tn_text","title","descr","text"))):
            s.cur = {"cls": cls, "field": a.get("field",""), "t": ""}; s.depth = 0
        if s.cur is not None:
            s.depth += 1
            if tag == "br": s.cur["t"] += "\n"
    def handle_startendtag(s, tag, a):
        if s.cur is not None and tag == "br": s.cur["t"] += "\n"
    def handle_endtag(s, tag):
        if s.cur is not None:
            s.depth -= 1
            if s.depth <= 0:
                t = re.sub(r"[ \t\xa0]+", " ", s.cur["t"]).strip()
                if t and (not s.texts or s.texts[-1]["t"] != t): s.texts.append({"cls": s.cur["cls"][:60], "t": t})
                s.cur = None
    def handle_data(s, d):
        if s.cur is not None: s.cur["t"] += d

os.makedirs("beacon/data", exist_ok=True)
for slug in SLUGS:
    try:
        raw = get(f"https://botu.su/{slug}").decode("utf-8", "replace")
    except Exception as e:
        print("ERR", slug, e); continue
    p = P(); p.feed(raw)
    imgs = []
    for m in re.finditer(r'(?:data-original|data-img-zoom-url|data-content-cover-bg|src|content|data-bgimgfield-url)=["\'](https?://(?:static|optim|thb)\.tildacdn\.(?:com|info)/[^"\']+)', raw):
        u = m.group(1)
        u = re.sub(r"https?://(?:optim|thb)\.tildacdn\.(com|info)/(tild[^/]+)/-/[^/]+(?:/[^/]+)*?/([^/]+)$", r"https://static.tildacdn.\1/\2/\3", u)
        if re.search(r"\.(svg|ico)$|favicon|/-/resize/20x/|noroot|_icon|logo", u, re.I): continue
        if u not in imgs: imgs.append(u)
    # og:image отдельно
    og = re.search(r'property="og:image" content="([^"]+)"', raw)
    title = re.search(r"<title>(.*?)</title>", raw, re.S)
    desc = re.search(r'name="description" content="([^"]*)"', raw)
    os.makedirs(f"/tmp/beacon-src/{slug}", exist_ok=True)
    saved = []
    for i, u in enumerate(imgs):
        ext = os.path.splitext(u.split("?")[0])[1].lower() or ".jpg"
        fn = f"/tmp/beacon-src/{slug}/{i:02d}{ext}"
        try:
            open(fn, "wb").write(get(u)); saved.append({"url": u, "file": fn})
        except Exception as e:
            print("img ERR", u, e)
    json.dump({"slug": slug, "title": html.unescape(title.group(1).strip()) if title else "",
               "description": html.unescape(desc.group(1)) if desc else "",
               "og": og.group(1) if og else "", "texts": [dict(x, t=html.unescape(x["t"])) for x in p.texts], "images": saved},
              open(f"beacon/data/{slug}.json", "w"), ensure_ascii=False, indent=1)
    print(slug, len(p.texts), "texts", len(saved), "imgs")
