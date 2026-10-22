// Draws a parsed page (js/page.js) on a canvas: 40x25 cells of 6x12 pixels,
// text in Bedstead (the SAA5050 teletext font), mosaics from texttv.nu's images.
(function (root) {
  'use strict';
  var CELL_W = 6;
  var CELL_H = 12;
  var FONT_PX = 10;                 // Bedstead's 6x10 cell; stretched to 6x12
  var FONT = FONT_PX + 'px Bedstead';
  var BASELINE = 8;                 // font pixels from the top of the cell
  var RGB = {
    black: '#000', red: '#fc0304', green: '#0f0', yellow: '#fcfe01',
    blue: '#00f', magenta: '#fc03fd', cyan: '#00c8ee', white: '#fcfefc'
  };
  // Blue text on black is unreadable; teletext sites lighten it the same way.
  var TEXT_RGB = { blue: '#12c' };

  function textColour(name) { return TEXT_RGB[name] || RGB[name] || RGB.white; }

  // images: {url: Image}, filled as needed; onImage is called when one loads.
  function createRenderer(canvas, onImage) {
    var ctx = canvas.getContext('2d');
    var images = {};

    function image(url) {
      if (!images[url]) {
        var img = new Image();
        img.onload = onImage;
        img.src = url;
        images[url] = img;
      }
      return images[url].complete && images[url].naturalWidth ? images[url] : null;
    }

    function drawBackgrounds(rows) {
      rows.forEach(function (row, r) {
        row.cells.forEach(function (cell, c) {
          ctx.fillStyle = RGB[cell.bg] || RGB.black;
          ctx.fillRect(c * CELL_W, r * CELL_H, CELL_W, CELL_H);
          var img = cell.image && image(cell.image);
          if (img) ctx.drawImage(img, c * CELL_W, r * CELL_H, CELL_W, CELL_H);
        });
      });
    }

    function drawText(rows) {
      ctx.font = FONT;
      ctx.textBaseline = 'alphabetic';
      var hidden = false;           // the row under a double-height row
      rows.forEach(function (row, r) {
        if (hidden) {
          hidden = false;
          return;
        }
        var scale = (row.doubleHeight ? 2 : 1) * CELL_H / FONT_PX;
        ctx.setTransform(1, 0, 0, scale, 0, r * CELL_H);
        row.cells.forEach(function (cell, c) {
          if (cell.image || cell.ch === ' ') return;
          ctx.fillStyle = textColour(cell.fg);
          ctx.fillText(cell.ch, c * CELL_W, BASELINE);
        });
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        hidden = row.doubleHeight;
      });
    }

    function draw(page) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.mozImageSmoothingEnabled = false;
      drawBackgrounds(page.rows);
      drawText(page.rows);
    }

    return { draw: draw };
  }

  var api = { CELL_W: CELL_W, CELL_H: CELL_H, createRenderer: createRenderer };
  root.TextTvRender = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(this);
