// Turns a texttv.nu page (HTML spans) into a grid of teletext cells. The HTML
// is read as text and never inserted into the document. No DOM; tested in node.
(function (root) {
  'use strict';
  var COLS = 40;
  var ROWS = 25;
  var COLOURS = { Bl: 'black', bl: 'black', R: 'red', G: 'green', Y: 'yellow', B: 'blue', M: 'magenta', C: 'cyan', W: 'white' };
  var MOSAIC = /^https:\/\/l\.texttv\.nu\/storage\/chars\/\d+\.gif$/;
  var ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  var TOKEN = /<(\/?)(span|a|div)\b([^>]*)>|([^<]+)|<[^>]*>/g;

  function attr(attrs, name) {
    var m = new RegExp('\\b' + name + '\\s*=\\s*"([^"]*)"').exec(attrs);
    return m ? m[1] : '';
  }

  function decode(text) {
    return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, function (all, name) {
      if (name.charAt(0) === '#') {
        var code = name.charAt(1).toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return code > 0 && code < 0x10000 ? String.fromCharCode(code) : '';
      }
      return ENTITIES.hasOwnProperty(name.toLowerCase()) ? ENTITIES[name.toLowerCase()] : all;
    });
  }

  // Colours and mosaic from one span's attributes, on top of the enclosing style.
  function styleFrom(attrs, outer) {
    var style = { fg: outer.fg, bg: outer.bg, image: null };
    attr(attrs, 'class').split(/\s+/).forEach(function (name) {
      if (/^bg/.test(name) && COLOURS.hasOwnProperty(name.slice(2))) style.bg = COLOURS[name.slice(2)];
      else if (COLOURS.hasOwnProperty(name)) style.fg = COLOURS[name];
    });
    var url = /url\(([^)]+)\)/.exec(attr(attrs, 'style'));
    if (url && MOSAIC.test(url[1].replace(/['"]/g, ''))) style.image = url[1].replace(/['"]/g, '');
    return style;
  }

  function blankRow() {
    var row = { doubleHeight: false, cells: [] };
    for (var i = 0; i < COLS; i++) row.cells.push({ ch: ' ', fg: 'white', bg: 'black', image: null, link: null });
    return row;
  }

  // {rows: [{doubleHeight, cells: [{ch, fg, bg, image, link}]}]}, always ROWS x COLS.
  function parse(html) {
    var rows = [];
    var row = null;
    var col = 0;
    var stack = [{ fg: 'white', bg: 'black', image: null }];
    var link = null;
    var m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(html || '')) !== null) {
      if (m[4] !== undefined) {
        if (!row) continue;
        var style = stack[stack.length - 1];
        var text = decode(m[4]).replace(/[\r\n]/g, '');
        for (var i = 0; i < text.length && col < COLS; i++, col++) {
          row.cells[col] = { ch: style.image ? ' ' : text.charAt(i), fg: style.fg, bg: style.bg, image: style.image, link: link };
        }
      } else if (m[2] === 'span' && !m[1]) {
        var classes = ' ' + attr(m[3], 'class') + ' ';
        if (classes.indexOf(' line ') >= 0) {
          if (rows.length >= ROWS) break;
          row = blankRow();
          row.doubleHeight = classes.indexOf(' DH ') >= 0;
          rows.push(row);
          col = 0;
        }
        stack.push(styleFrom(m[3], stack[stack.length - 1]));
      } else if (m[2] === 'span' && m[1]) {
        if (stack.length > 1) stack.pop();
      } else if (m[2] === 'a') {
        var page = /^\/(\d{3})(?:-\d{3})?$/.exec(attr(m[3], 'href'));
        link = !m[1] && page ? +page[1] : null;
      }
    }
    while (rows.length < ROWS) rows.push(blankRow());
    return { rows: rows };
  }

  // The API's answer: [{num, content: [html...], next_page, prev_page, date_updated_unix}].
  function fromApi(data) {
    var p = Array.isArray(data) ? data[0] : null;
    if (!p || !Array.isArray(p.content) || !/^\d{3}$/.test(String(p.num))) return null;
    return {
      number: +p.num,
      next: /^\d{3}$/.test(String(p.next_page)) ? +p.next_page : null,
      previous: /^\d{3}$/.test(String(p.prev_page)) ? +p.prev_page : null,
      updated: (p.date_updated_unix | 0) * 1000,
      subpages: p.content.filter(function (c) { return typeof c === 'string'; }).map(parse)
    };
  }

  var DAYS = 'sön mån tis ons tor fre lör'.split(' ');
  var MONTHS = 'jan feb mar apr maj jun jul aug sep okt nov dec'.split(' ');

  function two(n) { return (n < 10 ? '0' : '') + n; }

  // The page with its top row replaced by a live header like a TV draws it:
  // the page number (or the digits being typed), the date and a ticking clock.
  function withHeader(page, label, now) {
    var parts = [
      [' P' + (label + '   ').slice(0, 3) + ' ', 'white'],
      ['SVT Text ', 'yellow'],
      [DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS[now.getMonth()], 'white']
    ];
    var clock = two(now.getHours()) + ':' + two(now.getMinutes()) + ':' + two(now.getSeconds());
    var row = blankRow();
    var col = 0;
    parts.forEach(function (part) {
      for (var i = 0; i < part[0].length && col < COLS; i++) row.cells[col++].ch = part[0].charAt(i);
      for (var j = col - part[0].length; j < col; j++) row.cells[j].fg = part[1];
    });
    for (var k = 0; k < clock.length; k++) {
      row.cells[COLS - clock.length - 1 + k] = { ch: clock.charAt(k), fg: 'yellow', bg: 'black', image: null, link: null };
    }
    return { rows: [row].concat(page.rows.slice(1)) };
  }

  var api = { COLS: COLS, ROWS: ROWS, parse: parse, fromApi: fromApi, withHeader: withHeader };
  root.TextTvPage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(this);
