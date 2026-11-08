#!/usr/bin/env node
// מסמן פרק כ"פורסם": status=published, datePublished=היום (אם ריק), ואופציונלית כתובת הריל.
// ואז בונה מחדש (הדף יוצא מ-noindex, נכנס לאינדקס ול-sitemap).
//   node scripts/guides/publish.mjs 1
//   node scripts/guides/publish.mjs 1 --ig https://www.instagram.com/reel/XXXX/
//   node scripts/guides/publish.mjs 1 --yt VIDEOID
//   node scripts/guides/publish.mjs 1 --date 2026-11-08
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const n = Number(args[0]);
if (!n) { console.error('שימוש: node scripts/guides/publish.mjs <מספר פרק> [--ig URL] [--yt ID] [--date YYYY-MM-DD]'); process.exit(2); }
const opt = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };

const path = join(HERE, 'episodes', `ep${String(n).padStart(2, '0')}.json`);
const ep = JSON.parse(readFileSync(path, 'utf8'));
const today = new Date().toISOString().slice(0, 10);
ep.status = 'published';
ep.datePublished = opt('--date') || ep.datePublished || today;
ep.dateModified = today;
if (opt('--ig')) ep.reel.instagramUrl = opt('--ig');
if (opt('--yt')) ep.reel.youtubeId = opt('--yt');
writeFileSync(path, JSON.stringify(ep, null, 2) + '\n');
console.log(`ep${n}: published ${ep.datePublished}${ep.reel.instagramUrl ? ', IG ' + ep.reel.instagramUrl : ''}${ep.reel.youtubeId ? ', YT ' + ep.reel.youtubeId : ''}`);
const r = spawnSync(process.execPath, [join(HERE, 'build.mjs'), '--check'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
