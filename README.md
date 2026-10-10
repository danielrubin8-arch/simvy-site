# simvy-site

The Simvy marketing landing page, served on GitHub Pages at simvy.app.
Single self-contained index.html (fonts, images and video inlined; exported from Claude Design and wired to the join-waitlist Edge Function).
Do NOT add a CNAME file before the DNS records exist - cutover order matters.

## t.js — the traffic counter

Every page loads `<script defer src="/t.js"></script>` from just before
`</head>`. It reports a page view and CTA clicks to the `track-visit` Supabase
Edge Function, and a digest email goes out each morning. Without it nothing
records a visit at all: GitHub Pages gives the site owner no access logs, and
Search Console covers only the Google-search slice of the traffic.

**After any re-export of index.html from Claude Design, put that line back.**
The export overwrites the whole file and the loss is silent: the page looks
perfectly fine and simply stops being counted. The logic lives in its own file
precisely so a re-export can cost the one script tag and never the tracker.

No cookie, no localStorage, nothing stored on the visitor's device, so no
consent banner is required.

Campaign parameters: the page view carries the query string, but only the
whitelisted keys `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`,
`ref` and `ct`, with short plain values. `fbclid`, `gclid` and everything else
are dropped. They ride in the existing `path` field (`/?utm_source=instagram`),
so `track-visit` did not change. A store click is labelled with the link's own
campaign token (`app-store:site-home-hero`).

## אחרי ייצוא מחדש של הקנבס: מה להחזיר

ייצוא מחדש של `index.html` מ-Claude Design דורס את כל הקובץ, וכל מה שבסעיף
הזה נעלם בשקט: הדף נראה תקין לגמרי.

**דפי המשנה הם קבצים סטטיים, לא ייצוא מהקנבס**, וייצוא מחדש לא נוגע בהם:
`pricing.html` (תמחור ושאלות נפוצות), `simulator.html` (הסימולטור, היומן
והחדשות), `courses.html` (הסילבוס), `about.html` (אודות), `thanks.html`,
`disclaimer.html`, `accessibility.html` ו-`404.html`. בכל אחד מהם יש בכותרת
העליונה קישורים ל"הסימולטור" ול"תמחור", ובפוטר את כל העמודים. הטקסט של ארבעת
הראשונים הועתק מילה במילה מהטיוטה שדניאל אישר ב-10.10
(`DRAFT_site-pages_2026-10-10.md` בריפו האפליקציה). עמוד חדש מעתיקים מאחד
מהקיימים (head, ניווט, פוטר, `t.js`, תג חכם), ומוסיפים אותו ל-`sitemap.xml`
ולפוטר של כל הדפים.

**0. קישורים בפוטר של `index.html`:** אחרי "הקורסים" יש קישורים ל-`/simulator.html`
("הסימולטור") ול-`/pricing.html` ("תמחור"), באותו `style` של שאר הקישורים בפוטר
של התבנית.

**1. שורת המונה** ב-`<head>` הסטטי: `<script defer src="/t.js"></script>` (ראו
למעלה).

**2. קישורי ייחוס לחנויות.** ערך נפרד לכל מקום, אותו ערך בשתי החנויות:

| מקום | ערך |
|---|---|
| JSON-LD בתוך התבנית (`downloadUrl`, `installUrl`) | `site-home-schema` |
| דוק תחתון במובייל (`data-m="dock-cta"`) | `site-home-dock` |
| גיבור (`id="download"`) | `site-home-hero` |
| סגירה (התגים הגדולים לפני הפוטר) | `site-home-closing` |
| פוטר | `site-home-footer` |
| `about.html` | `site-about-cta` |
| `courses.html` | `site-courses-cta` |
| `pricing.html` | `site-pricing-cta` |
| `simulator.html` | `site-simulator-cta` |
| `thanks.html` | `site-thanks-card` |

- App Store: `https://apps.apple.com/il/app/id6797081307?pt=129081401&ct=<ערך>&mt=8`
- Google Play: `https://play.google.com/store/apps/details?id=com.simvy.app&referrer=utm_source%3Dsimvy-site%26utm_medium%3Dweb%26utm_campaign%3D<ערך>`
- בתוך `href` של HTML כותבים `&amp;` במקום `&` (‏`?pt=129081401&amp;ct=...&amp;mt=8`,
  ‏`&amp;referrer=`). בתוך JSON-LD כותבים `&` רגיל.
- **`pt=129081401`** הוא ה-provider token של אפל. הוא **קבוע לכל החשבון**, ולא
  משתנה בין קמפיינים. רק `ct` מבדיל בין מקום למקום. לפי התיעוד של App Store
  Connect, קישור קמפיין צריך את שניהם. אם צריך אותו שוב: ASC > Apps > Simvy >
  App Analytics > Campaigns > Create campaign link, והמספר מופיע אחרי `pt=`
  בקישור שנוצר. החלון הוא מחולל בלבד ולא שומר רשומה של קמפיין, ולכן אין צורך
  "לרשום" קמפיין חדש. מספיק `ct` חדש בקישור.

**3. תג חכם של אפל** (Smart App Banner):
`<meta name="apple-itunes-app" content="app-id=6797081307">`, בשני מקומות:
ב-`<head>` הסטטי (מתחת ל-`twitter:card`), **וגם** ב-`<head>` של התבנית
(`__bundler/template`, מתחת ל-`viewport`). הבאנדלר מחליף את כל המסמך
(`document.documentElement.replaceWith`), ולכן תג שנמצא רק בחלק הסטטי לא שורד.
בתג **אין** טוקני קמפיין, וזה מכוון. עמוד ה-Campaign links של אפל אומר להוסיף
`pt` ו-`ct` לתג החכם, אבל לא מראה איך. עמוד התג עצמו מתעד רק את `app-id` ואת
`app-argument`. בפורום המפתחים של אפל, מי שניסה `affiliate-data=pt=...&ct=...`
דיווח שלא הגיעו נתונים ל-ASC, ואפל לא ענתה. כשאפל תתעד את התחביר, אפשר להוסיף.

**4. פיסוק: אפס מקף ארוך (—) בטקסט עברי.** הקנבס עדיין מכיל אותם, וייצוא מחדש
מחזיר את כולם. כל מקף הוחלף בנקודתיים, פסיק, נקודה או סוגריים, בלי לשנות מילה:
בכותרת (`<title>`, `og:title`), ב-FAQ (גם ב-JSON-LD וגם באקורדיון, הטקסט חייב
להיות זהה בשניהם), בכותרות המשנה של הסעיפים, ב-`alt` של התמונות ובהודעת השגיאה
של הטופס. קל יותר לתקן בקנבס עצמו לפני הייצוא.

**איך עורכים את התבנית בלי לשבור אותה.** התבנית היא מחרוזת JSON בשורה אחת.
מפענחים (`json.loads`), עורכים כ-HTML רגיל, ומקודדים חזרה עם
`json.dumps(t, ensure_ascii=False).replace('</script', '<\\/script')`, שמחזיר את
המקור בדיוק, תו בתו (לבדוק את זה על הקובץ החדש לפני שעורכים). מאפייני camelCase
בתבנית נכתבים בצורת `sc-camel-...`.

**איך בודקים:**

```sh
# אף קישור לחנות בלי ייחוס: 0 בכל קובץ, בשתי השורות
grep -c 'id6797081307"\|id6797081307\\"' *.html
grep -c 'com\.simvy\.app"\|com\.simvy\.app\\"' *.html
# הערכים: אחד לכל מקום (10 לאפל, 10 ל-Play)
grep -o 'id6797081307?pt=129081401&\(amp;\)\?ct=[a-z0-9-]*&\(amp;\)\?mt=8' *.html
grep -o 'utm_campaign%3D[a-z0-9-]*' *.html
# קישור לאפל בלי pt: 0 בכל קובץ
grep -c 'id6797081307?ct=' *.html
# תג חכם: 2 ב-index.html, 1 ב-about/courses/pricing/simulator/thanks
grep -c 'apple-itunes-app' *.html
# המונה: 1 בכל דף
grep -c 'src="/t.js"' *.html
# מקף ארוך: 0 ב-head הסטטי ו-0 בתבנית (בהערות הקוד של הבאנדלר מותר)
sed -n '1,/<\/head>/p' index.html | grep -c '—'
grep '__bundler/template">' index.html | grep -o '—' | wc -l
```

והבדיקה שבאמת קובעת, כי הבאנדל נפתח רק בדפדפן: לפתוח את הדף, ובקונסולה:

```js
[...document.querySelectorAll('a[href*="apps.apple.com"], a[href*="play.google.com"]')]
  .map(a => a.href)
```

ולוודא שבכל קישור לאפל יש `pt=129081401&ct=site-...&mt=8`, ובכל קישור ל-Play יש
`referrer=`.
