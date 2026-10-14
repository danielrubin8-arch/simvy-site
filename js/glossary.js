/* glossary pages: live filter, thumb index state, hits in the other dictionaries.
   Everything is readable without this file; it only narrows what is already there. */
(function () {
  var doc = document.documentElement;
  var root = document.querySelector('.lex');
  if (!root) { doc.classList.add('sc-ready'); return; }
  var input = document.getElementById('q');
  var count = document.querySelector('.find__n');
  var none = document.querySelector('.g-none');
  var elsewhere = document.querySelector('.elsewhere');
  var letters = [].slice.call(root.querySelectorAll('.letter'));
  var tabs = {};
  [].forEach.call(document.querySelectorAll('.abc a'), function (a) { tabs[a.getAttribute('href').slice(1)] = a; });
  var here = location.pathname.replace(/^\//, '') || 'glossary.html';
  if (here === '' || here === 'glossary') here = 'glossary.html';

  // fold: lower case, no niqqud, no quote marks, collapsed spaces
  function fold(s) {
    return s.toLowerCase().replace(/[֑-ׇ]/g, '').replace(/["'׳״‘’“”]/g, '').replace(/\s+/g, ' ').trim();
  }
  var rows = letters.map(function (sec) {
    var label = sec.querySelector('.letter__h span');
    return {
      sec: sec,
      label: label,
      orig: label ? label.textContent : '',
      terms: [].map.call(sec.querySelectorAll('.term'), function (t) {
        var dt = t.querySelector('dt');
        return { el: t, see: t.classList.contains('term--see'), name: fold(dt.textContent), all: fold(t.textContent) };
      })
    };
  });
  var total = rows.reduce(function (n, r) { return n + r.terms.filter(function (t) { return !t.see; }).length; }, 0);

  var index = null, loading = false;
  function loadIndex(then) {
    if (index || loading) { if (index && then) then(); return; }
    loading = true;
    fetch('/glossary-index.json').then(function (r) { return r.json(); }).then(function (d) {
      index = d.map(function (e) { e.f = fold(e.t); return e; });
      loading = false;
      if (then) then();
    }).catch(function () { loading = false; });
  }

  function renderElsewhere(q) {
    if (!elsewhere) return;
    elsewhere.textContent = '';
    if (!index || q.length < 2) return;
    var hits = index.filter(function (e) { return e.p !== here && e.f.indexOf(q) > -1; });
    hits.sort(function (a, b) { return (a.f.indexOf(q) === 0 ? 0 : 1) - (b.f.indexOf(q) === 0 ? 0 : 1); });
    if (!hits.length) return;
    var p = document.createElement('p');
    p.textContent = 'במילונים האחרים (' + hits.length + '):';
    var ul = document.createElement('ul');
    hits.slice(0, 12).forEach(function (e) {
      var li = document.createElement('li'), a = document.createElement('a'), s = document.createElement('span'), b = document.createElement('bdi');
      a.href = '/' + e.p + '#' + e.a;
      b.textContent = e.t;
      s.textContent = ' · ' + e.c;
      a.appendChild(b); a.appendChild(s); li.appendChild(a); ul.appendChild(li);
    });
    elsewhere.appendChild(p); elsewhere.appendChild(ul);
  }

  function apply() {
    var q = fold(input.value);
    var shown = 0, shownAny = 0;
    rows.forEach(function (r) {
      var n = 0, any = 0;
      r.terms.forEach(function (t) {
        var hit = !q || t.all.indexOf(q) > -1;
        t.el.hidden = !hit;
        if (hit) { any++; if (!t.see) n++; }
      });
      r.sec.hidden = any === 0;
      if (r.label) r.label.textContent = !q ? r.orig : n === 0 ? 'הפניה' : n === 1 ? 'מונח אחד' : n + ' מונחים';
      var tab = tabs[r.sec.id];
      if (tab) {
        tab.classList.toggle('off', any === 0);
        if (any === 0) tab.setAttribute('aria-disabled', 'true'); else tab.removeAttribute('aria-disabled');
      }
      shown += n; shownAny += any;
    });
    if (none) none.hidden = shownAny > 0;
    count.textContent = q ? (shown === 0 ? 'אין התאמה בעמוד הזה' : shown === 1 ? 'מונח אחד בעמוד הזה' : shown + ' מונחים בעמוד הזה') : total + ' מונחים בעמוד הזה';
    if (q.length >= 2) loadIndex(function () { renderElsewhere(fold(input.value)); }); else renderElsewhere('');
    try { history.replaceState(null, '', q ? '?q=' + encodeURIComponent(input.value) : location.pathname + location.hash); } catch (e) {}
  }

  if (input) {
    var t0;
    input.addEventListener('input', function () { clearTimeout(t0); t0 = setTimeout(apply, 90); });
    input.addEventListener('focus', function () { loadIndex(); }, { once: true });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; apply(); } });
    var m = /[?&]q=([^&]*)/.exec(location.search);
    if (m) { input.value = decodeURIComponent(m[1].replace(/\+/g, ' ')); apply(); }
    else count.textContent = total + ' מונחים בעמוד הזה';
  }

  // thumb index: light the letter being read
  if ('IntersectionObserver' in window) {
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          if (current) current.removeAttribute('aria-current');
          current = tabs[e.target.id] || null;
          if (current) {
            current.setAttribute('aria-current', 'true');
            var strip = current.closest('ol');
            if (strip && strip.scrollWidth > strip.clientWidth + 2) {
              var r = current.getBoundingClientRect(), s = strip.getBoundingClientRect();
              if (r.left < s.left || r.right > s.right) strip.scrollBy({ left: r.left - s.left - s.width / 2 + r.width / 2, behavior: 'auto' });
            }
          }
        }
      });
    }, { rootMargin: '-30% 0px -65% 0px' });
    letters.forEach(function (l) { io.observe(l); });
  }
  doc.classList.add('sc-ready');
})();
