#!/usr/bin/env python3
"""
tools/help/build_help.py
────────────────────────────────────────────────────────────
Builds the static help center pages (/help/) from the same content the app
shows: public.help_articles (PostgREST, public read) or the app's bundled seed.

    python tools/help/build_help.py --from-file ../simvy-app/src/content/help/seed.json
    python tools/help/build_help.py --from-api   # SUPABASE_URL + SUPABASE_ANON_KEY

Writes:
    help/index.html          the center: topics, every article, the FAQs (FAQPage JSON-LD)
    help/<slug>.html         one page per article (FAQs live on the index only)
    sitemap.xml              the /help/ lines, between the HELP markers

Static HTML, zero JS for the content, the same head/nav/footer/t.js as every
other page (README: "מה חייב להישאר בכל דף"). The app's in-app links (`goto`)
become a line saying where the screen is; platform blocks: the `web` block when
the article has one, otherwise the iOS and Android blocks, each labelled.

Content rules are enforced by the app repo's scripts/help/build.mjs; this
script only refuses an em dash, as a last line.
────────────────────────────────────────────────────────────
"""
import argparse
import datetime as dt
import html
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "help"
SITE = "https://simvy.app"

CATEGORIES = [
    ("start", "מתחילים"),
    ("learn", "שיעורים וקורסים"),
    ("exam", "מבחנים ותעודות"),
    ("practice", "תרגול"),
    ("sim", "סימולטור"),
    ("habit", "יומן, הרגלים וחדשות"),
    ("pro", "Simvy PRO ותשלומים"),
    ("account", "חשבון והגדרות"),
    ("privacy", "פרטיות ויצירת קשר"),
]

# Mirrors HELP_ROUTES[*].webHint in the app (src/core/help/helpRoutes.ts).
WEB_HINTS = {
    "home": "מסך הבית",
    "sim": "לשונית סימולטור בסרגל התחתון",
    "trades": "סימולטור ⟵ יומן העסקאות",
    "courses": "לשונית קורסים בסרגל התחתון",
    "path": "בית ⟵ המסלול שלי",
    "path-quiz": "שאלון המסלול",
    "practice": "לשונית תרגול בסרגל התחתון",
    "practice-daily": "תרגול ⟵ תרגול היום",
    "journal": "סימולטור ⟵ ידע עצמי",
    "news": "לשונית חדשות בסרגל התחתון",
    "profile": "הפרופיל",
    "scores": "פרופיל ⟵ היסטוריית ציונים ומבחנים",
    "notifications": "פרופיל ⟵ העדפות התראות",
    "settings": "פרופיל ⟵ גלגל ההגדרות",
    "privacy": "הגדרות ⟵ פרטיות ונתונים",
    "legal": "הגדרות ⟵ דיסקליימר, תקנון ומדיניות",
    "paywall": "מסך Simvy PRO",
    "account-create": "פרופיל ⟵ פתיחת חשבון",
    "referral": "פרופיל ⟵ הזמן חבר",
    "downloads": "מסך ההורדות",
    "support": "פרופיל ⟵ עזרה ותקלות",
}
PLATFORM_LABEL = {"ios": "באייפון", "android": "באנדרואיד", "web": "בדפדפן"}

LATIN = re.compile(r"([A-Za-z$][A-Za-z0-9$@.,'&+/:-]*(?:\s+[A-Za-z0-9$][A-Za-z0-9$@.,'&+/:-]*)*)")
BOLD = re.compile(r"\*\*(.+?)\*\*")


def inline(text: str) -> str:
    """**bold** → <b>, Latin runs in <bdi>, everything else escaped."""
    def latin(chunk: str) -> str:
        out, last = [], 0
        for m in LATIN.finditer(chunk):
            run = m.group(1).rstrip(".,:")
            out.append(html.escape(chunk[last:m.start()], quote=False))
            out.append(f"<bdi>{html.escape(run, quote=False)}</bdi>")
            last = m.start() + len(run)
        out.append(html.escape(chunk[last:], quote=False))
        return "".join(out)

    parts = BOLD.split(text)  # odd indexes are the bold runs
    return "".join(f"<b>{latin(p)}</b>" if i % 2 else latin(p) for i, p in enumerate(parts))


def render_blocks(blocks, slugs, platform_ok=lambda b: True):
    parts = []
    for b in blocks:
        t = b.get("type")
        if t == "p":
            parts.append(f"<p>{inline(b['text'])}</p>")
        elif t == "h":
            parts.append(f"<h2>{inline(b['text'])}</h2>")
        elif t in ("steps", "bullets"):
            tag = "ol" if t == "steps" else "ul"
            items = "".join(f"<li>{inline(i)}</li>" for i in b["items"])
            parts.append(f"<{tag}>{items}</{tag}>")
        elif t == "note":
            parts.append(f'<p class="help-note help-note--{b.get("tone", "info")}">{inline(b["text"])}</p>')
        elif t == "goto":
            hint = WEB_HINTS.get(b.get("route"))
            if hint:
                parts.append(f'<p class="help-goto"><b>באפליקציה:</b> {inline(hint)}</p>')
        elif t == "article":
            if b.get("slug") in slugs:
                parts.append(f'<p class="help-link"><a href="/help/{b["slug"]}.html">{inline(b["label"])}</a></p>')
        elif t == "platform":
            if platform_ok(b):
                inner = render_blocks(b.get("blocks", []), slugs)
                if b["only"] == "web":  # the site's own version: no label
                    parts.append(inner)
                else:
                    label = PLATFORM_LABEL.get(b["only"], "")
                    parts.append(f'<div class="help-platform"><p class="help-platform__k">{label}</p>{inner}</div>')
    return "\n".join(parts)


def article_body(a, slugs):
    has_web = any(b.get("type") == "platform" and b.get("only") == "web" for b in a["blocks"])
    ok = (lambda b: b["only"] == "web") if has_web else (lambda b: b["only"] in ("ios", "android"))
    return render_blocks(a["blocks"], slugs, ok)


def plain(blocks) -> str:
    bits = []
    for b in blocks:
        if b.get("type") in ("p", "h", "note"):
            bits.append(b["text"])
        elif b.get("type") in ("steps", "bullets"):
            bits.extend(b["items"])
    return BOLD.sub(r"\1", " ".join(bits))


HEAD = """<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="apple-itunes-app" content="app-id=6797081307">
<title>{title} · Simvy</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:title" content="{title} · Simvy">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="https://simvy.app/og-image.jpg">
<meta property="og:url" content="{url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="he_IL">
<script type="application/ld+json">{ld}</script>
<link rel="preload" href="/fonts/assistant-800.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="/css/site.css">
<link rel="stylesheet" href="/css/guides.css">
<link rel="stylesheet" href="/css/help.css">
  <script defer src="/t.js"></script>
</head>
<body>
<script>(function(d){{d.classList.add('js');try{{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('motion')}}catch(e){{}}}})(document.documentElement)</script>
<a class="skip" href="#main">דילוג לתוכן</a>
<header class="site-head"><div class="wrap">
  <a class="brand" href="/"><span class="brand__mark"><img src="/img/home-mark.svg" alt="Simvy" width="22" height="22"></span><img class="brand__word" src="/img/home-wordmark.svg" alt="" width="70" height="20"></a>
  <nav class="site-nav" aria-label="ניווט ראשי"><a href="/courses.html">קורסים</a><a href="/simulator.html">הסימולטור</a><a href="/pricing.html">תמחור</a><a href="/about.html">מי אנחנו</a><a class="site-nav__web" href="https://app.simvy.app/?ct=site-web-nav">לפתוח בדפדפן</a></nav>
  <a class="btn" href="#download">להורדה</a>
</div></header>

<main id="main">
"""

TAIL = """
<section class="colophon a-close" id="download" data-sc-act="flow">
  <div class="wrap colophon__grid">
    <div>
      <p class="colophon__line">שיעורים קצרים בעברית על שוק ההון, וסימולטור מסחר בכסף וירטואלי.</p>
      <div class="colophon__links">
        <a class="btn" href="https://apps.apple.com/il/app/id6797081307?pt=129081401&amp;ct=site-help&amp;mt=8">להורדה מ-App Store</a>
        <a class="btn" href="https://play.google.com/store/apps/details?id=com.simvy.app&amp;referrer=utm_source%3Dsimvy-site%26utm_medium%3Dweb%26utm_campaign%3Dsite-help">להורדה מ-Google Play</a>
      </div>
      <p class="fine"><em>Simvy היא אפליקציית חינוך פיננסי. התכנים אינם ייעוץ השקעות, והמסחר באפליקציה מתבצע בכסף וירטואלי בלבד.</em></p>
    </div>
  </div>
</section>
</main>

<footer class="site-foot"><div class="wrap">
  <nav aria-label="קישורים">
    <a href="/">דף הבית</a>
    <a href="/about.html">מי אנחנו</a>
    <a href="/courses.html">הקורסים</a>
    <a href="/glossary.html">מילון מונחים</a>
    <a href="/guides.html">מדריכים</a>
    <a href="/help/">מרכז העזרה</a>
    <a href="/simulator.html">הסימולטור</a>
    <a href="/pricing.html">תמחור</a>
    <a href="https://app.simvy.app/?ct=site-web-nav">לפתוח בדפדפן</a>
    <a href="/disclaimer.html">גילוי נאות</a>
    <a href="/accessibility.html">הצהרת נגישות</a>
    <a href="https://legal.simvy.app/privacy.html">מדיניות פרטיות</a>
    <a href="https://legal.simvy.app/terms.html">תנאי שימוש</a>
    <a href="mailto:support@simvy.app">יצירת קשר</a>
  </nav>
  Simvy היא אפליקציית חינוך פיננסי. התכנים אינם ייעוץ השקעות; המסחר באפליקציה מתבצע בכסף וירטואלי בלבד.
</div></footer>
</body>
</html>
"""

CONTACT = """
<section class="more" data-sc-act="flow">
  <div class="wrap">
    <h2 class="more__h">לא מצאתם תשובה?</h2>
    <p>באפליקציה: פרופיל ⟵ <b>עזרה ותקלות</b>, או במייל ל-<a href="mailto:support@simvy.app"><bdi>support@simvy.app</bdi></a>.</p>
    <p class="more__also"><a href="/help/">לכל מאמרי העזרה</a></p>
  </div>
</section>
"""


def org_ld():
    return {"@type": "Organization", "@id": f"{SITE}/#org", "name": "Simvy", "url": f"{SITE}/", "logo": f"{SITE}/logo-email.png", "email": "support@simvy.app"}


def page(title, desc, url, ld_graph, body):
    ld = json.dumps({"@context": "https://schema.org", "@graph": [org_ld(), *ld_graph]}, ensure_ascii=False)
    head = HEAD.format(title=html.escape(title), desc=html.escape(desc), url=url, ld=ld)
    return head + body + TAIL


def build(rows):
    rows = [r for r in rows if r.get("slug") and r.get("blocks")]
    articles = [r for r in rows if not r.get("is_faq")]
    faqs = [r for r in rows if r.get("is_faq")]
    slugs = {a["slug"] for a in articles}
    files = {}

    for a in articles:
        url = f"{SITE}/help/{a['slug']}.html"
        cat = dict(CATEGORIES).get(a["category"], "")
        crumbs = {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Simvy", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "מרכז העזרה", "item": f"{SITE}/help/"},
            {"@type": "ListItem", "position": 3, "name": a["title"], "item": url},
        ]}
        art = {"@type": "Article", "@id": f"{url}#article", "headline": a["title"], "description": a["summary"], "inLanguage": "he", "url": url, "publisher": {"@id": f"{SITE}/#org"}}
        body = f"""<section class="a-title" data-sc-act="flow">
  <div class="wrap">
    <p class="help-crumb"><a href="/help/">מרכז העזרה</a> · {inline(cat)}</p>
    <h1>{inline(a['title'])}</h1>
    <p class="lede">{inline(a['summary'])}</p>
  </div>
</section>
<section data-sc-act="flow">
  <div class="wrap">
    <article class="help-body">
{article_body(a, slugs)}
    </article>
  </div>
</section>
{CONTACT}"""
        files[f"help/{a['slug']}.html"] = page(a["title"], a["summary"], url, [art, crumbs], body)

    # Index: FAQs first, then every topic with its articles.
    url = f"{SITE}/help/"
    faq_html = "\n".join(
        f'<div><h3>{inline(f["title"])}</h3><p>{inline(f["summary"])}</p>'
        + "".join(f' <a href="/help/{b["slug"]}.html">{inline(b["label"])}</a>' for b in f["blocks"] if b.get("type") == "article" and b.get("slug") in slugs)
        + "</div>"
        for f in faqs
    )
    topics = []
    for key, title in CATEGORIES:
        items = [a for a in articles if a["category"] == key]
        if not items:
            continue
        lis = "\n".join(f'<li><a href="/help/{a["slug"]}.html"><h3>{inline(a["title"])}</h3><p>{inline(a["summary"])}</p></a></li>' for a in items)
        topics.append(f'<section class="help-topic" id="{key}"><h2>{inline(title)}</h2><ul class="help-list">\n{lis}\n</ul></section>')
    faq_ld = {"@type": "FAQPage", "@id": f"{url}#faq", "mainEntity": [
        {"@type": "Question", "name": BOLD.sub(r"\1", f["title"]), "acceptedAnswer": {"@type": "Answer", "text": BOLD.sub(r"\1", f["summary"])}} for f in faqs
    ]}
    crumbs = {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Simvy", "item": f"{SITE}/"},
        {"@type": "ListItem", "position": 2, "name": "מרכז העזרה", "item": url},
    ]}
    desc = "מרכז העזרה של Simvy: איך עובדים השיעורים, הסימולטור, התרגול והאש, מה פותח המנוי, איך מבטלים, ושאלות נפוצות."
    body = f"""<section class="a-title a-title--hub" data-sc-act="flow">
  <div class="wrap">
    <h1>מרכז העזרה</h1>
    <p class="lede">איך עובדים השיעורים, הסימולטור, התרגול והאש, מה פותח המנוי ואיך מבטלים. אותם מאמרים שמופיעים באפליקציה.</p>
  </div>
</section>
<section class="a-faq" id="faq" data-sc-act="flow">
  <div class="wrap">
    <h2 class="a-faq__h">שאלות נפוצות</h2>
    <div class="qa">
{faq_html}
    </div>
  </div>
</section>
<section data-sc-act="flow">
  <div class="wrap">
{chr(10).join(topics)}
  </div>
</section>
{CONTACT}"""
    files["help/index.html"] = page("מרכז העזרה", desc, url, [faq_ld, crumbs], body)
    return files, [f"{SITE}/help/"] + [f"{SITE}/help/{a['slug']}.html" for a in articles]


def update_sitemap(urls):
    p = ROOT / "sitemap.xml"
    s = p.read_text(encoding="utf-8")
    s = re.sub(r"\s*<!-- HELP:BEGIN -->.*?<!-- HELP:END -->", "", s, flags=re.S)
    today = dt.date.today().isoformat()
    lines = "\n".join(f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>" for u in urls)
    s = s.replace("</urlset>", f"  <!-- HELP:BEGIN -->\n{lines}\n  <!-- HELP:END -->\n</urlset>")
    p.write_text(s, encoding="utf-8")


def load(args):
    if args.from_file:
        return json.loads(Path(args.from_file).read_text(encoding="utf-8"))
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_ANON_KEY"]
    q = "select=slug,category,sort,title,summary,keywords,blocks,platforms,is_faq&published=eq.true&order=category,sort"
    req = urllib.request.Request(f"{base}/rest/v1/help_articles?{q}", headers={"apikey": key, "Authorization": f"Bearer {key}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        rows = json.loads(r.read().decode("utf-8"))
    order = [c for c, _ in CATEGORIES]
    return sorted(rows, key=lambda r: (order.index(r["category"]) if r["category"] in order else 99, r.get("is_faq", False), r.get("sort", 100)))


def main():
    ap = argparse.ArgumentParser()
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--from-file")
    src.add_argument("--from-api", action="store_true")
    args = ap.parse_args()
    files, urls = build(load(args))
    bad = [p for p, text in files.items() if "—" in text]
    if bad:
        sys.exit(f"em dash in: {', '.join(bad)}")
    if OUT.exists():
        for old in OUT.glob("*.html"):
            if f"help/{old.name}" not in files:
                old.unlink()
    OUT.mkdir(exist_ok=True)
    for rel, text in files.items():
        (ROOT / rel).write_text(text, encoding="utf-8", newline="\n")
    update_sitemap(urls)
    print(f"help: {len(files)} pages")


if __name__ == "__main__":
    main()
