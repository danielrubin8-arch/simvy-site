/* Simvy courses page. Progressive enhancement only: every word is in the HTML,
   and without JS (or with reduced motion) the page is complete and static. */
(function () {
  var doc = document.documentElement;
  var motion = doc.classList.contains('motion');
  var raf = window.requestAnimationFrame.bind(window);
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var smooth = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var vh = innerHeight, vw = doc.clientWidth;

  /* ---------- the lesson walk: the rail pans one frame at a time ---------- */
  var walk = document.getElementById('lesson');
  var stage = walk && walk.querySelector('.walk__stage');
  var rail = walk && walk.querySelector('.walk__rail');
  var track = walk && walk.querySelector('.walk__track');
  var frames = walk ? [].slice.call(walk.querySelectorAll('.frame')) : [];
  var steps = walk ? [].slice.call(walk.querySelectorAll('.walk__list li')) : [];
  // the phone dims to .38; its caption only to .78 so the text keeps 4.5:1 contrast
  var phones = frames.map(function (f) { return f.querySelector('.frame__phone'); });
  var caps = frames.map(function (f) { return f.querySelector('figcaption'); });
  var centers = [], railMid = 0, pinned = false, lastWalk = '';
  function measureWalk() {
    if (!track) return;
    track.style.transform = 'none';
    for (var i = 0; i < frames.length; i++) frames[i].style.transform = '';
    pinned = motion && vw >= 900;
    var rr = rail.getBoundingClientRect();
    railMid = rr.left + rr.width / 2;
    centers = frames.map(function (f) { var r = f.getBoundingClientRect(); return r.left + r.width / 2; });
    lastWalk = '';
  }
  function applyWalk() {
    if (!pinned || !walk) return;
    var r = walk.getBoundingClientRect(), span = walk.offsetHeight - vh;
    var p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
    // hold on each frame, travel between them
    var raw = clamp((p - 0.06) / 0.86, 0, 1) * (frames.length - 1);
    var i = Math.min(Math.floor(raw), frames.length - 2), fr = raw - i;
    var f = i + smooth((fr - 0.18) / 0.64);
    var a = Math.floor(f), b = Math.min(a + 1, frames.length - 1), t = f - a;
    var cx = centers[a] + (centers[b] - centers[a]) * t;
    var shift = railMid - cx;
    var sig = shift.toFixed(0);
    if (sig === lastWalk) return;
    lastWalk = sig;
    track.style.transform = 'translate3d(' + shift.toFixed(1) + 'px,0,0)';
    for (var k = 0; k < frames.length; k++) {
      var d = Math.min(Math.abs(f - k), 1);
      frames[k].style.transform = 'scale(' + (1 - d * 0.14).toFixed(3) + ')';
      if (phones[k]) phones[k].style.opacity = (1 - d * 0.62).toFixed(3);
      if (caps[k]) caps[k].style.opacity = (1 - d * 0.22).toFixed(3);
    }
    var cur = Math.round(f);
    for (var s = 0; s < steps.length; s++) steps[s].classList.toggle('on', +steps[s].getAttribute('data-step') === cur);
    if (stage) { stage.setAttribute('data-sc-verify-state', sig); stage.setAttribute('data-sc-verify-hold', Math.abs(f - Math.round(f)) < 0.002 ? 'true' : 'false'); }
  }

  /* ---------- the catalogue: index, reading record, rider ---------- */
  var plates = [].slice.call(document.querySelectorAll('[data-plate]'));
  var index = document.querySelector('.index');
  var strip = index && index.querySelector('ol');
  var links = {};
  if (index) [].forEach.call(index.querySelectorAll('a[data-for]'), function (a) { links[a.getAttribute('data-for')] = a; });
  var current = null;
  function readPlates() {
    var line = vh * 0.38, found = null;
    for (var i = 0; i < plates.length; i++) {
      var r = plates[i].getBoundingClientRect();
      var fill = clamp((line - r.top) / Math.max(r.height, 1), 0, 1);
      var a = links[plates[i].id];
      if (a) a.style.setProperty('--fill', fill.toFixed(3));
      if (r.top <= line) found = plates[i];
    }
    var cat = document.getElementById('catalog');
    if (cat && cat.getBoundingClientRect().bottom < line) found = null;
    if (found !== current) {
      current = found;
      for (var id in links) {
        if (current && id === current.id) links[id].setAttribute('aria-current', 'true'); else links[id].removeAttribute('aria-current');
      }
      if (current && links[current.id] && strip && vw < 1100) {
        var lr = links[current.id].getBoundingClientRect(), sr = strip.getBoundingClientRect();
        strip.scrollBy({ left: (lr.left + lr.width / 2) - (sr.left + sr.width / 2), behavior: motion ? 'smooth' : 'auto' });
      }
    }
  }

  // the rider stands at the current course and hops along the index to the next one
  var rider = document.querySelector('.rider');
  var poses = rider ? { glide: rider.querySelector('[data-pose="glide"]'), a: rider.querySelector('[data-pose="a"]'), b: rider.querySelector('[data-pose="b"]') } : {};
  var ry = 0, rv = 0, rTarget = 0, rOn = false, rLoop = false, curPose = '';
  function setPose(n) { if (n === curPose) return; curPose = n; for (var p in poses) if (poses[p]) poses[p].classList.toggle('on', p === n); }
  function riderTarget() {
    var a = current ? links[current.id] : null;
    if (!a) a = links['course-1'];
    if (!a) return 0;
    return a.offsetTop + a.offsetHeight / 2 - rider.offsetHeight * 0.62;
  }
  function stepRider() {
    rLoop = false;
    if (!rOn) return;
    rTarget = riderTarget();
    var force = (rTarget - ry) * 0.075;
    rv = (rv + force) * 0.78;
    ry += rv;
    var sp = Math.abs(rv);
    setPose(sp > 5 ? 'b' : sp > 1.2 ? 'a' : 'glide');
    var hop = -Math.min(sp * 2.2, 26);
    var rot = clamp(rv * 1.4, -14, 14);
    rider.style.transform = 'translate3d(0,' + (ry + hop).toFixed(1) + 'px,0)';
    rider.firstElementChild.style.transform = 'rotate(' + rot.toFixed(2) + 'deg) scaleX(' + (rv < 0 ? -1 : 1) + ')';
    if (Math.abs(rTarget - ry) > 0.4 || sp > 0.05) { rLoop = true; raf(stepRider); }
  }
  function kickRider() { if (rOn && !rLoop) { rLoop = true; raf(stepRider); } }

  /* ---------- plates tick in as they arrive ---------- */
  plates.forEach(function (p) {
    var li = p.querySelectorAll('.lessons li');
    for (var i = 0; i < li.length; i++) li[i].style.setProperty('--i', Math.min(i, 14));
  });
  if ('IntersectionObserver' in window && motion) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0 });
    plates.forEach(function (p) { io.observe(p); });
  } else plates.forEach(function (p) { p.classList.add('in'); });

  /* ---------- frame loop ---------- */
  var ticking = false;
  function frame() {
    ticking = false;
    applyWalk();
    readPlates();
    kickRider();
  }
  function onScroll() { if (!ticking) { ticking = true; raf(frame); } }
  function measure() {
    vh = innerHeight; vw = doc.clientWidth;
    rOn = !!rider && motion && vw >= 1100;
    doc.classList.toggle('glide', rOn);
    measureWalk();
    if (rOn) { ry = riderTarget(); rv = 0; }
  }
  function init() {
    doc.classList.add('sc-ready');
    measure();
    frame();
    if (rOn) { setPose('glide'); stepRider(); }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { measure(); frame(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); frame(); });
    addEventListener('load', function () { measure(); frame(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
