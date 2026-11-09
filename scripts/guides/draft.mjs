#!/usr/bin/env node
// יוצר שלד epNN.json מתוך תסריט הפרק (epNN.md) ודף הפרסום (publish/epNN.md).
// השלד מכיל את מה שאפשר לגזור מכנית: תמלול, הוק, פרמיס, מילות מפתח, טבלת החברות, מקורות, תאריך הריל.
// את השאלה (H1), שלוש הנקודות ומשפט ה-CTA כותבים ביד בתוך ה-JSON, מהתמלול בלבד. בלי להמציא עובדות.
//
//   node scripts/guides/draft.mjs 4
//   node scripts/guides/draft.mjs 4 --src "C:\...\claude cloud"   (ברירת מחדל: הנתיב למטה)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const n = Number(args[0]);
if (!n) { console.error('שימוש: node scripts/guides/draft.mjs <מספר פרק> [--src DIR] [--force]'); process.exit(2); }
const si = args.indexOf('--src');
const SRC = si > -1 ? args[si + 1] : 'C:\\Users\\danie\\Desktop\\העלאה והשקה\\סושיאל\\AI campine\\claude cloud';
const nn = String(n).padStart(2, '0');
const out = join(HERE, 'episodes', `ep${nn}.json`);
if (existsSync(out) && !args.includes('--force')) { console.error(`${out} כבר קיים. --force כדי לדרוס.`); process.exit(1); }

const md = readFileSync(join(SRC, `ep${nn}.md`), 'utf8');
const pubPath = join(SRC, 'publish', `ep${nn}.md`);
const pub = existsSync(pubPath) ? readFileSync(pubPath, 'utf8') : '';

const section = (text, num) => { const m = text.match(new RegExp(`^## ${num}\\.[^\\n]*\\n([\\s\\S]*?)(?=^## \\d+\\.|^---\\s*$(?![\\s\\S]*^## ${num}\\.)|\\Z)`, 'm')); return m ? m[1] : ''; };
const grab = (text, label) => { const m = text.match(new RegExp(`\\*\\*${label}[^*]*\\*\\*\\s*(.+)`)); return m ? m[1].trim().replace(/^[״"]|[״"]$/g, '') : ''; };

const title = (md.match(/^# .*?·\s*(.+?)\s*$/m) || [, ''])[1];
const hook = grab(section(md, 2), 'ההוק');
const premise = grab(section(md, 2), 'הפרמיס במשפט אחד');

// תמלול: בלוקים של **כותרת (זמן)** ואחריהם שורות טקסט. מדלגים על מבוא הסדרה והסגיר.
const transcript = [];
for (const m of section(md, 3).matchAll(/\*\*([^*(]+?)\s*(?:\([^)]*\))?\*\*\s*\n([\s\S]*?)(?=\n\*\*|\n---|\nהערה:|$)/g)) {
  const h = m[1].trim(); const t = m[2].trim().replace(/\s*\n\s*/g, ' ');
  if (!t || /^מבוא הסדרה|^סגיר|^הוק$/.test(h)) continue;
  transcript.push({ h: h.replace(/^העוגן:\s*|^המפנה:\s*|^המסקנה.*?:\s*/, ''), t });
}

// חברות: טבלה בסעיף 5, אם יש.
const rows = [...section(md, 5).matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm)].filter((r) => !/^חברה$|^---/.test(r[1].trim()) && !/^-+$/.test(r[1].trim()));
const companies = rows.length ? {
  asOf: null,
  note: 'החברות מוזכרות בפרק לפי התפקיד שלהן בשרשרת, כמה יחד, בלי מחיר ובלי תחזית. התפקידים נכונים למועד ההקלטה.',
  groups: rows.map((r) => ({ role: r[3].trim(), names: [r[1].trim()] })),
} : null;

// מקורות: עמודת "פירוט ומקור" בטבלת סעיף 6.
const sources = [...section(md, 6).matchAll(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm)]
  .map((r) => r[2].trim()).filter((s) => s && !/^---|^פירוט ומקור$/.test(s));
const timeSens = (section(md, 6).match(/רגישות לזמן:\s*(.+)/) || [, ''])[1].trim();

const kw = (section(md, 8).match(/\*\*מילות מפתח בעברית:\*\*\s*(.+)/) || [, ''])[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean);
const nextT = (section(md, 8).match(/\*\*הפרק הבא:\*\*\s*פרק\s*(\d+)\s*·\s*([^(\n]+)/) || []);
const prevT = (section(md, 8).match(/\*\*הפרק הקודם:\*\*\s*פרק\s*(\d+)\s*·\s*([^(\n]+)/) || []);

// תאריך הריל מדף הפרסום: "**מתי:** ראשון 8.11, 19:30"
const dm = pub.match(/\*\*מתי:\*\*[^\d]*(\d{1,2})\.(\d{1,2})/);
const reelDate = dm ? `2026-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}` : null;
const coverText = (pub.match(/בכריכה:\s*[״"]([^״"]+)[״"]/) || [, ''])[1];

const ep = {
  episode: n,
  slug: `behind-the-chat-${nn}-TODO`,
  status: 'draft',
  reelScheduledAt: reelDate,
  datePublished: null,
  dateModified: null,
  sourceRef: `ep${nn}.md, publish/ep${nn}.md`,
  question: coverText ? `${coverText} TODO: להשלים לשאלה מלאה` : 'TODO: כותרת שאלה',
  shortTitle: title,
  metaDescription: `TODO (עד 160 תווים): ${premise}`,
  summary: ['TODO שורה 1 (מהפרמיס)', 'TODO שורה 2', 'TODO שורה 3'],
  points: [{ h: 'TODO', p: 'TODO מהתמלול בלבד' }, { h: 'TODO', p: 'TODO' }, { h: 'TODO', p: 'TODO' }],
  transcript: [{ h: 'ההוק', t: hook }, ...transcript],
  companies,
  companiesNote: companies ? null : 'TODO: לציין שאין חברות בפרק, או למחוק',
  sources,
  timeSensitivity: timeSens || 'TODO',
  keywords: kw,
  ctaKey: 'default',
  ctaLead: 'TODO: משפט אחד שמחבר את הפרק לקורס המבוא',
  reel: { instagramUrl: null, youtubeId: null, embed: 'link', cover: `btc-ep${nn}.jpg`, coverAlt: `כריכת פרק ${n}: ״${coverText}״`, durationSeconds: null },
  prev: prevT[1] ? { episode: Number(prevT[1]), title: prevT[2].trim(), slug: null } : null,
  next: nextT[1] ? { episode: Number(nextT[1]), title: nextT[2].trim(), slug: null } : null,
  _premise: premise,
};
writeFileSync(out, JSON.stringify(ep, null, 2) + '\n');
console.log(`נכתב ${out}. להשלים את כל ה-TODO, להסיר _premise, ולהריץ build.mjs --check.`);
