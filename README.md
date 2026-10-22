# Text-TV

SVT Text, Sweden's teletext, on the **Nokia 8110 4G** (KaiOS 2.5 / GerdaOS). It shows the live
pages as on a TV: type a page number, step through pages and subpages, and zoom to double
height.

![Text-TV](app/icons/icon112x112.png)

## Features

- The real SVT Text pages, fetched live through the [texttv.nu](https://texttv.nu) API.
- The look of a TV set:
  - 40x25 cells in [Bedstead](https://bjh21.me.uk/bedstead/), a copy of the SAA5050 teletext
    chip's font.
  - Block graphics, double-height lines and the eight teletext colours.
  - A header with the page number, the date and a ticking clock.
- Subpages turn over by themselves every 15 seconds.
- The page refreshes every minute, and the app remembers the last page.

## Keys

| Key | Action |
|-----|--------|
| Digits | Type a page number; it goes there after three digits |
| Left / Right | Previous / next page |
| Up / Down | Previous / next subpage |
| OK | Refresh |
| Left softkey | Page 100 |
| Right softkey | Zoom: top half, bottom half, back to the whole page |
| Back | Delete a typed digit, go back a page, or close the app |

Some pages to try:

| Page | Content |
|------|---------|
| 100 | Front page |
| 101 | Domestic news |
| 104 | Foreign news |
| 300 | Sport |
| 377 | Live scores |
| 400 | Weather |
| 700 | Index |

## How it works

- `app/js/page.js` turns a page's HTML into a grid of cells, each with a character, its
  colours, any graphics image and any link. It reads the HTML as text and never puts it into
  the document. Graphics images are only loaded from texttv.nu.
- `app/js/render.js` draws the grid on a canvas, using 6x12 cells: Bedstead's 6x10, stretched.
- `app/js/api.js` fetches pages and keeps each one for 30 seconds.
- `app/js/main.js` handles the keys, history, zoom, timers and header.

## Build and install

Needs a rooted phone with adb (GerdaOS, or KaiOS with root):

```
npm test               # unit tests (node --test)
npm run build          # dist/application.zip
npm run install-phone  # push, register, restart b2g
npm run uninstall-phone
```

## Licence

MIT, except the Bedstead font (`app/fonts/bedstead.otf`, by Ben Harris), which is public domain
(CC0). The pages are SVT's and come from texttv.nu. This project is not affiliated with either.
