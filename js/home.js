/* Simvy homepage: the slalom course. Progressive enhancement only:
   every word is in the HTML; without JS the avatar perches at each gate, and with
   reduced motion the whole track is drawn at once and nothing moves. */
(function () {
  var doc = document.documentElement;
  var motion = doc.classList.contains('motion');
  var raf = window.requestAnimationFrame.bind(window);
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var rtl = getComputedStyle(doc).direction === 'rtl';
  var main = document.getElementById('main');
  var svg = document.querySelector('.track');
  var tv = document.querySelector('.traveler');
  var dock = document.querySelector('.dock'), map = dock && dock.querySelector('.dock__map');
  var heroCta = document.querySelector('.start .badges'), finish = document.getElementById('download');
  var hides = [].slice.call(document.querySelectorAll('[data-hide-traveler]'));
  var art = document.querySelector('.course-art'), phone = document.querySelector('.start .phone'); // hero depth planes
  var NS = 'http://www.w3.org/2000/svg';
  var RIDE = 0.52;      // the skier's feet ride at this fraction of the viewport
  // a crossing takes the last stretch of a segment: down the lane first, then across the gap above the next gate
  var CROSS_MIN = 150, CROSS_MAX = 300;
  var N = 28;           // samples per drawn segment

  var vh = innerHeight, vw = doc.clientWidth, mobile = false, tw = 0, th = 0, baseLeft = 0, mainTop = 0;
  var gates = [], segs = [], lastS = scrollY, dirY = 1, curSeg = -2, curPose = '', flip = 1;
  var poses = {};
  if (tv) [].forEach.call(tv.querySelectorAll('[data-pose]'), function (im) { poses[im.getAttribute('data-pose')] = im; });

  /* ---------- geometry: gates, perches, the route ---------- */
  function physSide(logical) { return (logical === 'start') === rtl ? 1 : -1; } // +1 = right edge
  function perch(g, r) {
    // r: the gate box in main coordinates. Returns the skier's feet point.
    var sideL = (mobile && g.sideM) || g.side, sg = physSide(sideL);
    var edge = sg > 0 ? r.r : r.l, mode = (mobile && g.perchM) || g.perch, x, y;
    if (mode === 'stand') { x = (r.l + r.r) / 2; y = r.t; }
    else if (mobile) {
      var room = sg > 0 ? vw - r.r : r.l;
      if (mode === 'beside') { x = edge - sg * tw * 0.6; y = r.b + 12 + th; }
      else if (g.perchM !== 'top' && room >= tw * 0.8) { x = edge + sg * room / 2; y = r.t + th * 1.05; }
      else { x = edge - sg * tw * 0.42; y = r.t + 4; }
    } else if (mode === 'top') { x = edge + sg * tw * 0.2; y = r.t + th * 0.04; }
    else if (mode === 'side') { x = edge + sg * tw * 0.62; y = r.t + Math.min(r.b - r.t, vh * 0.5) * 0.45 + th / 2; }
    else { x = edge + sg * (tw * 0.6 + 12); y = r.b + 4; } // beside
    return { x: clamp(x, tw / 2 + 4, vw - tw / 2 - 4), y: y };
  }
  function measure() {
    vh = innerHeight; vw = doc.clientWidth; mobile = vw < 761;
    if (phone) phone.style.transform = 'none'; // measure gates where they rest, not where parallax put them
    var mr = main.getBoundingClientRect();
    mainTop = mr.top + scrollY;
    if (tv) {
      tv.style.transform = 'none';
      var tr = tv.getBoundingClientRect();
      baseLeft = tr.left; tw = tr.width || 110; th = tr.height || 140;
    }
    gates = [].slice.call(document.querySelectorAll('[data-gate]')).map(function (el) {
      var box = el.querySelector('[data-gate-box]') || el, b = box.getBoundingClientRect();
      var r = { l: b.left - mr.left, r: b.right - mr.left, t: b.top - mr.top, b: b.bottom - mr.top };
      var g = { el: el, id: el.id, name: el.getAttribute('data-name') || '', side: el.getAttribute('data-side') || 'end',
        sideM: el.getAttribute('data-side-m'), perch: el.getAttribute('data-perch') || 'top', perchM: el.getAttribute('data-perch-m'),
        pose: el.getAttribute('data-pose') || 'glide', hold: (+el.getAttribute('data-dwell') || 0) * vh,
        peak: !!el.closest('.run'), box: r };
      var p = perch(g, r); g.x = p.x; g.y = p.y;
      return g;
    });
    segs = [];
    for (var i = 0; i < gates.length - 1; i++) {
      var a = gates[i], b2 = gates[i + 1];
      var S = a.y + Math.min(a.hold, Math.max(0, (b2.y - a.y) * 0.6)), E = Math.max(b2.y, S + 20);
      var len = Math.max(1, b2.y - a.y), cross = clamp(len * 0.38, Math.min(CROSS_MIN, len), CROSS_MAX);
      segs.push({ i: i, x0: a.x, y0: a.y, x1: b2.x, y1: b2.y, S: S, E: E, w: 1 - cross / len, peak: a.peak && b2.peak });
    }
    buildTrack();
    buildMap();
  }
  function pointAt(s, t) { return { x: s.x0 + (s.x1 - s.x0) * smooth((t - s.w) / (1 - s.w)), y: s.y0 + (s.y1 - s.y0) * t }; }
  // where the skier is for a ride position T (main coordinates of his feet)
  function locate(T) {
    var n = gates.length;
    if (!n) return null;
    if (T <= gates[0].y || n === 1) return { seg: -1, gate: 0, t: 0, x: gates[0].x, y: gates[0].y, rest: true };
    for (var k = 0; k < segs.length; k++) {
      var s = segs[k];
      if (T < s.S) return { seg: k, gate: k, t: 0, x: s.x0, y: s.y0, rest: true };
      if (T < s.E) { var t = (T - s.S) / (s.E - s.S), p = pointAt(s, t); return { seg: k, gate: -1, t: t, x: p.x, y: p.y, rest: false }; }
    }
    var L = gates[n - 1];
    return { seg: segs.length, gate: n - 1, t: 1, x: L.x, y: L.y, rest: true };
  }

  /* ---------- the carved track ---------- */
  var segEls = [];
  function trackPath(s, upto, off) {
    var d = '', m = Math.max(1, Math.round(N * upto));
    for (var j = 0; j <= m; j++) {
      var t = upto * j / m, p = pointAt(s, t), q = pointAt(s, Math.min(1, t + 0.01));
      var dx = q.x - p.x, dy = q.y - p.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var x = p.x + (-dy / len) * off, y = p.y + (dx / len) * off;
      d += (j ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  }
  function buildTrack() {
    if (!svg) return;
    svg.innerHTML = ''; segEls = []; curSeg = -2;
    if (mobile) { svg.style.display = 'none'; return; }
    svg.style.display = '';
    svg.setAttribute('viewBox', '0 0 ' + main.clientWidth + ' ' + main.scrollHeight);
    svg.style.blockSize = main.scrollHeight + 'px';
    segs.forEach(function (s) {
      var a = document.createElementNS(NS, 'path'), b = document.createElementNS(NS, 'path');
      a.setAttribute('class', 't1' + (s.peak ? ' peak' : '')); b.setAttribute('class', 't2' + (s.peak ? ' peak' : ''));
      svg.appendChild(b); svg.appendChild(a);
      segEls.push([a, b]);
    });
    if (!motion) segs.forEach(function (s, k) { drawSeg(k, 1); });
  }
  function drawSeg(k, upto) {
    var e = segEls[k]; if (!e) return;
    if (upto <= 0) { e[0].setAttribute('d', ''); e[1].setAttribute('d', ''); return; }
    e[0].setAttribute('d', trackPath(segs[k], upto, -3));
    e[1].setAttribute('d', trackPath(segs[k], upto, 3));
  }
  function paintTrack(loc) {
    if (!segEls.length || !motion) return;
    var k = loc.seg, upto = loc.rest ? 0 : loc.t;
    if (k !== curSeg) {
      for (var j = 0; j < segEls.length; j++) drawSeg(j, j < k ? 1 : 0);
      curSeg = k;
    }
    if (k >= 0 && k < segEls.length) drawSeg(k, upto);
  }

  /* ---------- the dock: the course in miniature ---------- */
  var ticks = [], me = null, runOn = null;
  function frac(y) { var a = gates[0].y, b = gates[gates.length - 1].y; return b > a ? clamp((y - a) / (b - a), 0, 1) : 0; }
  function buildMap() {
    if (!map || !gates.length) return;
    map.innerHTML = ''; ticks = [];
    runOn = document.createElement('span'); runOn.className = 'run-on'; map.appendChild(runOn);
    gates.forEach(function (g) {
      var li = document.createElement('li'), a = document.createElement('a'), sp = document.createElement('span');
      a.href = '#' + g.id; sp.textContent = g.name; a.appendChild(sp); li.appendChild(a);
      li.style.insetInlineStart = (frac(g.y) * 100).toFixed(2) + '%';
      map.appendChild(li); ticks.push(a);
    });
    me = document.createElement('span'); me.className = 'me'; map.appendChild(me);
    map.hidden = false;
  }
  function paintDock(T) {
    if (!dock) return;
    var on = false;
    if (heroCta && finish) on = heroCta.getBoundingClientRect().bottom < 0 && finish.getBoundingClientRect().top > vh * 0.82;
    dock.classList.toggle('on', on);
    if (!me || !gates.length) return;
    var f = frac(T);
    me.style.insetInlineStart = (f * 100).toFixed(2) + '%';
    runOn.style.inlineSize = (f * 100).toFixed(2) + '%';
    for (var i = 0; i < ticks.length; i++) ticks[i].classList.toggle('passed', T >= gates[i].y - 1);
  }

  /* ---------- the skier ---------- */
  function setPose(name) {
    if (!poses[name]) name = 'glide';
    if (name === curPose) return;
    curPose = name;
    for (var p in poses) poses[p].classList.toggle('on', p === name);
  }
  function visibility(loc, feetVy) {
    var v = 1;
    for (var h = 0; h < hides.length; h++) {
      var r = hides[h].getBoundingClientRect();
      var inside = Math.min(feetVy - r.top, r.bottom - (feetVy - th));
      v = Math.min(v, clamp(1 - (inside + 40) / 80, 0, 1));
    }
    if (mobile && !loc.rest) {
      // phones have no free lane between gates: ride beside the gate, then cross unseen
      var s = segs[loc.seg], g0 = gates[loc.seg], ride = Math.max(g0.box.b + th * 0.2, s.S);
      var out = clamp(1 - (loc.y - ride) / 70, 0, 1), back = clamp(1 - (s.y1 - loc.y) / 70, 0, 1);
      v = Math.min(v, Math.max(out, back));
    }
    return v;
  }
  function placeTraveler(s) {
    if (!tv || !gates.length) return null;
    var T = s + vh * RIDE - mainTop, loc = locate(T);
    var pose = 'glide', rot = 0;
    if (loc.rest) pose = gates[loc.gate].pose;
    else {
      var sg = segs[loc.seg], dx = sg.x1 - sg.x0, dy = Math.max(1, sg.y1 - sg.y0);
      var u = (loc.t - sg.w) / (1 - sg.w), d = u > 0 && u < 1 ? 6 * u * (1 - u) / (1 - sg.w) : 0;
      var m = Math.abs(dx * d / dy), dirX = (dx > 0 ? 1 : -1) * dirY;
      if (m > 1.0) pose = 'b'; else if (m > 0.3) pose = 'a';
      if (m > 0.05) { flip = dirX > 0 ? -1 : 1; rot = clamp(dirX * Math.min(m, 1.6) * 8, -13, 13); }
      if (loc.seg === segs.length - 1 && loc.t > 0.94) pose = gates[gates.length - 1].pose;
    }
    setPose(pose);
    var feetVy = loc.y + mainTop - s;
    var x = loc.x - tw / 2, y = feetVy - th + Math.sin(s / 170) * 2.5;
    tv.style.transform = 'translate3d(' + (x - baseLeft).toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
    tv.firstElementChild.style.transform = 'rotate(' + rot.toFixed(2) + 'deg) scaleX(' + (loc.rest ? 1 : flip) + ')';
    tv.style.opacity = visibility(loc, feetVy).toFixed(3);
    tv.setAttribute('data-sc-verify-state', loc.seg + ':' + Math.round(loc.t * 20));
    return loc;
  }


  /* ---------- frame loop ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    var s = scrollY;
    if (s !== lastS) dirY = s > lastS ? 1 : -1;
    lastS = s;
    var T = s + vh * RIDE - mainTop;
    if (motion) {
      var hs = Math.min(s, vh * 1.3);
      if (art) art.style.transform = 'translate3d(0,' + (hs * 0.16).toFixed(1) + 'px,0)';
      if (phone) phone.style.transform = 'translate3d(0,' + (hs * -0.08).toFixed(1) + 'px,0)';
      var loc = placeTraveler(s);
      if (loc) paintTrack(loc);
    }
    paintDock(T);
  }
  function onScroll() { if (!ticking) { ticking = true; raf(frame); } }

  /* ---------- the reel plays only while it is on screen (and never under reduced motion) ---------- */
  var vid = document.querySelector('.reel video');
  if (vid && motion && 'IntersectionObserver' in window) {
    vid.removeAttribute('controls');
    new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) { var p = vid.play(); if (p && p.catch) p.catch(function () { vid.setAttribute('controls', ''); }); }
        else vid.pause();
      });
    }, { threshold: 0.35 }).observe(vid);
  }

  var pending = 0;
  function remeasure() { if (pending) return; pending = raf(function () { pending = 0; measure(); frame(); }); }
  function init() {
    if (motion && tv) doc.classList.add('glide');
    measure();
    frame();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    addEventListener('load', remeasure);
    // lazy images change layout as they arrive; the gates move with them
    document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') remeasure(); }, true);
    if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(main);
    doc.classList.add('sc-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
