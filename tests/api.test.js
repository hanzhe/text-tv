'use strict';
var test = require('node:test');
var assert = require('node:assert');
var A = require('../app/js/api.js');
var P = require('../app/js/page.js');
var fixture = JSON.stringify(require('./fixtures/101.json'));

function fakeXHR(log, answer) {
  return function () {
    var x = this;
    x.open = function (method, url) { log.push(url); };
    x.send = function () {
      var a = answer();
      if (a === 'error') return x.onerror();
      x.status = a.status;
      x.responseText = a.body;
      x.onload();
    };
  };
}

test('pages are fetched once, then reused while fresh', function () {
  var log = [];
  var clock = 0;
  var c = A.createClient(fakeXHR(log, function () { return { status: 200, body: fixture }; }), P.fromApi, function () { return clock; });
  var got = [];
  c.get(101, function (e, p) { got.push(e || p.number); });
  c.get(101, function (e, p) { got.push(e || p.number); });
  clock = 31000;
  c.get(101, function (e, p) { got.push(e || p.number); });
  c.get(101, function (e, p) { got.push(e || p.number); }, true);
  assert.deepStrictEqual(got, [101, 101, 101, 101]);
  assert.strictEqual(log.length, 3);
  assert.ok(/^https:\/\/api\.texttv\.nu\/api\/get\/101\?app=/.test(log[0]));
});

test('errors say whether the page is missing or the network is down', function () {
  var answers = [{ status: 404, body: '' }, 'error', { status: 200, body: 'not json' }, { status: 500, body: '' }];
  var c = A.createClient(fakeXHR([], function () { return answers.shift(); }), P.fromApi, Date.now);
  var got = [];
  for (var i = 0; i < 4; i++) c.get(900 + i, function (e) { got.push(e); });
  assert.deepStrictEqual(got, ['missing', 'offline', 'missing', 'offline']);
});
