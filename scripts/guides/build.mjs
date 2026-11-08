#!/usr/bin/env node
// מנוע המדריכים של "מאחורי הצ׳אט".
// קורא scripts/guides/series.json + scripts/guides/episodes/epNN.json,
// וכותב guides/<slug>.html לכל פרק, guides/index.html לפרקים שפורסמו,
// ומעדכן את sitemap.xml (רק פרקים שפורסמו).
//
//   node scripts/guides/build.mjs            בונה הכול
//   node scripts/guides/build.mjs --check    בונה ומריץ את בדיקת ה-P0 (check.mjs)
//
// בלי תלויות. Node 18 ומעלה.
// פרק שאינו published מקבל <meta name="robots" content="noindex">, לא נכנס לאינדקס ולא ל-sitemap.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SITE = 'https://simvy.app';

const series = JSON.parse(readFileSync(join(HERE, 'series.json'), 'utf8'));
const episodes = readdirSync(join(HERE, 'episodes'))
  .filter((f) => /^ep\d+\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(HERE, 'episodes', f), 'utf8')))
  .sort((a, b) => a.episode - b.episode);

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = esc;
const heDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d}.${m}.${y}`; };
const today = () => new Date().toISOString().slice(0, 10);
const isPublished = (ep) => ep.status === 'published' && !!ep.datePublished;
const pageUrl = (ep) => `${SITE}/guides/${ep.slug}.html`;
const ctToken = (ep) => `site-guide-btc${String(ep.episode).padStart(2, '0')}`;
// מספרים ושמות לועזיים בתוך עברית: עטיפה ב-<bdi> כדי שהסדר לא יתהפך (כלל האתר).
const bidi = (s) => esc(s).replace(/([A-Za-z][A-Za-z0-9.\-]*(?: [A-Z][A-Za-z0-9.\-]*)*|\d[\d,.%$]*)/g, '<bdi>$1</bdi>');

// ---------- shared chrome (זהה לדפי המדריכים הקיימים) ----------
const HEAD_COMMON = (ep) => `<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;

const ORG_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Simvy', url: `${SITE}/`, logo: `${SITE}/logo-email.png`, email: 'simvysupport@gmail.com', sameAs: ['https://apps.apple.com/il/app/id6797081307', 'https://play.google.com/store/apps/details?id=com.simvy.app'] },
    { '@type': 'MobileApplication', '@id': `${SITE}/#app`, name: 'Simvy', url: `${SITE}/`, operatingSystem: 'iOS, Android', applicationCategory: 'EducationalApplication', inLanguage: 'he', description: 'שיעורים קצרים בעברית על שוק ההון וסימולטור מסחר בכסף וירטואלי.', installUrl: ['https://apps.apple.com/il/app/id6797081307', 'https://play.google.com/store/apps/details?id=com.simvy.app'], sameAs: ['https://apps.apple.com/il/app/id6797081307', 'https://play.google.com/store/apps/details?id=com.simvy.app'], publisher: { '@id': `${SITE}/#org` }, offers: { '@type': 'Offer', price: '0', priceCurrency: 'ILS' } },
  ],
});

const HEADER = `<body>
<script>(function(d){d.classList.add('js');try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('motion')}catch(e){}})(document.documentElement)</script>
<a class="skip" href="#main">דילוג לתוכן</a>
<header class="site-head"><div class="wrap">
  <a class="brand" href="/"><span class="brand__mark"><img src="/img/home-mark.svg" alt="Simvy" width="22" height="22"></span><img class="brand__word" src="/img/home-wordmark.svg" alt="" width="70" height="20"></a>
  <nav class="site-nav" aria-label="ניווט ראשי"><a href="/courses.html">קורסים</a><a href="/simulator.html">הסימולטור</a><a href="/pricing.html">תמחור</a><a href="/about.html">מי אנחנו</a><a class="site-nav__web" href="https://app.simvy.app/?ct=site-web-nav">לפתוח בדפדפן</a></nav>
  <a class="btn" href="#download">להורדה</a>
</div></header>
`;

const FOOTER = (current) => `<footer class="site-foot"><div class="wrap">
  <nav aria-label="קישורים">
    <a href="/">דף הבית</a>
    <a href="/about.html">מי אנחנו</a>
    <a href="/courses.html">הקורסים</a>
    <a href="/glossary.html">מילון מונחים</a>
    <a href="/guides.html"${current === 'guides' ? ' aria-current="page"' : ''}>מדריכים</a>
    <a href="/simulator.html">הסימולטור</a>
    <a href="/pricing.html">תמחור</a>
    <a href="https://app.simvy.app/?ct=site-web-nav">לפתוח בדפדפן</a>
    <a href="/disclaimer.html">גילוי נאות</a>
    <a href="/accessibility.html">הצהרת נגישות</a>
    <a href="https://legal.simvy.app/privacy.html">מדיניות פרטיות</a>
    <a href="https://legal.simvy.app/terms.html">תנאי שימוש</a>
    <a href="mailto:simvysupport@gmail.com">יצירת קשר</a>
  </nav>
  Simvy היא אפליקציית חינוך פיננסי. התכנים אינם ייעוץ השקעות; המסחר באפליקציה מתבצע בכסף וירטואלי בלבד.
</div></footer>
<script src="/js/guides.js" defer></script>
</body>
</html>
`;

const CLOSE = (ct) => `<section class="colophon a-close" id="download" data-sc-act="flow">
  <div class="wrap colophon__grid">
    <div>
      <p class="colophon__line">שיעורים קצרים בעברית על שוק ההון, וסימולטור מסחר בכסף וירטואלי.</p>
      <div class="colophon__links">
        <a class="btn" href="https://apps.apple.com/il/app/id6797081307?pt=129081401&amp;ct=${ct}&amp;mt=8">להורדה מ-App Store</a>
        <a class="btn" href="https://play.google.com/store/apps/details?id=com.simvy.app&amp;referrer=utm_source%3Dsimvy-site%26utm_medium%3Dweb%26utm_campaign%3D${ct}">להורדה מ-Google Play</a>
      </div>
      <p class="fine"><em>Simvy היא אפליקציית חינוך פיננסי. התכנים אינם ייעוץ השקעות ואינם תחליף לייעוץ אישי בידי בעל רישיון; המסחר באפליקציה מתבצע בכסף וירטואלי בלבד.</em></p>
    </div>
    <img class="a-close__av" src="/img/av-pointing.webp" alt="" width="344" height="420" loading="lazy" decoding="async">
  </div>
</section>
`;

// ---------- the reel block ----------
// ברירת המחדל ("link"): הכריכה כתמונה, לחיצה פותחת את הריל ברשת. בלי סקריפט צד שלישי ובלי עוגיות.
// "inline": הטמעה אמיתית (YouTube דרך youtube-nocookie, אינסטגרם דרך blockquote + embed.js).
function reelBlock(ep) {
  const r = ep.reel || {};
  const cover = r.cover ? `/${series.coverDir}/${r.cover}` : null;
  const ytUrl = r.youtubeId ? `https://www.youtube.com/shorts/${r.youtubeId}` : null;
  const href = r.instagramUrl || ytUrl;
  const coverImg = cover
    ? `<img src="${attr(cover)}" alt="${attr(r.coverAlt || '')}" width="540" height="960" loading="lazy" decoding="async">`
    : '';
  const dur = r.durationSeconds ? `<span class="reel__dur">${Math.floor(r.durationSeconds / 60)}:${String(r.durationSeconds % 60).padStart(2, '0')}</span>` : '';

  if (r.embed === 'inline' && r.youtubeId) {
    return `<div class="reel reel--yt"><iframe src="https://www.youtube-nocookie.com/embed/${attr(r.youtubeId)}" title="${attr(ep.shortTitle)} · ${attr(series.series)}" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  }
  if (r.embed === 'inline' && r.instagramUrl) {
    return `<div class="reel reel--ig"><blockquote class="instagram-media" data-instgrm-permalink="${attr(r.instagramUrl)}" data-instgrm-version="14"><a href="${attr(r.instagramUrl)}">${coverImg}</a></blockquote><script async src="https://www.instagram.com/embed.js"></script></div>`;
  }
  if (href) {
    return `<a class="reel reel--link" href="${attr(href)}" rel="noopener" target="_blank">${coverImg}<span class="reel__play" aria-hidden="true"></span>${dur}<span class="reel__cta">לצפייה בריל${r.instagramUrl ? ' באינסטגרם' : ' ביוטיוב'}</span></a>`;
  }
  // הריל עוד לא עלה: הכריכה בלבד.
  return `<figure class="reel reel--soon">${coverImg}<figcaption>הריל עולה ב-<time datetime="${attr(ep.reelScheduledAt)}">${heDate(ep.reelScheduledAt)}</time>. עד אז, הסיכום בכתב למטה.</figcaption></figure>`;
}

// ---------- episode page ----------
function buildEpisode(ep) {
  const url = pageUrl(ep);
  const published = isPublished(ep);
  const datePub = ep.datePublished || ep.reelScheduledAt;
  const dateMod = ep.dateModified || datePub;
  const cta = series.cta[ep.ctaKey] || series.cta[series.ctaDefaultKey];
  const ct = ctToken(ep);
  const titleTag = `${ep.question} | ${series.series} ${ep.episode} · Simvy`;
  const ogImage = ep.reel && ep.reel.cover ? `${SITE}/${series.coverDir}/${ep.reel.cover}` : `${SITE}/og-image.jpg`;

  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article', '@id': `${url}#article`, headline: ep.question, alternativeHeadline: `${series.series} · פרק ${ep.episode} מתוך ${series.episodesTotal}: ${ep.shortTitle}`,
        description: ep.metaDescription, inLanguage: 'he', datePublished: datePub, dateModified: dateMod, url, mainEntityOfPage: url, image: ogImage,
        author: { '@id': `${SITE}/#org` }, publisher: { '@id': `${SITE}/#org` }, about: { '@id': `${SITE}/#app` },
        isPartOf: { '@type': 'CreativeWorkSeries', '@id': `${SITE}/guides/#series`, name: series.series, url: `${SITE}/guides/` },
        position: ep.episode, keywords: (ep.keywords || []).join(', '),
      },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Simvy', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'מדריכים', item: `${SITE}/guides.html` },
        { '@type': 'ListItem', position: 3, name: series.series, item: `${SITE}/guides/` },
        { '@type': 'ListItem', position: 4, name: ep.shortTitle, item: url },
      ] },
    ],
  };
  if (ep.reel && (ep.reel.instagramUrl || ep.reel.youtubeId)) {
    ld['@graph'][0].video = {
      '@type': 'VideoObject', name: `${ep.shortTitle} · ${series.series} ${ep.episode}`, description: ep.summary.join(' '),
      thumbnailUrl: ogImage, uploadDate: datePub, duration: ep.reel.durationSeconds ? `PT${ep.reel.durationSeconds}S` : undefined,
      embedUrl: ep.reel.youtubeId ? `https://www.youtube-nocookie.com/embed/${ep.reel.youtubeId}` : undefined,
      url: ep.reel.instagramUrl || `https://www.youtube.com/shorts/${ep.reel.youtubeId}`,
    };
  }

  const toc = [
    ...ep.points.map((p, i) => [`s-${i + 1}`, p.h, p.p.split(/(?<=[.?!])\s/)[0]]),
    ...(ep.companies ? [['s-co', 'החברות שהוזכרו', 'לפי תפקיד בשרשרת, כפי שנאמר בפרק.']] : []),
    ['s-tr', 'מה נאמר בפרק', 'התמלול, כמו בסרטון.'],
    ['s-src', 'מקורות ו״נכון ל-״', ep.timeSensitivity],
  ];

  const companies = ep.companies ? `<section class="chap" id="s-co" aria-labelledby="s-co-h">
<h2 id="s-co-h">החברות שהוזכרו בפרק</h2>
<p class="gist"><b>בקצרה:</b> לפי תפקיד בשרשרת, כמה יחד, כפי שנאמר בפרק. נכון ל-<time datetime="${attr(ep.companies.asOf)}">${heDate(ep.companies.asOf)}</time>.</p>
<ul>
${ep.companies.groups.map((g) => `<li><b>${esc(g.role)}:</b> ${g.names.map(bidi).join(', ')}.</li>`).join('\n')}
</ul>
<p>${bidi(ep.companies.note)} אין כאן הערכה של אף חברה, אין מחיר ואין תחזית. ${esc(series.disclaimer)}</p>
</section>` : (ep.companiesNote ? `<section class="chap" id="s-co" aria-labelledby="s-co-h">
<h2 id="s-co-h">החברות שהוזכרו בפרק</h2>
<p>${bidi(ep.companiesNote)}</p>
</section>` : '');
  if (!ep.companies && ep.companiesNote) toc.splice(toc.length - 2, 0, ['s-co', 'החברות שהוזכרו', 'אין חברות בפרק הזה.']);

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="apple-itunes-app" content="app-id=6797081307">
<title>${esc(titleTag)}</title>
<meta name="description" content="${attr(ep.metaDescription)}">
${published ? '' : '<meta name="robots" content="noindex, nofollow">\n'}<link rel="canonical" href="${url}">
${HEAD_COMMON(ep)}
<meta property="og:title" content="${attr(ep.question)}">
<meta property="og:description" content="${attr(ep.metaDescription)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="he_IL">
<meta property="article:published_time" content="${datePub}">
<script type="application/ld+json">${ORG_LD}</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<link rel="preload" href="/fonts/assistant-800.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="/css/site.css">
<link rel="stylesheet" href="/css/guides.css">
<link rel="stylesheet" href="/css/guides-series.css">
  <script defer src="/t.js"></script>
</head>
${HEADER}
<main id="main">
<section class="a-title" data-sc-act="flow">
  <div class="wrap">
    <p class="crumbs"><a href="/guides.html">מדריכים</a> · <a href="/guides/">${esc(series.series)}</a> · פרק <bdi>${ep.episode}</bdi> מתוך <bdi>${series.episodesTotal}</bdi></p>
    <h1>${bidi(ep.question)}</h1>
    <p class="lede">${ep.summary.map(bidi).join('<br>')}</p>
    <p class="dateline">${esc(series.series)} · פרק <bdi>${ep.episode}</bdi> · ${published ? 'פורסם' : 'טיוטה, לפרסום ב-'}<time datetime="${datePub}">${heDate(datePub)}</time> · נכון ל-<time datetime="${dateMod}">${heDate(dateMod)}</time> · ${esc(series.disclaimer)}</p>
  </div>
</section>

<section class="ep-reel" data-sc-act="flow">
  <div class="wrap ep-reel__grid">
    ${reelBlock(ep)}
    <div class="ep-reel__side">
      <p class="toc__h">מה יש בדף הזה</p>
      <p>הריל של פרק <bdi>${ep.episode}</bdi> באורך של כדקה, ולידו הסיכום בכתב: שלוש הנקודות של הפרק, התמלול, החברות שהוזכרו ולפי איזה תפקיד, והמקורות לכל מספר.</p>
      <p class="ep-reel__fine">${esc(series.disclaimer)} אין כאן הערכה של חברה, מחיר או תחזית.</p>
    </div>
  </div>
</section>

<section class="read" data-sc-act="flow">
  <div class="wrap read__grid">
    <nav class="toc" aria-label="בעמוד הזה">
      <p class="toc__h">בעמוד הזה</p>
      <ol>${toc.map(([id, h, g]) => `<li><a href="#${id}">${esc(h)}</a><p class="toc__gist" aria-hidden="true">${bidi(g)}</p></li>`).join('')}</ol>
    </nav>
    <article class="article">
${ep.points.map((p, i) => `<section class="chap" id="s-${i + 1}" aria-labelledby="s-${i + 1}-h">
<h2 id="s-${i + 1}-h">${bidi(p.h)}</h2>
<p>${bidi(p.p)}</p>
</section>`).join('\n')}
${companies}
<section class="chap" id="s-tr" aria-labelledby="s-tr-h">
<h2 id="s-tr-h">מה נאמר בפרק</h2>
<p class="gist"><b>התמלול,</b> כמו שנאמר בסרטון. בלי תוספות.</p>
${ep.transcript.map((t) => `<p><b>${esc(t.h)}.</b> ${bidi(t.t)}</p>`).join('\n')}
</section>
<section class="chap" id="s-src" aria-labelledby="s-src-h">
<h2 id="s-src-h">מקורות, ו״נכון ל-״</h2>
<p class="gist"><b>רגישות לזמן:</b> ${bidi(ep.timeSensitivity)}</p>
<ul>
${ep.sources.map((s) => `<li>${bidi(s)}</li>`).join('\n')}
</ul>
<p>הדף נכון ל-<time datetime="${dateMod}">${heDate(dateMod)}</time>. מספרים על חברות נקובות מובאים בדיעבד ועם תאריך, כפי שנאמרו בפרק.</p>
</section>
    </article>
  </div>
</section>

<section class="more" data-sc-act="flow">
  <div class="wrap">
    <h2 class="more__h">${esc(cta.k)}</h2>
    <p class="more__lead">${bidi(ep.ctaLead)}</p>
    <a class="next" href="${attr(cta.href)}${cta.href.startsWith('http') ? '' : ''}">
      <span class="next__k">${esc(cta.go)}</span>
      <span class="next__t">${bidi(cta.t)}</span>
      <span class="next__d">${bidi(cta.d)}</span>
    </a>
    ${ep.next && ep.next.slug ? `<p class="more__also">הפרק הבא: <a href="/guides/${attr(ep.next.slug)}.html">${bidi(ep.next.title)}</a></p>` : (ep.next ? `<p class="more__also">הפרק הבא: ${bidi(ep.next.title)} (עולה בהמשך)</p>` : '')}
    ${ep.prev && ep.prev.slug ? `<p class="more__also">הפרק הקודם: <a href="/guides/${attr(ep.prev.slug)}.html">${bidi(ep.prev.title)}</a></p>` : ''}
    <p class="more__gl"><a href="/guides/">כל הפרקים של ${esc(series.series)}</a> · <a href="/glossary.html">מילון המונחים</a></p>
  </div>
</section>

${CLOSE(ct)}</main>

${FOOTER('')}`;
  return html;
}

// ---------- series index ----------
function buildIndex(pubs) {
  const url = `${SITE}/guides/`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', '@id': `${url}#page`, name: series.indexTitle, url, inLanguage: 'he', description: series.indexDescription, publisher: { '@id': `${SITE}/#org` },
        hasPart: pubs.map((ep) => ({ '@id': `${pageUrl(ep)}#article` })) },
      { '@type': 'CreativeWorkSeries', '@id': `${url}#series`, name: series.series, url, inLanguage: 'he', description: series.indexDescription },
      { '@type': 'ItemList', itemListElement: pubs.map((ep, i) => ({ '@type': 'ListItem', position: i + 1, url: pageUrl(ep), name: ep.question })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Simvy', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'מדריכים', item: `${SITE}/guides.html` },
        { '@type': 'ListItem', position: 3, name: series.series, item: url },
      ] },
    ],
  };
  const items = pubs.length ? pubs.map((ep) => `      <li>
        <a href="/guides/${attr(ep.slug)}.html">
          <span class="guides__k">פרק <bdi>${ep.episode}</bdi> · ${heDate(ep.datePublished)}</span>
          <h2>${bidi(ep.question)}</h2>
          <p>${bidi(ep.summary[0])}</p>
          <span class="shelf__go">לקריאת המדריך</span>
        </a>
      </li>`).join('\n') : `      <li class="guides__empty">הפרק הראשון עולה בקרוב.</li>`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="apple-itunes-app" content="app-id=6797081307">
<title>${esc(series.indexTitle)} · Simvy</title>
<meta name="description" content="${attr(series.indexDescription)}">
${pubs.length ? '' : '<meta name="robots" content="noindex, nofollow">\n'}<link rel="canonical" href="${url}">
${HEAD_COMMON()}
<meta property="og:title" content="${attr(series.indexTitle)} · Simvy">
<meta property="og:description" content="${attr(series.indexDescription)}">
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta property="og:url" content="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="he_IL">
<script type="application/ld+json">${ORG_LD}</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<link rel="preload" href="/fonts/assistant-800.ttf" as="font" type="font/ttf" crossorigin>
<link rel="stylesheet" href="/css/site.css">
<link rel="stylesheet" href="/css/guides.css">
<link rel="stylesheet" href="/css/guides-series.css">
  <script defer src="/t.js"></script>
</head>
${HEADER}
<main id="main">
<section class="a-title a-title--hub" data-sc-act="flow">
  <div class="wrap">
    <p class="crumbs"><a href="/guides.html">מדריכים</a></p>
    <h1>${esc(series.indexTitle)}</h1>
    <p class="lede">${bidi(series.indexDescription)}</p>
  </div>
</section>

<section class="g-list" data-sc-act="flow">
  <div class="wrap">
    <ol class="guides">
${items}
    </ol>
    <p class="more__gl">${pubs.length} מתוך <bdi>${series.episodesTotal}</bdi> פרקים באוויר. הדף מתעדכן עם כל פרק שעולה. <a href="/guides.html">שאר המדריכים</a> · <a href="/glossary.html">מילון המונחים</a></p>
  </div>
</section>

${CLOSE('site-guides-btc-index')}</main>

${FOOTER('guides')}`;
}

// ---------- sitemap ----------
function updateSitemap(pubs) {
  const path = join(ROOT, 'sitemap.xml');
  let xml = readFileSync(path, 'utf8');
  // מסירים כל שורה של הסדרה (לפי התחילית של ה-slug ושל האינדקס) ומוסיפים מחדש רק את הפרקים שפורסמו.
  const prefix = `${SITE}/guides/${series.seriesSlug}-`;
  xml = xml.split('\n').filter((l) => !l.includes(prefix) && !l.includes(`<loc>${SITE}/guides/</loc>`)).join('\n');
  if (pubs.length) {
    const lastIdx = pubs.reduce((m, ep) => (ep.dateModified || ep.datePublished) > m ? (ep.dateModified || ep.datePublished) : m, '0000');
    const lines = [`  <url><loc>${SITE}/guides/</loc><lastmod>${lastIdx}</lastmod></url>`,
      ...pubs.map((ep) => `  <url><loc>${pageUrl(ep)}</loc><lastmod>${ep.dateModified || ep.datePublished}</lastmod></url>`)];
    xml = xml.replace('</urlset>', `${lines.join('\n')}\n</urlset>`);
  }
  writeFileSync(path, xml);
}

// ---------- main ----------
mkdirSync(join(ROOT, 'guides'), { recursive: true });
const pubs = episodes.filter(isPublished);
for (const ep of episodes) {
  const out = join(ROOT, 'guides', `${ep.slug}.html`);
  writeFileSync(out, buildEpisode(ep));
  const cover = ep.reel && ep.reel.cover ? join(ROOT, series.coverDir, ep.reel.cover) : null;
  console.log(`${isPublished(ep) ? 'PUBLISHED' : 'draft    '}  guides/${ep.slug}.html${cover && !existsSync(cover) ? '   ⚠ חסרה כריכה: ' + series.coverDir + '/' + ep.reel.cover : ''}`);
}
writeFileSync(join(ROOT, series.indexPath), buildIndex(pubs));
console.log(`index      ${series.indexPath} (${pubs.length} published)`);
updateSitemap(pubs);
console.log(`sitemap    ${pubs.length} series URL(s)${pubs.length ? ' + /guides/' : ', none added'}`);

if (process.argv.includes('--check')) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(process.execPath, [join(HERE, 'check.mjs')], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
