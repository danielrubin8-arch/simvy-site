#!/usr/bin/env node
// שער P0 לדפי הסדרה: 0 מילים אסורות, שורת ההסתייגות בכל דף, ו-sitemap רק עם פרקים שפורסמו.
// הרשימה זהה לרגקס של חבילות הפרסום (queue/2026-11-W1_ep01-06.md, "שער P0").
//   node scripts/guides/check.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const series = JSON.parse(readFileSync(join(HERE, 'series.json'), 'utf8'));

const FORBIDDEN = [
  /ממליצ/, /מומלצ/, /המלצ/,
  /כדאי ל/, /שווה ל/, /רצוי ל/, /עדיף ל/,
  /תשוא/, /הזדמנות/,
  /(הולכת|הולך|עומד|עומדת|צפוי|צפויה) ל(עלות|רדת)/,
  /אל תפספס/, /מניית השנה/, /הכנסה פסיבית/, /אילו קנית/, /אם הייתם קונים/,
  /נקודת (כניסה|יציאה)/, /יעד מחיר/,
  /כתבו בתגובות/, /תגיבו/, /תייגו/, /שתפו/, /עקבו/, /לינק בביו/,
  /מובילה/,
];
const REQUIRED = [series.disclaimer, 'נכון ל-'];

const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

const files = readdirSync(join(ROOT, 'guides')).filter((f) => f.startsWith(`${series.seriesSlug}-`) && f.endsWith('.html'));
let bad = 0;
for (const f of files) {
  const html = readFileSync(join(ROOT, 'guides', f), 'utf8');
  const text = strip(html);
  const hits = [];
  for (const re of FORBIDDEN) { const m = text.match(re); if (m) hits.push(`${re.source} → "…${text.slice(Math.max(0, m.index - 30), m.index + 30)}…"`); }
  for (const s of REQUIRED) if (!text.includes(s)) hits.push(`חסר: "${s}"`);
  const published = !/name="robots" content="noindex/.test(html);
  const inSitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8').includes(`/guides/${f}</loc>`);
  if (published !== inSitemap) hits.push(`sitemap לא תואם: published=${published}, inSitemap=${inSitemap}`);
  console.log(`${hits.length ? '✗' : '✓'} guides/${f}${published ? '' : '  (noindex)'}`);
  for (const h of hits) console.log('    ' + h);
  bad += hits.length;
}
console.log(bad ? `\n${bad} בעיות.` : `\n0 מילים אסורות, ההסתייגות בכל דף, ה-sitemap תואם. ${files.length} דפים.`);
process.exit(bad ? 1 : 0);
