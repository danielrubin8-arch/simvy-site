# מנוע המדריכים · ״מאחורי הצ׳אט״

דף באתר לכל פרק בסדרה, בתבנית המדריכים הקיימת (`/css/guides.css`), עם JSON-LD Article,
״נכון ל-״, הריל (או הכריכה עד שהוא עולה), שלוש נקודות, התמלול, החברות לפי תפקיד, מקורות ו-CTA.
Node בלבד, בלי תלויות.

## קבצים

| קובץ | מה הוא |
|---|---|
| `series.json` | הגדרות הסדרה: שם, מספר פרקים, רשימת ה-CTA לפי נושא, שורת ההסתייגות, תיקיית הכריכות |
| `episodes/epNN.json` | התוכן של כל פרק. **מקור האמת לדף.** נגזר מהתסריט בלבד |
| `build.mjs` | בונה `guides/<slug>.html` לכל פרק, `guides/index.html` (רק פרקים שפורסמו) ומעדכן `sitemap.xml` (רק פרקים שפורסמו) |
| `check.mjs` | שער P0: 0 מילים אסורות (הרגקס של חבילות הפרסום), ההסתייגות בכל דף, sitemap תואם |
| `publish.mjs` | מסמן פרק כפורסם (תאריך, כתובת הריל) ובונה מחדש |
| `draft.mjs` | שלד `epNN.json` מתוך `epNN.md` + `publish/epNN.md` (תמלול, חברות, מקורות, מילות מפתח). השאלה והנקודות נכתבות ביד |

## מחזור חיים של פרק

```
node scripts/guides/draft.mjs 4          # שלד מהתסריט, להשלים TODO ביד
node scripts/guides/build.mjs --check    # הדף נבנה כטיוטה: noindex, לא באינדקס, לא ב-sitemap
# ... דניאל מאשר את הדף (PR טיוטה). הריל עולה. ואז:
node scripts/guides/publish.mjs 4 --ig https://www.instagram.com/reel/XXXX/
# הדף יוצא מ-noindex, נכנס ל-guides/index.html ול-sitemap.xml. commit + push.
```

`status` בקובץ הפרק: `draft` (נבנה עם noindex) או `published` (עם `datePublished`).
`reel.embed`: `link` (ברירת מחדל: הכריכה, לחיצה פותחת את הריל, בלי סקריפט צד שלישי ובלי עוגיות)
או `inline` (הטמעה: YouTube דרך `youtube-nocookie.com`, אינסטגרם דרך `embed.js` של אינסטגרם).

## כריכות

`img/guides/btc-epNN.jpg`, 540×960, מתוך `covers/epNN.jpg` של הסדרה (1080×1920):

```
python -c "from PIL import Image; Image.open('covers/ep04.jpg').convert('RGB').resize((540,960), Image.LANCZOS).save('img/guides/btc-ep04.jpg', quality=82, optimize=True, progressive=True)"
```

## כללים (P0)

- הטקסט נגזר מהתמלול בלבד. אין עובדה פיננסית שלא נאמרה בפרק.
- חברות: תמיד כמה יחד ולפי תפקיד, בלי מחיר, בלי אחוז, בלי ״מובילה״, עם ״נכון ל-״.
- ״תוכן חינוכי, לא ייעוץ השקעות.״ בכל דף (ה-check נכשל בלעדיה).
- `index.html` ו-`about.html` לא נוגעים. `guides.html` (ההאב) מקבל קישור לסדרה רק באישור דניאל.
- דף לא יוצא מ-noindex לפני שהריל של אותו פרק עלה ודניאל אישר את הדף.
