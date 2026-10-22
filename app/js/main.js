// Text-TV: SVT Text on the keypad. Type a page number, step with the arrows.
(function () {
  'use strict';
  var START = 100;
  var REFRESH_MS = 60000;
  var SUBPAGE_MS = 15000;           // subpages turn over by themselves, like on TV
  var TYPE_TIMEOUT_MS = 4000;
  var LAST_PAGE = 'texttv.page';
  var ZOOMS = ['full', 'top', 'bottom'];
  var ZOOM_ROWS = 13;               // rows shown when zoomed: 0-12 or 12-24

  var screenEl = document.getElementById('screen');
  var page = document.createElement('canvas');   // the full page, drawn off screen
  var statusEl = document.getElementById('status');
  var view = screenEl.getContext('2d');
  var client = TextTvApi.createClient(XMLHttpRequest, TextTvPage.fromApi, Date.now);
  var renderer = TextTvRender.createRenderer(page, function () { draw(); });

  var state = {
    page: null,                     // from TextTvPage.fromApi
    subpage: 0,
    wanted: START,                  // the page being fetched or shown
    typed: '',
    zoom: 0,
    history: [],
    message: ''
  };
  var timers = { refresh: null, subpage: null, typing: null };

  page.width = TextTvPage.COLS * TextTvRender.CELL_W;
  page.height = TextTvPage.ROWS * TextTvRender.CELL_H;

  function setStatus(text) {
    state.message = text;
    statusEl.textContent = text;
  }

  function subpageLabel() {
    var n = state.page ? state.page.subpages.length : 0;
    return n > 1 ? (state.subpage + 1) + '/' + n : '';
  }

  function headerLabel() {
    return state.typed ? (state.typed + '--').slice(0, 3) : String(state.wanted);
  }

  function draw() {
    if (!state.page) return;
    var grid = state.page.subpages[state.subpage] || state.page.subpages[0];
    renderer.draw(TextTvPage.withHeader(grid, headerLabel(), new Date()));
    var zoom = ZOOMS[state.zoom];
    var rowH = TextTvRender.CELL_H;
    var top = zoom === 'bottom' ? (TextTvPage.ROWS - ZOOM_ROWS) * rowH : 0;
    var height = zoom === 'full' ? page.height : ZOOM_ROWS * rowH;
    view.imageSmoothingEnabled = false;
    view.mozImageSmoothingEnabled = false;
    view.drawImage(page, 0, top, page.width, height, 0, 0, screenEl.width, screenEl.height);
    if (!state.message) statusEl.textContent = subpageLabel();
  }

  function remember(number) {
    try { localStorage.setItem(LAST_PAGE, String(number)); } catch (err) { /* only the start page is lost */ }
  }

  function lastPage() {
    var n = 0;
    try { n = +localStorage.getItem(LAST_PAGE); } catch (err) { n = 0; }
    return n >= 100 && n <= 899 ? n : START;
  }

  function scheduleSubpages() {
    clearInterval(timers.subpage);
    if (!state.page || state.page.subpages.length < 2) return;
    timers.subpage = setInterval(function () {
      state.subpage = (state.subpage + 1) % state.page.subpages.length;
      draw();
    }, SUBPAGE_MS);
  }

  function show(number, options) {
    var opts = options || {};
    if (state.page && number !== state.page.number && !opts.back) {
      state.history.push(state.page.number);
    }
    state.wanted = number;
    setStatus(opts.quiet ? state.message : 'Söker ' + number + '…');
    draw();
    client.get(number, function (error, result) {
      if (state.wanted !== number) return;   // a newer request took over
      if (error) {
        setStatus(error === 'missing' ? 'Sidan ' + number + ' finns inte' : 'Ingen anslutning');
        if (state.page) state.wanted = state.page.number;
        draw();
        return;
      }
      var same = state.page && state.page.number === result.number;
      state.page = result;
      state.subpage = same ? Math.min(state.subpage, result.subpages.length - 1) : 0;
      if (!same) state.zoom = 0;
      setStatus('');
      remember(number);
      scheduleSubpages();
      draw();
    }, opts.force);
  }

  function refresh() {
    if (state.page) show(state.page.number, { quiet: true, force: true });
  }

  function typeDigit(d) {
    if (!state.typed && (d === '0' || d === '9')) return;   // pages run 100-899
    state.typed += d;
    clearTimeout(timers.typing);
    if (state.typed.length === 3) {
      var n = +state.typed;
      state.typed = '';
      show(n);
      return;
    }
    timers.typing = setTimeout(function () { state.typed = ''; draw(); }, TYPE_TIMEOUT_MS);
    draw();
  }

  function step(dir) {
    if (!state.page) return show(START);
    var target = dir > 0 ? state.page.next : state.page.previous;
    if (target && target !== state.page.number) show(target);
  }

  function turnSubpage(dir) {
    var n = state.page ? state.page.subpages.length : 0;
    if (n < 2) return;
    state.subpage = (state.subpage + dir + n) % n;
    scheduleSubpages();
    draw();
  }

  function back() {
    if (state.typed) {
      state.typed = state.typed.slice(0, -1);
      draw();
      return true;
    }
    var previous = state.history.pop();
    if (previous === undefined) return false;
    show(previous, { back: true });
    return true;
  }

  function onKey(e) {
    var key = e.key;
    if (/^\d$/.test(key)) typeDigit(key);
    else if (key === 'ArrowLeft') step(-1);
    else if (key === 'ArrowRight') step(1);
    else if (key === 'ArrowUp') turnSubpage(-1);
    else if (key === 'ArrowDown') turnSubpage(1);
    else if (key === 'Enter') refresh();
    else if (key === 'SoftLeft') show(START);
    else if (key === 'SoftRight') {
      state.zoom = (state.zoom + 1) % ZOOMS.length;
      draw();
    } else if (key === 'Backspace') {
      if (!back()) return;          // nothing to go back to: let Back close the app
    } else return;
    e.preventDefault();
  }

  function onVisibility() {
    clearInterval(timers.refresh);
    if (document.hidden) return;
    refresh();
    timers.refresh = setInterval(refresh, REFRESH_MS);
  }

  function start() {
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVisibility);
    setInterval(draw, 1000);        // the clock in the header
    timers.refresh = setInterval(function () { if (!document.hidden) refresh(); }, REFRESH_MS);
    show(lastPage());
  }

  // Draw only once Bedstead has loaded, or the first page shows in a fallback font.
  if (document.fonts && document.fonts.load) {
    document.fonts.load('10px Bedstead').then(start, start);
  } else {
    start();
  }
})();
