/* guides: the contents column lights the chapter being read and shows its short answer.
   The article reads the same without this file. */
(function () {
  var doc = document.documentElement;
  var chaps = [].slice.call(document.querySelectorAll('.chap, #faq'));
  var items = {};
  [].forEach.call(document.querySelectorAll('.toc a'), function (a) { items[a.getAttribute('href').slice(1)] = a.parentNode; });
  if (chaps.length && 'IntersectionObserver' in window) {
    var on = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var li = items[e.target.id];
        if (!li || li === on) return;
        if (on) { on.classList.remove('on'); on.firstChild.removeAttribute('aria-current'); }
        on = li;
        on.classList.add('on');
        on.firstChild.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-25% 0px -70% 0px' });
    chaps.forEach(function (c) { io.observe(c); });
  }
  doc.classList.add('sc-ready');
})();
