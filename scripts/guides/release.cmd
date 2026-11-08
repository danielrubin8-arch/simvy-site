@echo off
rem שחרור דף של פרק אחרי שהריל עלה: מסמן published, בונה, בודק P0, עושה commit ו-push לענף הנוכחי.
rem   scripts\guides\release.cmd 1 https://www.instagram.com/reel/XXXX/
rem GitHub Pages (legacy build מ-main) מפרסם תוך דקה או שתיים. לא דורש GitHub Actions.
setlocal
if "%~1"=="" ( echo usage: release.cmd ^<episode^> [instagram-url] & exit /b 2 )
cd /d "%~dp0..\.."
set IG=
if not "%~2"=="" set IG=--ig %~2
node scripts\guides\publish.mjs %~1 %IG% || exit /b 1
git add guides sitemap.xml scripts\guides\episodes || exit /b 1
git commit -m "guides: פרק %~1 של מאחורי הצ׳אט באוויר" || exit /b 1
git push || exit /b 1
echo done: https://simvy.app/guides/
