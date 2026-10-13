/* Simvy pricing page. Progressive enhancement only: every word is in the HTML,
   and without JS (or with reduced motion) every square is drawn and the close is static. */
(function () {
  var doc = document.documentElement;
  var motion = doc.classList.contains('motion');
  var raf = window.requestAnimationFrame.bind(window);
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var vh = innerHeight, vw = doc.clientWidth;

  /* ---------- the field: the PRO side fills, course by course ---------- */
  var field = document.getElementById('field');
  var stage = field && field.querySelector('.field__stage');
  var clusters = field ? [].slice.call(field.querySelectorAll('.side--pro .cluster')) : [];
  var cells = [], owner = [];
  clusters.forEach(function (c, ci) {
    var is = c.querySelectorAll('.cells i');
    for (var i = 0; i < is.length; i++) { cells.push(is[i]); owner.push(ci); }
  });
  var lit = -1;
  function light(n) {
    if (n === lit) return;
    lit = n;
    for (var i = 0; i < cells.length; i++) cells[i].classList.toggle('on', i < n);
    var filling = n > 0 && n < cells.length ? owner[n - 1] : -1;
    for (var c = 0; c < clusters.length; c++) clusters[c].classList.toggle('filling', c === filling);
    if (stage) { stage.setAttribute('data-sc-verify-state', String(n)); stage.setAttribute('data-sc-verify-hold', n === cells.length ? 'true' : 'false'); }
  }
  var pinned = false;
  function applyField() {
    if (!pinned || !field) return;
    var r = field.getBoundingClientRect(), span = field.offsetHeight - (vh - 52);
    var p = span > 0 ? clamp((52 - r.top) / span, 0, 1) : 1;
    light(Math.round(smooth((p - 0.02) / 0.84) * cells.length));
  }
  // narrow screens: nothing is pinned; each course fills as it arrives
  var io = null;
  function narrowFill() {
    if (!('IntersectionObserver' in window)) { light(cells.length); return; }
    io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var is = en.target.querySelectorAll('.cells i');
        for (var i = 0; i < is.length; i++) { is[i].style.transitionDelay = (i * 24) + 'ms'; is[i].classList.add('on'); }
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -18% 0px' });
    clusters.forEach(function (c) { io.observe(c); });
  }

  /* ---------- close: the PRO pane slides to the edge ---------- */
  var col = document.getElementById('download');
  var colStage = col && col.querySelector('.collapse__stage');
  var lastC = '';
  function applyClose() {
    if (!pinned || !col) return;
    var r = col.getBoundingClientRect(), span = col.offsetHeight - vh;
    var p = span > 0 ? clamp(-r.top / span, 0, 1) : 1;
    // the divider starts moving as the stage settles, and the free side holds at the end
    var c = smooth((p - 0.02) / 0.72);
    var sig = c.toFixed(3);
    if (sig === lastC) return;
    lastC = sig;
    colStage.style.setProperty('--c', sig);
    colStage.setAttribute('data-sc-verify-state', c.toFixed(2));
    colStage.setAttribute('data-sc-verify-hold', c > 0.999 ? 'true' : 'false');
  }

  var ticking = false;
  function frame() { ticking = false; applyField(); applyClose(); }
  function onScroll() { if (!ticking) { ticking = true; raf(frame); } }
  function setup() {
    vh = innerHeight; vw = doc.clientWidth;
    var was = pinned;
    pinned = motion && vw >= 900;
    if (pinned) { if (io) { io.disconnect(); io = null; } lit = -1; }
    else if (motion && (was || !io)) { cells.forEach(function (i) { i.classList.remove('on'); }); lit = -1; if (!io) narrowFill(); }
    if (!pinned && colStage) colStage.style.removeProperty('--c');
    lastC = '';
  }
  function init() {
    doc.classList.add('sc-ready');
    if (!motion) return;
    setup();
    frame();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { setup(); frame(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
