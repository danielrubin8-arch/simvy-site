/* Simvy homepage: one slalom, drawn in advance, from the first phone to the second.
   Progressive enhancement only: every word is in the HTML. Without JS the hero curve is drawn
   and the avatar rests beside the second phone. With JS the whole slalom is drawn at once
   (smooth cubic curves, never revealed by scroll); with motion the avatar glides along it as
   the page scrolls and stops at the second phone. Reduced motion: the same drawing, the avatar
   already at the second phone. */
(function () {
  var doc = document.documentElement;
  var motion = doc.classList.contains('motion');
  var raf = window.requestAnimationFrame.bind(window);
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var main = document.getElementById('main');
  var svg = document.querySelector('.track');
  var tv = document.querySelector('.traveler');
  var stage = document.querySelector('.start__stage'), phone = document.querySelector('.start .phone');
  var reel = document.querySelector('.reel__frame'), copy = document.querySelector('.inside__copy');
  var dock = document.querySelector('.dock'), map = dock && dock.querySelector('.dock__map');
  var heroCta = document.querySelector('.start .badges'), finish = document.getElementById('download');
  var NS = 'http://www.w3.org/2000/svg';
  var RIDE = 0.52;      // while riding, the avatar's feet sit at this fraction of the viewport

  var vh = innerHeight, vw = doc.clientWidth, mainTop = 0, tw = 0, th = 0, baseLeft = 0, baseTop = 0;
  var gates = [], lastS = scrollY, dirY = 1, curPose = '';
  var line = null, samples = [], rideA = 0, rideB = 0;   // samples: [x, y] along the path in document space
  var poses = {};
  if (tv) [].forEach.call(tv.querySelectorAll('[data-pose]'), function (im) { poses[im.getAttribute('data-pose')] = im; });

  /* ---------- the route: turn points, then cubic Beziers with vertical tangents at each turn ---------- */
  function box(el) {
    var b = el.getBoundingClientRect(), m = main.getBoundingClientRect();
    return { l: b.left - m.left, r: b.right - m.left, t: b.top - m.top, b: b.bottom - m.top, w: b.width, h: b.height };
  }
  function route() {
    var P = box(phone), R = box(reel), S = box(stage), cx = (P.l + P.r) / 2;
    var pts = [], lead = null;
    var twoCol = copy && box(copy).r < R.l + 10 || (copy && box(copy).l > R.r - 10); // copy and reel side by side
    var roomL = P.l > tw * 1.3;                     // room beside the first phone for the avatar
    var start = roomL
      ? { x: P.l - Math.min(195, P.l * 0.46), y: S.t + S.h * 0.4 }
      : { x: Math.max(P.l + tw * 0.4, tw * 0.55), y: P.t };       // phones: he stands on the phone's top corner
    var endX = R.l > tw * 1.1 ? R.l - Math.min(R.l * 0.5, tw * 0.72) : tw * 0.55;
    var end = { x: Math.max(endX, tw * 0.5 + 4), y: R.t + R.h * 0.5 };
    if (roomL) lead = { x: cx, y: S.t - 40 };       // the hero sweep, from behind the phone
    if (twoCol) {
      // desktop: out to the open side, back in toward the first phone, out past the second phone's corner, home
      var span = end.y - start.y;
      var inX = Math.min(P.l - tw * 0.62, start.x + 150);
      var outX = Math.max(tw * 0.55, Math.min(R.l - tw * 0.85, start.x - 120));
      pts = [start, { x: inX, y: start.y + span * 0.36 }, { x: outX, y: start.y + span * 0.72 }, end];
    } else {
      // single column: a gentle wave in the lane at the open edge, then home beside the second phone
      var lane = Math.max(tw * 0.5 + 2, 30), sp = end.y - start.y, n = 3;
      pts = [start];
      for (var i = 1; i <= n; i++) pts.push({ x: lane + (i % 2 ? 0 : 16), y: start.y + sp * i / (n + 1) });
      pts.push(end);
    }
    var d = '', first = lead || pts[0];
    d = 'M' + first.x.toFixed(1) + ' ' + first.y.toFixed(1);
    if (lead) {
      // the same proportions as the hero curve that was there before
      var a = lead, b = pts[0], dx = b.x - a.x, dy = b.y - a.y;
      d += 'C' + [a.x + dx * 0.27, a.y + dy * 0.41, a.x + dx * 0.9, a.y + dy * 0.55, b.x, b.y].map(function (v) { return v.toFixed(1); }).join(' ');
    }
    for (var k = 1; k < pts.length; k++) {
      var p = pts[k - 1], q = pts[k], h = (q.y - p.y) * 0.55;
      d += 'C' + [p.x, p.y + h, q.x, q.y - h, q.x, q.y].map(function (v) { return v.toFixed(1); }).join(' ');
    }
    return { d: d, start: pts[0], end: end };
  }

  function buildTrack() {
    if (!svg || !phone || !reel || !stage) return;
    svg.innerHTML = '';
    svg.setAttribute('viewBox', '0 0 ' + main.clientWidth + ' ' + main.scrollHeight);
    svg.style.blockSize = main.scrollHeight + 'px';
    var r = route();
    var c2 = document.createElementNS(NS, 'path'), c1 = document.createElementNS(NS, 'path');
    c1.setAttribute('class', 'c1'); c2.setAttribute('class', 'c2');
    c1.setAttribute('d', r.d); c2.setAttribute('d', r.d); c2.setAttribute('transform', 'translate(6 0)');
    svg.appendChild(c2); svg.appendChild(c1);
    line = c1;
    // sample the drawn curve once; the avatar reads its position and tangent from these samples
    samples = [];
    var L = c1.getTotalLength(), n = Math.max(60, Math.ceil(L / 3));
    for (var i = 0; i <= n; i++) { var p = c1.getPointAtLength(L * i / n); samples.push([p.x, p.y + mainTop]); }
    rideA = r.start.y + mainTop; rideB = r.end.y + mainTop;
    doc.classList.add('track-on');
  }
  // the point on the curve at document height y (the route only ever descends)
  function at(y) {
    var lo = 0, hi = samples.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (samples[mid][1] < y) lo = mid; else hi = mid; }
    var a = samples[lo], b = samples[hi], t = b[1] > a[1] ? clamp((y - a[1]) / (b[1] - a[1]), 0, 1) : 0;
    var i0 = Math.max(0, lo - 2), i1 = Math.min(samples.length - 1, hi + 2);
    var tx = samples[i1][0] - samples[i0][0], ty = samples[i1][1] - samples[i0][1] || 1;
    return { x: a[0] + (b[0] - a[0]) * t, y: y, slope: tx / ty };
  }

  /* ---------- the avatar ---------- */
  function setPose(name) {
    if (!poses[name]) name = 'glide';
    if (name === curPose) return;
    curPose = name;
    for (var p in poses) poses[p].classList.toggle('on', p === name);
  }
  function placeTraveler(s) {
    if (!tv || !samples.length) return;
    var y = motion ? clamp(s + vh * RIDE, rideA, rideB) : rideB;
    var riding = y > rideA + 0.5 && y < rideB - 0.5;
    var p = at(y), pose = 'glide', rot = 0, flip = 1;
    if (riding) {
      var m = Math.abs(p.slope), dirX = (p.slope > 0 ? 1 : -1) * dirY;
      if (m > 1.0) pose = 'b'; else if (m > 0.35) pose = 'a';
      if (m > 0.06) { flip = dirX > 0 ? -1 : 1; rot = clamp(dirX * Math.min(m, 1.6) * 8, -13, 13); }
    }
    setPose(pose);
    var bob = riding ? Math.sin(s / 170) * 2 : 0;
    tv.style.transform = 'translate3d(' + (p.x - tw / 2 - baseLeft).toFixed(1) + 'px,' + (p.y - th - baseTop + bob).toFixed(1) + 'px,0)';
    tv.firstElementChild.style.transform = 'rotate(' + rot.toFixed(2) + 'deg) scaleX(' + flip + ')';
    tv.setAttribute('data-sc-verify-state', riding ? 'ride:' + Math.round((y - rideA) / (rideB - rideA) * 20) : (y >= rideB ? 'home' : 'start'));
  }

  /* ---------- the dock: the page in miniature ---------- */
  var ticks = [], me = null, runOn = null;
  function measureGates() {
    var mr = main.getBoundingClientRect();
    gates = [].slice.call(document.querySelectorAll('[data-gate]')).map(function (el) {
      var b = (el.querySelector('[data-gate-box]') || el).getBoundingClientRect();
      return { id: el.id, name: el.getAttribute('data-name') || '', y: b.top - mr.top };
    });
  }
  function frac(y) { var a = gates[0].y, b = gates[gates.length - 1].y; return b > a ? clamp((y - a) / (b - a), 0, 1) : 0; }
  function buildMap() {
    if (!map || !gates.length) return;
    map.innerHTML = ''; ticks = [];
    runOn = document.createElement('span'); runOn.className = 'run-on'; map.appendChild(runOn);
    var list = document.createElement('ol'); map.appendChild(list);
    gates.forEach(function (g) {
      var li = document.createElement('li'), a = document.createElement('a'), sp = document.createElement('span');
      a.href = '#' + g.id; sp.textContent = g.name; a.appendChild(sp); li.appendChild(a);
      li.style.insetInlineStart = (frac(g.y) * 100).toFixed(2) + '%';
      list.appendChild(li); ticks.push(a);
    });
    me = document.createElement('span'); me.className = 'me'; map.appendChild(me);
    map.hidden = false;
  }
  function paintDock(s) {
    if (!dock) return;
    var on = false;
    if (heroCta && finish) on = heroCta.getBoundingClientRect().bottom < 0 && finish.getBoundingClientRect().top > vh * 0.82;
    dock.classList.toggle('on', on);
    if (!me || !gates.length) return;
    var T = s + vh * RIDE - mainTop, f = frac(T);
    me.style.insetInlineStart = (f * 100).toFixed(2) + '%';
    runOn.style.inlineSize = (f * 100).toFixed(2) + '%';
    for (var i = 0; i < ticks.length; i++) ticks[i].classList.toggle('passed', T >= gates[i].y - 1);
  }

  function measure() {
    vh = innerHeight; vw = doc.clientWidth;
    if (phone) phone.style.transform = 'none'; // measure the phone where it rests, not where parallax put it
    mainTop = main.getBoundingClientRect().top + scrollY;
    if (tv) {
      tv.style.transform = 'none';
      var tr = tv.getBoundingClientRect();
      baseLeft = tr.left + scrollX; baseTop = tr.top + scrollY; tw = tr.width || 100; th = tr.height || 130;
    }
    buildTrack();
    measureGates();
    buildMap();
  }

  /* ---------- frame loop ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    var s = scrollY;
    if (s !== lastS) dirY = s > lastS ? 1 : -1;
    lastS = s;
    if (motion && phone) phone.style.transform = 'translate3d(0,' + (Math.min(s, vh * 1.3) * -0.05).toFixed(1) + 'px,0)';
    placeTraveler(s);
    paintDock(s);
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

  var pending = 0, lastW = -1, lastH = -1;
  function remeasure() { if (pending) return; pending = raf(function () { pending = 0; measure(); frame(); }); }
  function init() {
    if (tv) doc.classList.add('ride');
    measure();
    frame();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    addEventListener('load', remeasure);
    // lazy images change layout as they arrive; the phones move with them
    document.addEventListener('load', function (e) { if (e.target && e.target.tagName === 'IMG') remeasure(); }, true);
    if ('ResizeObserver' in window) new ResizeObserver(function () {
      // the URL bar on phones changes the height only; the route does not depend on it
      if (main.clientWidth !== lastW || Math.abs(main.scrollHeight - lastH) > 2) { lastW = main.clientWidth; lastH = main.scrollHeight; remeasure(); }
    }).observe(main);
    doc.classList.add('sc-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
