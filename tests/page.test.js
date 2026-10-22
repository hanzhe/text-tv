'use strict';
var test = require('node:test');
var assert = require('node:assert');
var P = require('../app/js/page.js');

function text(row) { return row.cells.map(function (c) { return c.image ? '#' : c.ch; }).join(''); }
function load(n) { return P.fromApi(require('./fixtures/' + n + '.json')); }

test('a page parses to 25 rows of 40 cells with its neighbours', function () {
  var p = load(377);
  assert.deepStrictEqual([p.number, p.previous, p.next, p.subpages.length], [377, 376, 378, 1]);
  var rows = p.subpages[0].rows;
  assert.strictEqual(rows.length, 25);
  rows.forEach(function (r) { assert.strictEqual(r.cells.length, 40); });
  assert.strictEqual(text(rows[4]), ' Björklöven   - Malmö                2-4');
});

test('colours, double height, mosaics and links are kept', function () {
  var rows = load(100).subpages[0].rows;
  var headline = rows[6];
  assert.ok(headline.doubleHeight);
  assert.strictEqual(headline.cells[2].fg, 'yellow');
  assert.strictEqual(rows[1].cells[4].bg, 'blue');
  assert.ok(/^https:\/\/l\.texttv\.nu\/storage\/chars\/\d+\.gif$/.test(rows[1].cells[4].image));
  var linked = rows[22].cells.filter(function (c) { return c.link; }).map(function (c) { return c.link; });
  assert.deepStrictEqual(linked.filter(function (n, i) { return linked.indexOf(n) === i; }), [101, 104, 700]);
});

test('entities decode, and markup outside the format is ignored', function () {
  var page = P.parse('<div><span class="line"><span class="bgR Y">A&amp;B &#246; &lt;</span>' +
    '<script>x</script><img src=x onerror=alert(1)>' +
    '<span class="bgImg" style="background: url(https://evil.example/x.gif)"> </span></span></div>');
  var row = page.rows[0];
  assert.strictEqual(text(row).slice(0, 7), 'A&B ö <');
  assert.strictEqual(row.cells[0].bg, 'red');
  assert.strictEqual(row.cells[0].fg, 'yellow');
  assert.strictEqual(text(row).slice(7, 9), 'x ', 'the script text is just text');
  assert.strictEqual(row.cells[8].image, null, 'only texttv.nu mosaics are loaded');
});

test('broken answers give no page', function () {
  assert.strictEqual(P.fromApi(null), null);
  assert.strictEqual(P.fromApi([{ num: 'abc', content: [] }]), null);
  assert.strictEqual(P.fromApi([{ num: '100' }]), null);
  assert.strictEqual(P.parse('').rows.length, 25);
});

test('the header shows the page, date and a ticking clock', function () {
  var p = load(100).subpages[0];
  var h = P.withHeader(p, '12-', new Date(2026, 9, 23, 9, 5, 7));
  assert.strictEqual(text(h.rows[0]), ' P12- SVT Text fre 23 okt      09:05:07 ');
  assert.strictEqual(h.rows[0].cells[6].fg, 'yellow');
  assert.strictEqual(h.rows[1], p.rows[1]);
  assert.notStrictEqual(text(p.rows[0]), text(h.rows[0]), 'the page itself is unchanged');
});
