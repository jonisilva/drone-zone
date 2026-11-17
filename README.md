# Drone Zone

Unofficial web app for checking UAS (drone) geographical zones in Portugal,
built on the open data ANAC publishes at <https://dnt.anac.pt/> (ED-318 export:
static zones plus NOTAMs). It is not affiliated with ANAC. Always confirm on
the official map before flying.

**Live app:** <https://jonisilva.github.io/drone-zone/>. It is deployed by
`.github/workflows/pages.yml` on every push and twice a day (05:17 and
17:17 UTC), and each deploy fetches fresh ANAC data. If ANAC can't be
reached, the deploy uses the committed `data/zones.geojson`.

## Features

- Map of all zones, coloured by type (prohibited, authorisation required,
  conditional, information), with filters and counts.
- **Can I fly here?**: checks the map centre, a tapped point or your GPS
  position against every zone and gives the most restrictive result. It
  lists each zone's message, height limits, validity and contacts.
- Flight date/time picker: temporary zones and NOTAMs are evaluated for the
  chosen time, with a warning for zones that start within 7 days.
- Zone search by name or ID, PT/EN toggle, and a "before you fly" rules sheet.
- Shareable map position in the URL (`#zoom/lat/lng`).
- Works on phones (bottom sheet layout) and in light or dark mode.

## Install as an app (PWA)

The app is a Progressive Web App: open it in Chrome/Edge on Android and tap
**Install** (or the browser menu's "Install app"). On iPhone, open it in
Safari, tap Share, then "Add to Home Screen". After the first visit it works
offline, using the last saved zone data (with a notice) and the map tiles you
have already viewed.

Phones only allow installing, service workers and GPS on **HTTPS** pages, so
for real use the folder has to be hosted on an HTTPS static host. GitHub
Pages, Cloudflare Pages and Netlify all work. On the PC itself,
`http://127.0.0.1` also counts as secure.

When you change `index.html`, `app.js` or `style.css`, bump `VERSION` in
`sw.js` so installed copies pick up the new files.

Icons are drawn by `tools/make_icons.py` (standard library only).

## Run

```bash
python update_zones.py      # refresh data/zones.geojson from ANAC (stdlib only)
python -m http.server 8765  # then open http://127.0.0.1:8765/
```

The app must be served over HTTP (not opened as a file), because it fetches
`data/zones.geojson`. ANAC's server sends no CORS headers, so the browser
cannot read the export directly. Re-run `update_zones.py` regularly, since
NOTAMs change daily. The app flags data older than 24 h.
