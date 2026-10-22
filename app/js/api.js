// Fetches SVT Text pages from the texttv.nu API (https://texttv.nu/blogg/texttv-api).
(function (root) {
  'use strict';
  var BASE = 'https://api.texttv.nu/api/get/';
  var APP_ID = 'hanzhe-nokia8110';  // the API asks callers to name their app
  var TIMEOUT_MS = 15000;
  var FRESH_MS = 30000;             // reuse a fetched page for this long

  function createClient(XHR, parse, now) {
    var cache = {};                 // number -> {page, at}

    // done(error, page). error is 'offline', 'missing' or 'bad'.
    function get(number, done, force) {
      var hit = cache[number];
      if (!force && hit && now() - hit.at < FRESH_MS) {
        done(null, hit.page);
        return;
      }
      var xhr = new XHR();
      xhr.open('GET', BASE + number + '?app=' + APP_ID);
      xhr.timeout = TIMEOUT_MS;
      xhr.onload = function () {
        if (xhr.status === 404) return done('missing');
        if (xhr.status !== 200) return done('offline');
        var page = null;
        try { page = parse(JSON.parse(xhr.responseText)); } catch (err) { page = null; }
        if (!page || !page.subpages.length) return done('missing');
        cache[number] = { page: page, at: now() };
        done(null, page);
      };
      xhr.onerror = xhr.ontimeout = function () { done('offline'); };
      xhr.send();
    }

    return { get: get };
  }

  var api = { createClient: createClient };
  root.TextTvApi = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(this);
