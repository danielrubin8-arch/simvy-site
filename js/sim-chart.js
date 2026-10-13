/* Simvy simulator page: candle chart renderer.
   Pure string output, shared by the page (re-render when the visitor moves the stop)
   and by the build step that inlines the static fallback for JS-off and reduced motion.
   Data rows: [date "YYYY-MM-DD", open, high, low, close]. */
(function (root) {
  var PMIN = 126, PMAX = 184;
  var MONTHS = { "07": "יולי", "08": "אוגוסט", "09": "ספטמבר", "10": "אוקטובר" };

  function fx(n) { return Math.round(n * 10) / 10; }
  function money(n) { return n.toFixed(2); }

  function model(d, stop, entryIdx, target) {
    var entry = d[entryIdx][4], exitIdx = -1, i;
    for (i = entryIdx + 1; i < d.length; i++) { if (d[i][3] <= stop) { exitIdx = i; break; } }
    var exitPrice = exitIdx > -1 ? Math.min(stop, d[exitIdx][1]) : null;
    var lowIdx = -1;
    if (exitIdx > -1) {
      for (i = exitIdx + 1; i < d.length; i++) { if (lowIdx < 0 || d[i][4] < d[lowIdx][4]) lowIdx = i; }
    }
    var hiIdx = entryIdx;
    for (i = entryIdx; i < (exitIdx > -1 ? exitIdx : d.length); i++) { if (d[i][2] > d[hiIdx][2]) hiIdx = i; }
    return { entry: entry, entryIdx: entryIdx, stop: stop, target: target, exitIdx: exitIdx,
             exitPrice: exitPrice, lowIdx: lowIdx, hiIdx: hiIdx };
  }

  function render(d, o) {
    // o: { stop, entryIdx, target, upto (last candle drawn in static markup), id, title }
    var m = model(d, o.stop, o.entryIdx, o.target);
    var K = o.k || 1, W = o.w || 1000, H = o.h || 600, X0 = 12, X1 = W - Math.round(116 * K), Y0 = Math.round(26 * K), Y1 = H - Math.round(34 * K);
    var FS = ' font-size="' + Math.round(15 * K) + '"';
    var n = d.length, step = (X1 - X0) / n, bw = Math.max(3, step * 0.62);
    var x = function (i) { return X0 + step * (i + 0.5); };
    var y = function (p) { return Y0 + (PMAX - p) / (PMAX - PMIN) * (Y1 - Y0); };
    var upto = o.upto == null ? n - 1 : o.upto;
    var s = [];
    s.push('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-labelledby="' + o.id + '-t" direction="ltr" preserveAspectRatio="xMidYMid meet">');
    s.push('<title id="' + o.id + '-t">' + o.title + '</title>');
    // grid
    s.push('<g class="grid">');
    for (var p = 130; p <= 180; p += 10) {
      s.push('<line x1="' + X0 + '" x2="' + X1 + '" y1="' + fx(y(p)) + '" y2="' + fx(y(p)) + '"/>');
      s.push('<text class="ax"' + FS + ' x="' + (X1 + 12) + '" y="' + fx(y(p) + 5 * K) + '">' + p + '</text>');
    }
    var lastM = "";
    for (var k = 0; k < n; k++) {
      var mm = d[k][0].slice(5, 7);
      if (mm !== lastM) {
        if (lastM) {
          s.push('<line class="mtick" x1="' + fx(x(k) - step / 2) + '" x2="' + fx(x(k) - step / 2) + '" y1="' + Y0 + '" y2="' + Y1 + '"/>');
          s.push('<text class="ax mlabel"' + FS + ' x="' + fx(x(k) - step / 2 + 8) + '" y="' + (Y1 + Math.round(26 * K)) + '" text-anchor="end" direction="rtl">' + MONTHS[mm] + '</text>');
        }
        lastM = mm;
      }
    }
    s.push('</g>');
    // candles
    s.push('<g class="candles">');
    var last = o.only ? upto : n - 1;
    for (var i = 0; i <= last; i++) {
      var r = d[i], up = r[4] >= r[1], top = y(Math.max(r[1], r[4])), bot = y(Math.min(r[1], r[4]));
      var cls = 'c ' + (up ? 'up' : 'dn') + (m.exitIdx > -1 && i > m.exitIdx ? ' after' : '') + (i > upto ? ' off' : '');
      s.push('<g class="' + cls + '" data-i="' + i + '"><line x1="' + fx(x(i)) + '" x2="' + fx(x(i)) + '" y1="' + fx(y(r[2])) + '" y2="' + fx(y(r[3])) + '"/>' +
        '<rect x="' + fx(x(i) - bw / 2) + '" y="' + fx(top) + '" width="' + fx(bw) + '" height="' + fx(Math.max(1.5, bot - top)) + '" rx="1"/></g>');
    }
    s.push('</g>');
    // order lines
    var xe = x(m.entryIdx), xEnd = m.exitIdx > -1 ? x(m.exitIdx) : X1;
    var lab = function (cls, yy, txt) {
      return '<g class="lab ' + cls + '"><rect x="' + (X1 + 4) + '" y="' + fx(yy - 15 * K) + '" width="' + Math.round(112 * K) + '" height="' + Math.round(30 * K) + '" rx="8"/>' +
        '<text' + FS + ' x="' + fx(X1 + 4 + 56 * K) + '" y="' + fx(yy + 5.5 * K) + '" text-anchor="middle" direction="rtl">' + txt + '</text></g>';
    };
    s.push('<g class="order">');
    var xStopEnd = (m.exitIdx > -1 && upto >= m.exitIdx) ? xEnd : X1;
    s.push('<line class="ln target" x1="' + fx(xe) + '" x2="' + fx(xStopEnd) + '" y1="' + fx(y(m.target)) + '" y2="' + fx(y(m.target)) + '"/>');
    s.push('<line class="ln stop" x1="' + fx(xe) + '" x2="' + fx(xStopEnd) + '" y1="' + fx(y(m.stop)) + '" y2="' + fx(y(m.stop)) + '"/>');
    s.push('<line class="ln pos" x1="' + fx(xe) + '" x2="' + fx(upto >= m.exitIdx && m.exitIdx > -1 ? xEnd : x(Math.max(upto, m.entryIdx))) + '" y1="' + fx(y(m.entry)) + '" y2="' + fx(y(m.entry)) + '" data-x0="' + fx(xe) + '" data-step="' + fx(step) + '" data-exit="' + fx(xEnd) + '" data-x1="' + X1 + '"/>');
    s.push(lab('target', y(m.target), 'יעד ' + m.target));
    s.push(lab('entry', y(m.entry), 'כניסה ' + money(m.entry)));
    s.push(lab('stop', y(m.stop), 'סטופ ' + m.stop));
    s.push('<circle class="dot entry" cx="' + fx(xe) + '" cy="' + fx(y(m.entry)) + '" r="' + fx(6 * K) + '"/>');
    s.push('</g>');
    // exit and what came after
    if (m.exitIdx > -1) {
      var xl = x(m.lowIdx), yl = y(d[m.lowIdx][4]), ys = y(m.stop);
      s.push('<g class="exit' + (upto >= m.exitIdx ? '' : ' off') + '">' +
        '<circle class="ring" cx="' + fx(xEnd) + '" cy="' + fx(ys) + '" r="' + fx(15 * K) + '"/>' +
        '<circle class="dot" cx="' + fx(xEnd) + '" cy="' + fx(ys) + '" r="' + fx(7 * K) + '"/></g>');
      s.push('<g class="fall' + (upto >= m.lowIdx ? '' : ' off') + '">' +
        '<line x1="' + fx(xl) + '" x2="' + fx(xl) + '" y1="' + fx(ys) + '" y2="' + fx(yl) + '"/>' +
        '<line class="cap" x1="' + fx(xl - 9) + '" x2="' + fx(xl + 9) + '" y1="' + fx(yl) + '" y2="' + fx(yl) + '"/>' +
        '<text font-size="' + Math.round(16 * K) + '" x="' + fx(xl) + '" y="' + fx(yl + 30 * K) + '" text-anchor="middle">' + money(d[m.lowIdx][4]) + '</text></g>');
    }
    s.push('</svg>');
    return { svg: s.join(''), model: m, geo: { W: W, H: H, Y0: Y0, Y1: Y1, PMIN: PMIN, PMAX: PMAX } };
  }

  var api = { render: render, model: model };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SimChart = api;
})(this);
