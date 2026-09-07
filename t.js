/*
 * t.js — the simvy.app traffic counter.
 *
 * WHY THIS FILE EXISTS. GitHub Pages does not give the site owner access logs,
 * and this site carried no analytics at all, so for its first weeks nothing
 * anywhere recorded a visit. Google Search Console covered only the
 * Google-search slice; direct traffic, Instagram and WhatsApp were invisible.
 * Every event this file sends lands in public.site_events via the track-visit
 * Edge Function, and a digest email goes out each morning.
 *
 * PRIVACY. No cookie, no localStorage, nothing written to the visitor's device,
 * no third party involved. The server keeps a salted hash of IP + user-agent +
 * date that rotates at midnight and cannot be reversed. Because nothing is
 * stored on the device, this needs no consent banner.
 *
 * IT IS A SEPARATE FILE ON PURPOSE. index.html is a Claude Design export: the
 * next re-export overwrites it wholesale. Keeping the logic here means a
 * re-export can only ever lose the one <script> line, which is easy to spot and
 * to restore. Never inline this into a page.
 *
 * FAILS SILENTLY BY DESIGN. A counter must not be able to break the site it
 * counts, so every path is wrapped and every error is swallowed.
 */
(function () {
  'use strict';

  var ENDPOINT = 'https://aaxlawvhoxexeojtkkxn.supabase.co/functions/v1/track-visit';
  var last = {}; // label -> timestamp, for the de-duplication below

  function send(kind, label) {
    try {
      var body = JSON.stringify({
        kind: kind,
        label: label || null,
        path: location.pathname || '/',
        referrer: document.referrer || null
      });

      // sendBeacon survives the page being unloaded by the very click we are
      // recording, which a normal fetch does not. Its text/plain content-type
      // also keeps the request "simple" in CORS terms, so a page view costs one
      // request instead of a preflight plus a request.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        return;
      }
      fetch(ENDPOINT, {
        method: 'POST',
        body: body,
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
      })['catch'](function () {});
    } catch (e) { /* a counter never breaks the page */ }
  }

  /** One label at most every 1.5s. A submit button fires click AND submit. */
  function once(label) {
    var now = Date.now();
    if (last[label] && now - last[label] < 1500) return false;
    last[label] = now;
    return true;
  }

  function track(label) {
    if (label && once(label)) send('click', label);
  }

  /*
   * Which click counts, and why it is matched this way. index.html is a bundled
   * export whose class names are generated and change on every re-export, so
   * matching on them would break silently and invisibly. These three anchors do
   * not change: the App Store href, the Play href, and being inside a form.
   * data-sv wins over all of them, so a future page can name its own CTA
   * without this file being touched.
   */
  function labelFor(el) {
    var named = el.getAttribute && el.getAttribute('data-sv');
    if (named) return named.slice(0, 40);

    var href = (el.getAttribute && el.getAttribute('href')) || '';
    if (/apps\.apple\.com|itunes\.apple\.com/.test(href)) return 'app-store';
    if (/play\.google\.com/.test(href)) return 'google-play';

    if (el.closest && el.closest('form')) return 'waitlist-submit';
    return null;
  }

  send('view');

  // Capture phase: the page's own handlers call preventDefault and stopPropagation
  // on the waitlist submit, which would keep a bubbling listener from ever seeing it.
  document.addEventListener('click', function (e) {
    try {
      var el = e.target && e.target.closest
        ? e.target.closest('a[href], button, [data-sv]')
        : null;
      if (el) track(labelFor(el));
    } catch (err) { /* ignore */ }
  }, true);

  document.addEventListener('submit', function (e) {
    try {
      var form = e.target;
      var named = form && form.getAttribute && form.getAttribute('data-sv');
      track(named || 'waitlist-submit');
    } catch (err) { /* ignore */ }
  }, true);
})();
