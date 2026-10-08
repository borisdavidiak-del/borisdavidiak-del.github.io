"""Собирает страницы проектов beacon/p/<slug>/index.html.
Данные: список проектов из beacon/index.html (массив P), тексты из beacon/data/content.json,
галереи из beacon/img/p/<slug>/*.jpg. Запуск: python3 tools/build_pages.py"""
import html, json, os, re, glob

ROOT = os.path.join(os.path.dirname(__file__), "..", "beacon")
idx = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
P = re.findall(r'\["([a-z0-9-]+)","([^"]+)","([^"]+)","([^"]+)"\]', idx.split("const P=[")[1].split("];")[0])
CONTENT = json.load(open(os.path.join(ROOT, "data", "content.json"), encoding="utf-8"))
e = html.escape

def grad(i):
    h = (i * 47 + 20) % 360
    return f"radial-gradient(120% 90% at 80% 10%,hsl({h} 90% 55%/.5),transparent 60%),radial-gradient(90% 80% at 10% 100%,hsl({(h+60)%360} 80% 40%/.4),transparent 60%),#07080e"

def slots(n):
    """Мозаика: большой кадр на половину + два друг над другом, зеркально; остаток парой или на всю ширину."""
    A = [("xl", "1/span 6", 0, 2), ("s", "7/span 6", 0, 1), ("s", "7/span 6", 1, 1)]
    C = [("s", "1/span 6", 0, 1), ("s", "1/span 6", 1, 1), ("xl", "7/span 6", 0, 2)]
    B = [("m", "1/span 6", 0, 2), ("m", "7/span 6", 0, 2)]
    W = [("w", "1/span 12", 0, 2)]
    out, row, k = [], 1, 0
    while len(out) < n:
        left = n - len(out)
        blk = (A if k % 2 == 0 else C) if left >= 3 else B if left == 2 else W
        for size, c, dr, h in blk:
            out.append((size, c, f"{row+dr}/span {h}"))
        row += 2; k += 1
    return out

def story(blocks):
    out, first = [], True
    for b in blocks:
        if isinstance(b, list):
            out.append("<ul>" + "".join(f"<li>{e(x)}</li>" for x in b) + "</ul>")
        elif b.startswith("# "):
            out.append(f"<h3>{e(b[2:])}</h3>")
        else:
            out.append(f'<p{" class=\"first\"" if first else ""}>{e(b)}</p>'); first = False
    return "\n".join(out)

TPL = open(os.path.join(ROOT, "data", "project.tpl.html"), encoding="utf-8").read()
for i, (slug, title, cat, short) in enumerate(P):
    c = CONTENT.get(slug, {})
    imgs = sorted(glob.glob(os.path.join(ROOT, "img", "p", slug, "*.jpg")))
    skip = set(c.get("skip", []))
    imgs = [x for x in imgs if os.path.basename(x)[:-4] not in skip]
    cover = f"../../img/{slug}.jpg" if os.path.exists(os.path.join(ROOT, "img", f"{slug}.jpg")) else ""
    gal = "\n".join(
        f'<figure class="rv {s}" style="--c:{col};--r:{r}"><img src="../../img/p/{slug}/{os.path.basename(x)}" alt="{e(title)}, фото {k+1}" loading="lazy"></figure>'
        for k, (x, (s, col, r)) in enumerate(zip(imgs, slots(len(imgs)))))
    nslug, ntitle, ncat, _ = P[(i + 1) % len(P)]
    ncover = f'<img src="../../img/{nslug}.jpg" alt="" loading="lazy" onerror="this.remove()">' if os.path.exists(os.path.join(ROOT, "img", f"{nslug}.jpg")) else ""
    page = TPL
    for k, v in {
        "TITLE": e(title), "CAT": e(cat), "LEAD": e(c.get("lead", short)), "DESC": e(short),
        "NUM": f"{i+1:02d}", "TOTAL": str(len(P)), "SLUG": slug, "GRAD": grad(i),
        "COVER": f'<img src="{cover}" alt="{e(title)}">' if cover else "",
        "OG": f"img/{slug}.jpg" if cover else "",
        "STORY": story(c.get("story", [])), "GALLERY": gal, "GCOUNT": str(len(imgs)),
        "NSLUG": nslug, "NTITLE": e(ntitle), "NCAT": e(ncat), "NGRAD": grad((i + 1) % len(P)), "NCOVER": ncover,
    }.items():
        page = page.replace("{{" + k + "}}", v)
    if not imgs:
        page = re.sub(r"<!--GAL-->.*?<!--/GAL-->", "", page, flags=re.S)
    os.makedirs(os.path.join(ROOT, "p", slug), exist_ok=True)
    open(os.path.join(ROOT, "p", slug, "index.html"), "w", encoding="utf-8").write(page)
    print(slug, len(imgs), "photos")
