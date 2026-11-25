/* Service worker: offline app shell, last-known zone data, and viewed map tiles. */
const VERSION = "v12"; // bump on every release so phones pick up new files
const SHELL = `zd-shell-${VERSION}`;
const DATA = "zd-data";
const TILES = "zd-tiles";
const MAX_TILES = 1500; // keep tile cache modest (OSM tile usage policy: no bulk prefetch)

const SHELL_FILES = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css",
  "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL);
    await shell.addAll(SHELL_FILES.map((u) => new Request(u, { cache: "reload" })));
    // Seed the data cache so the app works offline right after install.
    try {
      const res = await fetch("data/zones.geojson", { cache: "reload" });
      if (res.ok) await (await caches.open(DATA)).put("data/zones.geojson", res);
    } catch { /* offline during install: fine */ }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) {
      if (k.startsWith("zd-shell-") && k !== SHELL) await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

async function trimTiles() {
  const c = await caches.open(TILES);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Zone data: network first (NOTAMs change), fall back to last copy.
  if (url.origin === location.origin && url.pathname.endsWith("/data/zones.geojson")) {
    e.respondWith((async () => {
      const cache = await caches.open(DATA);
      try {
        const res = await fetch(req, { cache: "no-cache" });
        if (res.ok) await cache.put("data/zones.geojson", res.clone());
        return res;
      } catch {
        const hit = await cache.match("data/zones.geojson");
        if (hit) {
          const h = new Headers(hit.headers);
          h.set("X-From-Cache", "1");
          return new Response(hit.body, { status: 200, headers: h });
        }
        throw new Error("offline and no cached zones");
      }
    })());
    return;
  }

  // Map tiles: cache first, then network.
  if (url.hostname === "tile.openstreetmap.org" || url.hostname === "server.arcgisonline.com") {
    e.respondWith((async () => {
      const cache = await caches.open(TILES);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { await cache.put(req, res.clone()); trimTiles(); }
      return res;
    })());
    return;
  }

  // The app's own page/script/styles: network first, so the page and its script
  // always come from the same release when online (cache-first could pair an old
  // cached index.html with a new app.js and break). Cache is the offline fallback.
  const ownCode = url.origin === location.origin && (req.mode === "navigate" || /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/"));
  if (ownCode) {
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      try {
        const res = await fetch(req, { cache: "no-cache" });
        if (res.ok) await cache.put(req.mode === "navigate" ? "index.html" : req, res.clone());
        return res;
      } catch {
        const hit = await cache.match(req.mode === "navigate" ? "index.html" : req, { ignoreSearch: true });
        return hit || Response.error();
      }
    })());
    return;
  }

  // Versioned libraries (unpkg, pinned) and icons: cache first.
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && (url.origin === location.origin || url.hostname === "unpkg.com")) await cache.put(req, res.clone());
    return res;
  })());
});
