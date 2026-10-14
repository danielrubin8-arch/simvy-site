/* Simvy simulator page behaviours. Progressive enhancement only:
   every word is in the HTML, and without JS (or with reduced motion) the page is complete and static. */
(function () {
  var doc = document.documentElement;
  var motion = doc.classList.contains('motion');
  var raf = window.requestAnimationFrame.bind(window);
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var vh = innerHeight, vw = doc.clientWidth;

  /* ---------- data + chart ---------- */
  var dataEl = document.getElementById('aapl-data');
  var D = dataEl ? JSON.parse(dataEl.textContent) : null;
  var ENTRY = 30, TARGET = 180, STOP_MIN = 145, STOP_MAX = 159;
  var stop = 150, k = D ? D.length - 1 : 0, peakModel = null, lastSig = '', orderGeo = null, peakNarrow = null;
  var orderBox = document.getElementById('order-chart');
  var peakBox = document.getElementById('peak-chart');
  var peak = document.getElementById('ch-stop');
  var beats = peak ? peak.querySelectorAll('.beats li') : [];
  var fmtDate = function (s) { var p = s.split('-'); return (+p[2]) + '.' + (+p[1]) + '.' + p[0]; };

  function drawOrder() {
    if (!orderBox || !D) return;
    var r = SimChart.render(D, { stop: stop, entryIdx: ENTRY, target: TARGET, upto: ENTRY, only: true, id: 'order-svg',
      w: 600, h: 560, k: 1.5, title: orderBox.getAttribute('data-title') });
    orderBox.innerHTML = r.svg; orderGeo = r.geo;
  }
  function drawPeak() {
    if (!peakBox || !D) return;
    var narrow = doc.clientWidth < 900;
    var r = SimChart.render(D, { stop: stop, entryIdx: ENTRY, target: TARGET, upto: D.length - 1, id: 'peak-svg',
      w: narrow ? 600 : 1000, h: narrow ? 700 : 600, k: narrow ? 1.6 : 1, title: peakBox.getAttribute('data-title') });
    peakNarrow = narrow;
    peakBox.innerHTML = r.svg;
    peakModel = r.model;
    var set = function (key, val) { var el = document.querySelectorAll('[data-k="' + key + '"]'); for (var i = 0; i < el.length; i++) el[i].textContent = val; };
    set('stop', String(stop));
    if (peakModel.exitIdx > -1) {
      set('exit-date', fmtDate(D[peakModel.exitIdx][0]));
      set('low', D[peakModel.lowIdx][4].toFixed(2));
      set('low-date', fmtDate(D[peakModel.lowIdx][0]));
    }
    lastSig = '';
    applyPeak();
  }

  /* the peak: candles draw with scroll; the stop catches the fall */
  var peakP = 1;
  function applyPeak() {
    if (!peakBox || !peakModel) return;
    var n = D.length, m = peakModel;
    var kk = motion ? ENTRY + Math.round(smooth(clamp((peakP - 0.05) / 0.82, 0, 1)) * (n - 1 - ENTRY)) : n - 1;
    var beat = kk <= m.hiIdx + 1 ? 0 : (m.exitIdx < 0 || kk < m.exitIdx) ? 1 : kk < m.lowIdx ? 2 : 3;
    var sig = kk + ':' + beat;
    if (sig === lastSig) return;
    lastSig = sig; k = kk;
    var svg = peakBox.firstChild;
    var cs = svg.querySelectorAll('.c');
    for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('off', i > kk);
    var ex = svg.querySelector('.exit'), fa = svg.querySelector('.fall'), pos = svg.querySelector('.ln.pos');
    var caught = m.exitIdx > -1 && kk >= m.exitIdx;
    if (ex) ex.classList.toggle('off', !caught);
    if (fa) fa.classList.toggle('off', !(m.lowIdx > -1 && kk >= m.lowIdx));
    svg.classList.toggle('caught', caught);
    var x1 = pos ? +pos.getAttribute('data-x1') : 0, xc = caught ? +pos.getAttribute('data-exit') : x1;
    var lns = svg.querySelectorAll('.ln.stop, .ln.target');
    for (var q = 0; q < lns.length; q++) lns[q].setAttribute('x2', xc.toFixed(1));
    if (pos) {
      var x0 = +pos.getAttribute('data-x0'), st = +pos.getAttribute('data-step');
      var xe = caught ? +pos.getAttribute('data-exit') : x0 + st * (kk - ENTRY);
      pos.setAttribute('x2', xe.toFixed(1));
    }
    for (var b = 0; b < beats.length; b++) {
      beats[b].classList.toggle('on', b === beat);
      beats[b].classList.toggle('done', b < beat);
    }
    publish();
  }

  function publish() {
    var stage = peak && peak.querySelector('.peak__stage');
    if (!stage) return;
    var r = peak.getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh) {
      stage.setAttribute('data-sc-verify-state', lastSig);
      stage.setAttribute('data-sc-verify-hold', k === D.length - 1 ? 'true' : 'false');
    } else { stage.removeAttribute('data-sc-verify-state'); stage.removeAttribute('data-sc-verify-hold'); }
  }

  /* the visitor places the stop: range input, or drag the line on the order chart */
  var range = document.getElementById('stop-range'), out = document.getElementById('stop-out');
  function setStop(v) {
    v = clamp(Math.round(v), STOP_MIN, STOP_MAX);
    if (v === stop) return;
    stop = v;
    if (range) range.value = String(v);
    if (out) out.textContent = String(v);
    drawOrder(); drawPeak();
    if (orderBox) orderBox.classList.add('placed');
  }
  if (range && D) {
    range.closest('.stopctl').hidden = false;
    range.addEventListener('input', function () { setStop(+range.value); });
  }
  if (orderBox && D) {
    var dragging = false;
    var priceAt = function (e) {
      var svg = orderBox.querySelector('svg'), r = svg.getBoundingClientRect();
      var G = orderGeo, scale = Math.min(r.width / G.W, r.height / G.H), offY = (r.height - G.H * scale) / 2;
      var y = (e.clientY - r.top - offY) / scale;
      return G.PMAX - (y - G.Y0) / (G.Y1 - G.Y0) * (G.PMAX - G.PMIN);
    };
    orderBox.addEventListener('pointerdown', function (e) {
      var p = priceAt(e);
      if (Math.abs(p - stop) > 4) return;
      dragging = true; orderBox.classList.add('dragging'); e.preventDefault(); setStop(p);
    });
    window.addEventListener('pointermove', function (e) { if (dragging) setStop(priceAt(e)); });
    window.addEventListener('pointerup', function () { dragging = false; orderBox.classList.remove('dragging'); });
  }

  /* ---------- folio: where am I ---------- */
  var chapters = [].slice.call(document.querySelectorAll('[data-folio]'));
  var folio = document.querySelector('.folio'), mini = document.querySelector('.folio-mini');
  var fNo = document.getElementById('fm-no'), fName = document.getElementById('fm-name');
  var papers = [].slice.call(document.querySelectorAll('.ch--paper'));
  function setChapter(sec) {
    var id = sec ? sec.id : '';
    if (folio) {
      var as = folio.querySelectorAll('a');
      for (var i = 0; i < as.length; i++) {
        if (as[i].getAttribute('href') === '#' + id) as[i].setAttribute('aria-current', 'true'); else as[i].removeAttribute('aria-current');
      }
      // each link takes the colour of the ground it actually sits on: the folio is centred on the
      // viewport while the chapter test runs at 40%, so a paper edge can cross the folio mid-list
      var pr = papers.map(function (p) { return p.getBoundingClientRect(); });
      for (var j = 0; j < as.length; j++) {
        var r = as[j].getBoundingClientRect(), cy = r.top + r.height / 2, on = false;
        for (var k = 0; k < pr.length; k++) if (pr[k].top <= cy && pr[k].bottom > cy) { on = true; break; }
        as[j].classList.toggle('is-paper', on);
      }
    }
    if (mini) {
      mini.classList.toggle('on', !!sec);
      if (sec) { var f = sec.getAttribute('data-folio').split('|'); fNo.textContent = f[0]; fName.textContent = f[1]; }
    }
  }
  function currentChapter() {
    var mid = vh * 0.4, found = null;
    for (var i = 0; i < chapters.length; i++) {
      var r = chapters[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { found = chapters[i]; break; }
    }
    return found;
  }

  /* ---------- signature: the avatar slalom ---------- */
  var tv = document.querySelector('.traveler');
  var gates = [], baseLeft = 0, tw = 0, th = 0, mobile = false;
  var poses = tv ? { glide: tv.querySelector('[data-pose="glide"]'), a: tv.querySelector('[data-pose="a"]'),
    b: tv.querySelector('[data-pose="b"]'), open: tv.querySelector('[data-pose="open"]') } : {};
  var curPose = '';
  function measure() {
    vh = innerHeight; vw = doc.clientWidth; mobile = vw < 761;
    if (!tv) return;
    tv.style.transform = 'none';
    var tr = tv.getBoundingClientRect();
    baseLeft = tr.left; tw = tr.width; th = tr.height;
    gates = [].slice.call(document.querySelectorAll('[data-gate]')).map(function (g) {
      return { el: g.querySelector('[data-gate-box]') || g, side: g.getAttribute('data-side'),
        perch: g.getAttribute('data-perch') || 'top', last: g.hasAttribute('data-gate-last') };
    });
  }
  // where the avatar sits on a gate right now (viewport coords, live: sticky media moves)
  function perchOf(g) {
    var r = g.el.getBoundingClientRect(), x, y;
    if (g.perch === 'stand') { x = r.left + (r.width - tw) / 2; y = r.bottom - th; }
    else {
      var out = mobile ? 0.22 : g.side === 'start' ? 0.8 : 0.5; // how far outside the gate edge
      x = g.side === 'start' ? r.right - tw * (1 - out) : r.left - tw * out;
      y = g.perch === 'side' ? r.top + r.height * 0.42 - th / 2 : r.top - th * (mobile ? 0.62 : 0.72);
    }
    return { x: clamp(x, 4, vw - tw - 4), y: y };
  }
  function setPose(name) {
    if (name === curPose) return;
    curPose = name;
    for (var p in poses) if (poses[p]) poses[p].classList.toggle('on', p === name);
  }
  // Slalom: ride gate i; when gate i+1 rises into view, swing across to it, leaning into the turn.
  function placeTraveler(s) {
    if (!tv || !gates.length) return;
    var n = gates.length, i = 0, pose = 'glide', lean = 0, vis = 1, x, y;
    var P = gates.map(function (g) { return g.el.getBoundingClientRect().top; });
    // the next gate is the first whose box has not yet risen past 62% of the viewport
    while (i < n - 1 && P[i + 1] < vh * 0.62) i++;
    var g0 = gates[i], p0 = perchOf(g0);
    if (i === n - 1) { x = p0.x; y = p0.y; pose = g0.last ? 'open' : 'glide'; }
    else {
      var g1 = gates[i + 1], p1 = perchOf(g1);
      // crossing runs while gate i+1 travels from 1.15vh to 0.62vh (its box top, viewport)
      var u = clamp((vh * 1.15 - P[i + 1]) / (vh * 0.53), 0, 1);
      var e = smooth(u), de = (u > 0 && u < 1) ? 6 * u * (1 - u) : 0;
      x = p0.x + (p1.x - p0.x) * e;
      y = p0.y + (p1.y - p0.y) * e;
      var dir = p1.x > p0.x ? 1 : -1;
      lean = dir * de;
      if (de > 0.9) pose = 'b'; else if (de > 0.25) pose = 'a';
      if (g1.last && u > 0.92) pose = 'open';
      if (mobile && u > 0 && u < 1) vis = clamp(1 - 2.2 * Math.sin(Math.PI * e), 0, 1);
    }
    // the chart gets the stage alone
    if (peak) {
      var pr = peak.getBoundingClientRect();
      if (pr.top < vh * 0.7 && pr.bottom > vh * 0.3) vis = 0;
    }
    setPose(pose);
    var flip = lean > 0 ? -1 : 1; // source poses lean left; mirror when travelling right
    var rot = clamp(lean * 9, -13, 13);
    y += Math.sin(s / 160) * 3;
    tv.style.transform = 'translate3d(' + (x - baseLeft).toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    tv.firstElementChild.style.transform = 'rotate(' + rot.toFixed(2) + 'deg) scaleX(' + flip + ')';
    tv.style.opacity = vis.toFixed(3);
  }

  /* ---------- hero depth: three planes at three rates ---------- */
  var trace = document.querySelector('.title-stage .trace'), phone = document.querySelector('.title-stage .phone');

  /* ---------- frame loop ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    var s = scrollY;
    if (motion && peak) {
      var r = peak.getBoundingClientRect(), span = peak.offsetHeight - vh;
      peakP = span > 0 ? clamp(-r.top / span, 0, 1) : 1;
      applyPeak();
    }
    publish();
    if (motion && s < vh * 1.2) {
      if (trace) trace.style.transform = 'translate3d(0,' + (s * 0.22).toFixed(1) + 'px,0)';
      if (phone) phone.style.transform = 'translate3d(0,' + (s * -0.06).toFixed(1) + 'px,0)';
    }
    if (motion) placeTraveler(s);
    setChapter(currentChapter());
  }
  function onScroll() { if (!ticking) { ticking = true; raf(frame); } }

  /* ---------- order figure: lines are placed as it enters ---------- */
  if (orderBox && 'IntersectionObserver' in window && motion) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { orderBox.classList.add('placed'); io.disconnect(); } });
    }, { threshold: 0.55 });
    io.observe(orderBox);
  } else if (orderBox) { orderBox.classList.add('placed'); }

  function init() {
    drawOrder();
    drawPeak();
    if (motion && tv) doc.classList.add('glide');
    measure();
    frame();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { measure(); if ((doc.clientWidth < 900) !== peakNarrow) drawPeak(); lastSig = ''; frame(); });
    // late layout shifts (fonts, images) move the gates
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); frame(); });
    addEventListener('load', function () { measure(); frame(); });
    doc.classList.add('sc-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
