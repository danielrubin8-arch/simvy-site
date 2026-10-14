/* Simvy about page. Progressive enhancement only: every word is in the HTML,
   and without JS (or with reduced motion) the line is set large and all six rings are drawn. */
(function () {
  var doc = document.documentElement;
  if (!doc.classList.contains('motion')) { doc.classList.add('sc-ready'); return; }
  var raf = window.requestAnimationFrame.bind(window);
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var vh = innerHeight;

  /* the line: the first sentence shrinks away, the second takes the page */
  var sec = document.querySelector('.a-line');
  var stage = sec && sec.querySelector('.a-line__stage');
  var lastK = '';
  function applyLine() {
    if (!sec) return;
    var r = sec.getBoundingClientRect(), span = sec.offsetHeight - vh;
    var p = span > 0 ? clamp(-r.top / span, 0, 1) : 1;
    var k = smooth((p - 0.1) / 0.66).toFixed(3);
    if (k === lastK) return;
    lastK = k;
    stage.style.setProperty('--k', k);
    stage.setAttribute('data-sc-verify-state', (+k).toFixed(2));
    stage.setAttribute('data-sc-verify-hold', +k > 0.999 || +k < 0.001 ? 'true' : 'false');
  }

  /* the six lens rings: each closes as its lens is read; the mark appears when all six are closed */
  var lenses = [].slice.call(document.querySelectorAll('.lenses li'));
  var rings = [].slice.call(document.querySelectorAll('.rings .ring'));
  var fig = document.querySelector('.rings'), grid = document.querySelector('.a-build__grid');
  var lastR = '';
  function applyRings() {
    var line = vh * 0.62, sig = '', all = true;
    for (var i = 0; i < lenses.length && i < rings.length; i++) {
      var r = lenses[i].getBoundingClientRect();
      var d = clamp((line - r.top) / Math.max(r.height, 1), 0, 1);
      d = Math.round(d * 100) / 100;
      sig += d + ',';
      rings[i].style.setProperty('--d', d);
      rings[i].classList.toggle('closed', d >= 1);
      lenses[i].classList.toggle('lit', d >= 0.5);
      if (d < 1) all = false;
    }
    if (sig === lastR) return;
    lastR = sig;
    if (fig) fig.classList.toggle('done', all);
    if (grid) grid.classList.toggle('done', all);
  }

  /* the pool: the avatar and his float ride the water gently as the chapter passes */
  var pool = document.querySelector('.pool'), why = document.querySelector('.a-why');
  function applyPool() {
    if (!pool || !why) return;
    var r = why.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    var p = (vh - r.top) / (vh + r.height);
    pool.style.setProperty('--bob', (Math.sin(p * Math.PI * 4) * 4).toFixed(2));
  }

  var ticking = false;
  function frame() { ticking = false; applyLine(); applyRings(); applyPool(); }
  function onScroll() { if (!ticking) { ticking = true; raf(frame); } }
  function init() {
    doc.classList.add('sc-ready');
    frame();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { vh = innerHeight; lastK = ''; lastR = ''; frame(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
