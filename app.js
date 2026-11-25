/* Drone Zone — unofficial viewer for ANAC's UAS geozones (ED-318 export). */
(() => {
  "use strict";

  // Safety net: if this script runs on an older cached page that lacks the
  // elements it needs, reload once to get a matching page instead of breaking.
  if (!document.querySelector("#panelBtn") || !document.querySelector("#panelShowBtn")) {
    let reloaded = false;
    try { reloaded = sessionStorage.getItem("dzReloaded") === "1"; sessionStorage.setItem("dzReloaded", "1"); } catch { /* ignore */ }
    if (!reloaded) { location.reload(); return; }
  }
  try { sessionStorage.removeItem("dzReloaded"); } catch { /* ignore */ }

  const TYPES = ["NO_RESTRICTION", "CONDITIONAL", "REQ_AUTHORIZATION", "PROHIBITED"]; // least → most restrictive
  const COLORS = { PROHIBITED: "#d7263d", REQ_AUTHORIZATION: "#f2a900", CONDITIONAL: "#2d7dd2", NO_RESTRICTION: "#8a94a3" };
  const UPCOMING_DAYS = 7;
  const OFFICIAL = "https://dnt.anac.pt/";

  const I18N = {
    pt: {
      subtitle: "Zonas geográficas UAS em Portugal",
      disclaimer: "App não oficial. Os dados vêm da ANAC mas podem estar desatualizados — confirme sempre na fonte oficial antes de voar.",
      rules: "Regras", searchPh: "Procurar zona (nome ou ID)…", myLocation: "A minha localização",
      canIFly: "Posso voar aqui?", when: "Data e hora do voo", now: "Agora", layers: "Camadas",
      t_PROHIBITED: "Proibido", t_REQ_AUTHORIZATION: "Requer autorização", t_CONDITIONAL: "Condicionado", t_NO_RESTRICTION: "Informativo",
      upcoming: `NOTAM / zonas futuras (${UPCOMING_DAYS} dias)`,
      rulesTitle: "Antes de voar", close: "Fechar",
      v_PROHIBITED: "Não — voo proibido", v_PROHIBITED_d: "Este ponto está numa zona proibida na categoria aberta à hora escolhida.",
      v_REQ_AUTHORIZATION: "Só com autorização", v_REQ_AUTHORIZATION_d: "É necessária autorização prévia da entidade indicada na zona.",
      v_CONDITIONAL: "Condições aplicam-se", v_CONDITIONAL_d: "Leia as condições da zona antes de voar.",
      v_NO_RESTRICTION: "Zona informativa", v_NO_RESTRICTION_d: "Sem restrição específica, mas leia a mensagem da zona.",
      v_NONE: "Nenhuma zona geográfica neste ponto", v_NONE_d: "Os dados não mostram zonas aqui à hora escolhida. As regras gerais da categoria aberta continuam a aplicar-se.",
      futureHdr: "Atenção: zonas que ficam ativas nos próximos dias",
      height: "Altura", contact: "Contacto", notam: "Texto NOTAM", validity: "Validade", from: "de", to: "a",
      zonesHere: "zonas neste ponto", fetched: "Dados obtidos", issued: "emitidos pela ANAC", source: "Fonte oficial",
      stale: "Os dados têm mais de 24 h. Abra a app com ligação à internet para os atualizar e confirme no mapa oficial da ANAC.", noGeo: "Não foi possível obter a localização.",
      sheet: "Painel: arraste ou toque para ajustar",
      toSat: "Vista de satélite", toMap: "Vista de mapa",
      hidePanel: "Esconder painel", showPanel: "Mostrar painel",
      locating: "A obter a sua localização…", accuracy: "Precisão", coarse: "posição aproximada (sem GPS)",
      geoInsecure: "A localização só funciona quando a app é aberta em https://.",
      geoDenied: "Localização bloqueada. Permita a localização para este site (ícone ao lado do endereço, ou nas definições do browser) e confirme que a localização do telemóvel está ligada. iPhone: Definições › Privacidade › Serviços de localização › Safari › Ao usar a app.",
      geoUnavailable: "Não foi possível determinar a posição. Ligue a localização/GPS no telemóvel (ou no Windows: Definições › Privacidade › Localização) e tente de novo.",
      geoTimeout: "A localização demorou demasiado. Tente de novo, de preferência ao ar livre ou junto a uma janela.",
      geoDeniedIOS: "O iPhone não deixou o Safari pedir a localização. 1) Definições › Privacidade e segurança › Serviços de localização: ative-os e, em \"Sites do Safari\" (Safari Websites), escolha \"Perguntar na próxima vez\" ou \"Ao usar a app\". 2) No Safari, toque em \"aA\" (à esquerda do endereço) › Definições do site › Localização › Perguntar ou Permitir. Depois recarregue a página e toque em ◎.",
      geoNoAnswer: "O browser não respondeu ao pedido de localização. Verifique se a localização está permitida para este site (ícone ao lado do endereço) e ligada no telemóvel, e tente de novo.",
      loadErr: "Não foi possível carregar data/zones.geojson. Corra update_zones.py e sirva a pasta por HTTP.",
      checkedAt: "Ponto verificado", offline: "Offline", install: "Instalar",
      iosHint: "No Safari, toque em Partilhar e depois em \"Adicionar ao ecrã principal\".",
      offlineData: "Sem ligação: a mostrar a última cópia guardada dos dados. NOTAM recentes podem faltar.", reasons: { NATURE: "Natureza", AIR_TRAFFIC: "Tráfego aéreo", EMERGENCY: "Emergência", SENSITIVE: "Sensível", OTHER: "Outro" },
      rulesHtml: `<ul>
        <li>Na categoria aberta, a altura máxima é de 120 m acima do solo, mesmo fora de zonas geográficas.</li>
        <li>Mantenha o drone sempre à vista (VLOS).</li>
        <li>Não sobrevoe aglomerações de pessoas.</li>
        <li>O registo de operador e a formação aplicam-se conforme o peso e a classe do drone — veja as regras na ANAC.</li>
        <li>Zonas temporárias (NOTAM) mudam todos os dias: verifique perto da hora do voo.</li>
        <li>Fotografia/vídeo aéreo pode exigir autorização da AAN.</li>
      </ul><p>Fontes oficiais: <a href="${OFFICIAL}" target="_blank" rel="noopener">mapa ANAC</a> · <a href="https://www.anac.pt/" target="_blank" rel="noopener">anac.pt</a> · <a href="https://aan.pt/" target="_blank" rel="noopener">aan.pt</a></p>`,
    },
    en: {
      subtitle: "UAS geographical zones in Portugal",
      disclaimer: "Unofficial app. Data comes from ANAC but may be out of date — always confirm with the official source before flying.",
      rules: "Rules", searchPh: "Search zone (name or ID)…", myLocation: "My location",
      canIFly: "Can I fly here?", when: "Flight date and time", now: "Now", layers: "Layers",
      t_PROHIBITED: "Prohibited", t_REQ_AUTHORIZATION: "Authorisation required", t_CONDITIONAL: "Conditional", t_NO_RESTRICTION: "Information",
      upcoming: `NOTAM / upcoming zones (${UPCOMING_DAYS} days)`,
      rulesTitle: "Before you fly", close: "Close",
      v_PROHIBITED: "No — flight prohibited", v_PROHIBITED_d: "This point is in a zone where open-category flights are prohibited at the chosen time.",
      v_REQ_AUTHORIZATION: "Only with authorisation", v_REQ_AUTHORIZATION_d: "Prior authorisation from the authority listed for the zone is required.",
      v_CONDITIONAL: "Conditions apply", v_CONDITIONAL_d: "Read the zone's conditions before flying.",
      v_NO_RESTRICTION: "Information zone", v_NO_RESTRICTION_d: "No specific restriction, but read the zone message.",
      v_NONE: "No geographical zone at this point", v_NONE_d: "The data shows no zones here at the chosen time. General open-category rules still apply.",
      futureHdr: "Heads up: zones becoming active in the next days",
      height: "Height", contact: "Contact", notam: "NOTAM text", validity: "Validity", from: "from", to: "to",
      zonesHere: "zones at this point", fetched: "Data fetched", issued: "issued by ANAC", source: "Official source",
      stale: "Data is more than 24 h old. Open the app with an internet connection to refresh it, and confirm on ANAC's official map.", noGeo: "Could not get your location.",
      sheet: "Panel: drag or tap to resize",
      toSat: "Satellite view", toMap: "Map view",
      hidePanel: "Hide panel", showPanel: "Show panel",
      locating: "Getting your location…", accuracy: "Accuracy", coarse: "approximate position (no GPS)",
      geoInsecure: "Location only works when the app is opened over https://.",
      geoDenied: "Location is blocked. Allow location for this site (icon next to the address, or in the browser settings) and make sure location is switched on on your phone. iPhone: Settings › Privacy › Location Services › Safari › While Using the App.",
      geoUnavailable: "Couldn't determine your position. Turn on location/GPS on your phone (or in Windows: Settings › Privacy › Location) and try again.",
      geoTimeout: "Getting your location took too long. Try again, ideally outdoors or near a window.",
      geoDeniedIOS: "Your iPhone didn't let Safari ask for your location. 1) Settings › Privacy & Security › Location Services: turn it on, and under \"Safari Websites\" choose \"Ask Next Time\" or \"While Using the App\". 2) In Safari, tap \"aA\" (left of the address) › Website Settings › Location › Ask or Allow. Then reload the page and tap ◎.",
      geoNoAnswer: "The browser didn't answer the location request. Check that location is allowed for this site (icon next to the address) and switched on on your phone, then try again.",
      loadErr: "Could not load data/zones.geojson. Run update_zones.py and serve the folder over HTTP.",
      checkedAt: "Checked point", offline: "Offline", install: "Install",
      iosHint: "In Safari, tap Share and then \"Add to Home Screen\".",
      offlineData: "No connection: showing the last saved copy of the data. Recent NOTAMs may be missing.", reasons: { NATURE: "Nature", AIR_TRAFFIC: "Air traffic", EMERGENCY: "Emergency", SENSITIVE: "Sensitive", OTHER: "Other" },
      rulesHtml: `<ul>
        <li>In the open category the maximum height is 120 m above ground, even outside geographical zones.</li>
        <li>Keep the drone in visual line of sight (VLOS) at all times.</li>
        <li>Do not fly over assemblies of people.</li>
        <li>Operator registration and pilot training apply depending on the drone's weight and class — check ANAC's rules.</li>
        <li>Temporary zones (NOTAMs) change daily: check close to flight time.</li>
        <li>Aerial photography/video may need authorisation from the AAN.</li>
      </ul><p>Official sources: <a href="${OFFICIAL}" target="_blank" rel="noopener">ANAC map</a> · <a href="https://www.anac.pt/" target="_blank" rel="noopener">anac.pt</a> · <a href="https://aan.pt/" target="_blank" rel="noopener">aan.pt</a></p>`,
    },
  };

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  let lang = store.get("lang") === "en" ? "en" : "pt";
  const t = (k) => I18N[lang][k] ?? k;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let data = null;          // raw FeatureCollection
  let zones = [];           // features with precomputed bbox + parsed windows
  let lastCheck = null;     // [lng, lat] of last "can I fly" check
  const hidden = new Set();

  /* ---------- time ---------- */
  const whenInput = $("#when");
  const toLocalInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const setNow = () => { whenInput.value = toLocalInput(new Date()); };
  const chosenTime = () => (whenInput.value ? new Date(whenInput.value).getTime() : Date.now());

  function activeAt(z, ts) {
    if (!z.win.length) return true;
    return z.win.some(([a, b]) => ts >= a && ts <= b);
  }
  function upcomingFrom(z, ts) {
    const until = ts + UPCOMING_DAYS * 864e5;
    return !activeAt(z, ts) && z.win.some(([a]) => a > ts && a <= until);
  }

  /* ---------- geometry ---------- */
  function bboxOf(geom) {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    for (const p of polys) for (const [x, y] of p[0]) {
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  }
  function inRing(pt, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function contains(z, pt) {
    const b = z.bbox;
    if (pt[0] < b[0] || pt[0] > b[2] || pt[1] < b[1] || pt[1] > b[3]) return false;
    const polys = z.f.geometry.type === "Polygon" ? [z.f.geometry.coordinates] : z.f.geometry.coordinates;
    return polys.some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
  }

  /* ---------- map ---------- */
  // Zone layers live in the initial style (empty data), so they exist even when
  // tiles can't load offline; the data is swapped in with setData once fetched.
  const colorExpr = ["match", ["get", "type"], ...Object.entries(COLORS).flat(), "#888"];
  const isState = (s) => ["==", ["get", "state"], s];
  const zoneLayers = [
    { id: "zones-fill", type: "fill", source: "zones", filter: isState("active"),
      layout: { "fill-sort-key": ["get", "rank"] },
      paint: { "fill-color": colorExpr, "fill-opacity": ["case", ["==", ["get", "type"], "NO_RESTRICTION"], 0.15, 0.3] } },
    { id: "zones-line", type: "line", source: "zones", filter: isState("active"),
      layout: { "line-sort-key": ["get", "rank"] },
      paint: { "line-color": colorExpr, "line-width": 1.4 } },
    { id: "zones-upcoming-fill", type: "fill", source: "zones", filter: isState("upcoming"),
      paint: { "fill-color": "#9b51e0", "fill-opacity": 0.08 } },
    { id: "zones-upcoming", type: "line", source: "zones", filter: isState("upcoming"),
      paint: { "line-color": "#9b51e0", "line-width": 2, "line-dasharray": [2, 2] } },
  ];
  // Base map: "map" (OpenStreetMap) or "sat" (Esri World Imagery + place names).
  const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services";
  let basemap = store.get("basemap") === "sat" ? "sat" : "map";
  const vis = (on) => ({ visibility: on ? "visible" : "none" });
  const map = new maplibregl.Map({
    container: "map",
    center: [-8.2, 39.6],
    zoom: 6,
    hash: true,
    attributionControl: { compact: true },
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster", tileSize: 256,
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxzoom: 19,
        },
        sat: {
          type: "raster", tileSize: 256,
          tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`],
          attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community",
          maxzoom: 19,
        },
        "sat-labels": {
          type: "raster", tileSize: 256,
          tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`],
          maxzoom: 19,
        },
        zones: {
          type: "geojson", data: { type: "FeatureCollection", features: [] },
          attribution: 'Zonas: <a href="https://dnt.anac.pt/">ANAC</a>',
        },
        me: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      },
      layers: [
        { id: "osm", type: "raster", source: "osm", layout: vis(basemap === "map") },
        { id: "sat", type: "raster", source: "sat", layout: vis(basemap === "sat") },
        ...zoneLayers,
        { id: "sat-labels", type: "raster", source: "sat-labels", layout: vis(basemap === "sat") },
        { id: "me-accuracy", type: "fill", source: "me", paint: { "fill-color": "#1f6feb", "fill-opacity": 0.12, "fill-outline-color": "#1f6feb" } },
      ],
    },
  });
  window.droneZoneMap = map; // handy for debugging in the console

  const basemapBtn = $("#basemapBtn");
  function applyBasemap() {
    const sat = basemap === "sat";
    if (map.getLayer("osm")) {
      map.setLayoutProperty("osm", "visibility", sat ? "none" : "visible");
      map.setLayoutProperty("sat", "visibility", sat ? "visible" : "none");
      map.setLayoutProperty("sat-labels", "visibility", sat ? "visible" : "none");
    }
    // The button shows what you switch TO.
    basemapBtn.innerHTML = sat
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 2.2 6 2v11.6l-6-2V6.2z" fill="currentColor"/></svg>'
      // Satellite: body with two solar panels on a diagonal, signal arcs in the corner.
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><g transform="rotate(45 12 12)" fill="currentColor">'
        + '<rect x="9.5" y="9" width="5" height="6" rx="1"/>'
        + '<rect x="1" y="9.5" width="6.5" height="5" rx=".7"/><rect x="16.5" y="9.5" width="6.5" height="5" rx=".7"/>'
        + '<rect x="7.4" y="11.3" width="2.2" height="1.4"/><rect x="14.4" y="11.3" width="2.2" height="1.4"/></g>'
        + '<path d="M10 14 8 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="7.6" cy="16.4" r="1.1" fill="currentColor"/>'
        + '<path d="M2.5 15.5a6 6 0 0 1 6 6M2.5 18.8a2.7 2.7 0 0 1 2.7 2.7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    const label = t(sat ? "toMap" : "toSat");
    basemapBtn.title = label;
    basemapBtn.setAttribute("aria-label", label);
    basemapBtn.setAttribute("aria-pressed", String(sat));
    document.body.classList.toggle("sat", sat);
  }
  basemapBtn.addEventListener("click", () => {
    basemap = basemap === "sat" ? "map" : "sat";
    store.set("basemap", basemap);
    applyBasemap();
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

  function buildRenderData() {
    const ts = chosenTime();
    const showUp = $("#showUpcoming").checked;
    const counts = {};
    const feats = [];
    for (const z of zones) {
      const type = z.f.properties.type;
      const active = activeAt(z, ts);
      const upcoming = !active && upcomingFrom(z, ts);
      if (active) counts[type] = (counts[type] || 0) + 1;
      if (hidden.has(type)) continue;
      if (!active && !(showUp && upcoming)) continue;
      feats.push({
        type: "Feature",
        id: z.idx,
        geometry: z.f.geometry,
        properties: { idx: z.idx, type, rank: TYPES.indexOf(type), state: active ? "active" : "upcoming" },
      });
    }
    document.querySelectorAll("[data-count]").forEach((el) => { el.textContent = counts[el.dataset.count] || 0; });
    return { type: "FeatureCollection", features: feats };
  }

  function refreshMap() {
    const src = map.getSource("zones");
    if (src) src.setData(buildRenderData());
    if (lastCheck) checkPoint(lastCheck, false);
  }

  map.on("click", (e) => checkPoint([e.lngLat.lng, e.lngLat.lat], true, e.lngLat));
  for (const id of ["zones-fill", "zones-upcoming-fill"]) {
    map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
  }

  /* ---------- zone cards & verdict ---------- */
  const fmtDate = (ms) => new Date(ms).toLocaleString(lang === "pt" ? "pt-PT" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

  function zoneCard(z, future) {
    const p = z.f.properties;
    const name = p.name[lang] || p.name.pt;
    const reasons = p.reason.map((r) => I18N[lang].reasons[r] || r).join(", ");
    const height = p.upper != null ? `${p.lower ?? 0}–${p.upper} m ${p.upperRef}` : "";
    const ts = chosenTime();
    const win = z.win.filter(([, b]) => b >= ts).slice(0, 3)
      .map(([a, b]) => `${t("from")} ${fmtDate(a)} ${t("to")} ${fmtDate(b)}`).join("<br>");
    const auth = p.authorities.map((a) => {
      const bits = [esc(a.name[lang] || a.name.pt)];
      if (a.email) bits.push(`<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>`);
      if (a.phone) bits.push(`<a href="tel:+${esc(a.phone)}">+${esc(a.phone)}</a>`);
      if (a.site) bits.push(`<a href="${esc(a.site)}" target="_blank" rel="noopener">${esc(a.site)}</a>`);
      return bits.join(" · ");
    }).join("<br>");
    return `<div class="zone ${esc(p.type)}${future ? " future" : ""}">
      <div class="zn">${esc(name)}</div>
      <div class="zt">${esc(t("t_" + p.type))} · ${esc(p.id)}${reasons ? " · " + esc(reasons) : ""}${height ? " · " + esc(height) : ""}</div>
      <p>${esc(p.message[lang] || p.message.pt)}</p>
      <details><summary>${esc(t("validity"))} / ${esc(t("contact"))}</summary>
        ${win ? `<p>${win}</p>` : ""}
        ${auth ? `<p>${auth}</p>` : ""}
        ${p.notam ? `<p><b>${esc(t("notam"))}</b></p><pre>${esc(p.notam)}</pre>` : ""}
      </details>
    </div>`;
  }

  let popup = null;
  function checkPoint(pt, fresh, lngLat) {
    if (!zones.length) return;
    lastCheck = pt;
    const ts = chosenTime();
    const here = zones.filter((z) => contains(z, pt));
    const active = here.filter((z) => activeAt(z, ts))
      .sort((a, b) => TYPES.indexOf(b.f.properties.type) - TYPES.indexOf(a.f.properties.type));
    const future = here.filter((z) => upcomingFrom(z, ts));
    const worst = active[0]?.f.properties.type || "NONE";
    const cls = { PROHIBITED: "no", REQ_AUTHORIZATION: "no", CONDITIONAL: "caution", NO_RESTRICTION: "caution", NONE: "ok" }[worst];
    const finalCls = worst === "NONE" && future.length ? "caution" : cls;

    const v = $("#verdict");
    v.className = "verdict " + finalCls;
    v.hidden = false;
    v.innerHTML = `
      <h3>${esc(t("v_" + worst))}</h3>
      <p>${esc(t("v_" + worst + "_d"))}</p>
      <p class="zt">${esc(t("checkedAt"))}: ${pt[1].toFixed(5)}, ${pt[0].toFixed(5)} · ${esc(fmtDate(ts))}</p>
      <div class="zone-list">${active.map((z) => zoneCard(z, false)).join("")}</div>
      ${future.length ? `<p><b>${esc(t("futureHdr"))}</b></p><div class="zone-list">${future.map((z) => zoneCard(z, true)).join("")}</div>` : ""}`;

    if (fresh) {
      if (popup) popup.remove();
      popup = new maplibregl.Popup({ closeButton: true, maxWidth: "280px" })
        .setLngLat(lngLat || pt)
        .setHTML(`<b>${esc(t("v_" + worst))}</b><br><span class="zt">${active.length} ${esc(t("zonesHere"))}</span>`)
        .addTo(map);
      $("#panel").scrollTop = 0;
      sheetEnsureOpen(); // show the result even if the panel was hidden
    }
  }

  /* ---------- search ---------- */
  const results = $("#results");
  $("#search").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (q.length < 2) { results.hidden = true; return; }
    const hits = zones.filter((z) => {
      const p = z.f.properties;
      return p.name.pt.toLowerCase().includes(q) || p.name.en.toLowerCase().includes(q) || String(p.id).toLowerCase().includes(q);
    }).slice(0, 20);
    results.innerHTML = hits.map((z) => {
      const p = z.f.properties;
      return `<li tabindex="0" data-idx="${z.idx}"><span class="sw" style="background:${COLORS[p.type]}"></span>${esc(p.name[lang] || p.name.pt)} <span class="zt">${esc(p.id)}</span></li>`;
    }).join("");
    results.hidden = !hits.length;
  });
  const pick = (li) => {
    const z = zones[+li.dataset.idx];
    const [x0, y0, x1, y1] = z.bbox;
    map.fitBounds([[x0, y0], [x1, y1]], { padding: 60, maxZoom: 14 });
    results.hidden = true;
    const c = [(x0 + x1) / 2, (y0 + y1) / 2];
    checkPoint(contains(z, c) ? c : z.f.geometry.type === "Polygon" ? z.f.geometry.coordinates[0][0] : z.f.geometry.coordinates[0][0][0], true);
  };
  results.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) pick(li); });
  results.addEventListener("keydown", (e) => { if (e.key === "Enter") { const li = e.target.closest("li"); if (li) pick(li); } });

  /* ---------- controls ---------- */
  $("#checkBtn").addEventListener("click", () => {
    const c = map.getCenter();
    checkPoint([c.lng, c.lat], true, c);
  });
  /* ---------- my location ---------- */
  let toastTimer = null;
  function toast(msg, ms = 6000) {
    const el = $("#toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => { el.hidden = true; }, ms);
  }
  $("#toast").addEventListener("click", (e) => { e.currentTarget.hidden = true; });

  const meEl = document.createElement("div");
  meEl.className = "me-dot";
  const meMarker = new maplibregl.Marker({ element: meEl });
  function accuracyRing(lng, lat, r) {
    const ring = [];
    for (let i = 0; i <= 48; i++) {
      const a = (2 * Math.PI * i) / 48;
      ring.push([lng + (r * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (r * Math.sin(a)) / 111320]);
    }
    return { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }] };
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const locateBtn = $("#locateBtn");
  let locateReq = 0;

  // Not async on purpose: Safari on iPhone only shows the "Allow location?" prompt
  // when getCurrentPosition is called directly inside the tap handler. Any await
  // before it loses the user gesture and Safari silently ignores the request.
  locateBtn.addEventListener("click", () => {
    if (!window.isSecureContext) { toast(t("geoInsecure")); return; }
    if (!navigator.geolocation) { toast(t("noGeo")); return; }

    const my = ++locateReq;
    let failed = false;
    const fail = (code) => {
      if (my !== locateReq || failed) return;
      failed = true;
      clearTimeout(dog);
      locateBtn.classList.remove("busy");
      const key = code === 1 ? (isIOS ? "geoDeniedIOS" : "geoDenied")
        : { 2: "geoUnavailable", 3: "geoTimeout", 4: isIOS ? "geoDeniedIOS" : "geoNoAnswer" }[code] || "noGeo";
      toast(t(key), 20000);
    };
    // A position that arrives late (e.g. the user took a while to answer the
    // prompt) is still used, as long as no newer request was started.
    const ok = (pos) => { if (my !== locateReq) return; clearTimeout(dog); locateBtn.classList.remove("busy"); showPosition(pos); };

    locateBtn.classList.add("busy");
    toast(t("locating"), 0);
    // Precise GPS first; if it can't get a fix in time, accept a coarser (Wi-Fi/cell) position.
    navigator.geolocation.getCurrentPosition(ok, (e) => {
      if (e.code === 2 || e.code === 3) {
        navigator.geolocation.getCurrentPosition(ok, (e2) => fail(e2.code), { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
      } else fail(e.code);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });

    // Some browsers never answer when location is blocked or the prompt is dismissed.
    const dog = setTimeout(() => fail(4), 40000);
    // Report an already-blocked permission at once (the request above is already sent).
    navigator.permissions?.query({ name: "geolocation" })
      .then((p) => { if (p.state === "denied") fail(1); })
      .catch(() => { /* not supported: rely on the callbacks */ });
  });

  function showPosition(pos) {
    const { longitude: lng, latitude: lat, accuracy } = pos.coords;
    meMarker.setLngLat([lng, lat]).addTo(map);
    const src = map.getSource("me");
    if (src) src.setData(accuracyRing(lng, lat, accuracy));
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), accuracy > 1000 ? 11 : 14) });
    toast(`${t("accuracy")}: ±${Math.round(accuracy)} m${accuracy > 500 ? " — " + t("coarse") : ""}`);
    checkPoint([lng, lat], true);
  }
  whenInput.addEventListener("change", refreshMap);
  $("#nowBtn").addEventListener("click", () => { setNow(); refreshMap(); });
  $("#showUpcoming").addEventListener("change", refreshMap);
  document.querySelectorAll(".legend input[data-type]").forEach((cb) => {
    cb.addEventListener("change", () => {
      cb.checked ? hidden.delete(cb.dataset.type) : hidden.add(cb.dataset.type);
      refreshMap();
    });
  });
  $("#infoBtn").addEventListener("click", () => {
    $("#rulesBody").innerHTML = `<p class="warn-inline">${esc(t("disclaimer"))}</p>` + t("rulesHtml");
    $("#rulesDlg").showModal();
  });

  /* ---------- dismissible disclaimer banner ---------- */
  const WARN_KEY = "warnClosedAt";
  const WARN_DAYS = 30; // show it again after a month
  const warnClosedAt = +store.get(WARN_KEY) || 0;
  if (Date.now() - warnClosedAt < WARN_DAYS * 864e5) $("#warn").hidden = true;
  $("#warnClose").addEventListener("click", () => {
    $("#warn").hidden = true;
    store.set(WARN_KEY, String(Date.now()));
    map.resize();
  });

  /* ---------- draggable bottom sheet (phones) ---------- */
  const panel = $("#panel");
  const grab = $("#sheetGrab");
  const phone = window.matchMedia("(max-width: 760px)");
  const SHEET_ORDER = ["min", "mid", "max"];
  let sheetState = SHEET_ORDER.includes(store.get("sheet")) ? store.get("sheet") : "mid";
  // Size to return to when the panel is reopened after being hidden.
  let lastOpen = ["mid", "max"].includes(store.get("sheetOpen")) ? store.get("sheetOpen") : "mid";
  const panelBtn = $("#panelBtn");

  function sheetHeights() {
    const H = $(".layout").clientHeight;
    return { min: 44, mid: Math.round(H * 0.45), max: Math.max(Math.round(H - 120), Math.round(H * 0.45)) };
  }
  const panelShowBtn = $("#panelShowBtn");
  const chevron = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CHEV = { down: "M6 9l6 6 6-6", up: "M6 15l6-6 6 6", right: "M9 6l6 6-6 6", left: "M15 6l-6 6 6 6" };

  // The toggle lives in the panel's top bar. Phones: arrow down hides the bottom
  // menu, arrow up brings it back (the bar stays visible when collapsed).
  // Wider screens: arrow right hides the side panel; a map button reopens it.
  function updatePanelBtn() {
    const open = sheetState !== "min";
    panelBtn.innerHTML = chevron(phone.matches ? (open ? CHEV.down : CHEV.up) : CHEV.right);
    const label = t(open ? "hidePanel" : "showPanel");
    panelBtn.title = label;
    panelBtn.setAttribute("aria-label", label);
    panelBtn.setAttribute("aria-expanded", String(open));
    panelShowBtn.innerHTML = chevron(CHEV.left);
    panelShowBtn.title = t("showPanel");
    panelShowBtn.setAttribute("aria-label", t("showPanel"));
  }
  function setSheet(state, animate = true) {
    sheetState = state;
    store.set("sheet", state);
    if (state !== "min") { lastOpen = state; store.set("sheetOpen", state); }
    updatePanelBtn();
    if (!phone.matches) {
      // Wider screens: "min" hides the side panel so the map uses the full width.
      panel.style.height = "";
      panel.classList.remove("collapsed", "animating");
      document.body.classList.toggle("panel-hidden", state === "min");
      setTimeout(() => map.resize(), 0);
      return;
    }
    document.body.classList.remove("panel-hidden");
    panel.classList.toggle("animating", animate);
    panel.style.height = sheetHeights()[state] + "px";
    panel.classList.toggle("collapsed", state === "min");
    if (state === "min") panel.scrollTop = 0;
    setTimeout(() => map.resize(), animate ? 260 : 0);
  }
  function sheetEnsureOpen() { if (sheetState === "min") setSheet(lastOpen); }
  function sheetToggle() { setSheet(sheetState === "min" ? lastOpen : "min"); }
  panelBtn.addEventListener("click", sheetToggle);
  panelShowBtn.addEventListener("click", () => setSheet(lastOpen));
  // Arrow keys on the toggle step through the sheet sizes on phones.
  panelBtn.addEventListener("keydown", (e) => {
    if (!phone.matches) return;
    const idx = SHEET_ORDER.indexOf(sheetState);
    if (e.key === "ArrowUp") { e.preventDefault(); setSheet(SHEET_ORDER[Math.min(2, idx + 1)]); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setSheet(SHEET_ORDER[Math.max(0, idx - 1)]); }
  });

  let drag = null;
  grab.addEventListener("pointerdown", (e) => {
    if (!phone.matches || e.target.closest("button")) return; // the toggle button handles its own taps
    drag = { y0: e.clientY, h0: panel.getBoundingClientRect().height, lastY: e.clientY, lastT: e.timeStamp, v: 0, moved: false };
    panel.classList.remove("animating", "collapsed");
    grab.setPointerCapture(e.pointerId);
  });
  grab.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y0;
    if (Math.abs(dy) > 5) drag.moved = true;
    const { min, max } = sheetHeights();
    panel.style.height = Math.min(max, Math.max(min, drag.h0 - dy)) + "px";
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.v = (e.clientY - drag.lastY) / dt; // px/ms, positive = moving down
    drag.lastY = e.clientY; drag.lastT = e.timeStamp;
  });
  const endDrag = () => {
    if (!drag) return;
    const d = drag; drag = null;
    const idx = SHEET_ORDER.indexOf(sheetState);
    if (!d.moved) { sheetToggle(); return; } // tap toggles
    if (d.v < -0.4) { setSheet(SHEET_ORDER[Math.min(2, idx + 1)]); return; } // flick up
    if (d.v > 0.4) { setSheet(SHEET_ORDER[Math.max(0, idx - 1)]); return; }  // flick down
    const h = panel.getBoundingClientRect().height;
    const hs = sheetHeights();
    setSheet(SHEET_ORDER.reduce((best, s) => (Math.abs(hs[s] - h) < Math.abs(hs[best] - h) ? s : best), "mid"));
  };
  grab.addEventListener("pointerup", endDrag);
  grab.addEventListener("pointercancel", endDrag);
  phone.addEventListener("change", () => setSheet(sheetState, false));
  window.addEventListener("resize", () => { if (!drag) setSheet(sheetState, false); });
  setSheet(sheetState, false);
  $("#langBtn").addEventListener("click", () => {
    lang = lang === "pt" ? "en" : "pt";
    store.set("lang", lang);
    applyLang();
    if (lastCheck) checkPoint(lastCheck, false);
  });

  function applyLang() {
    document.documentElement.lang = lang;
    $("#langBtn").textContent = lang === "pt" ? "EN" : "PT";
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    $("#warnClose").setAttribute("aria-label", t("close"));
    applyBasemap();
    updatePanelBtn();
    renderMeta();
  }

  function renderMeta() {
    if (!data) return;
    const m = data.metadata || {};
    const fetched = m.fetched ? Date.parse(m.fetched) : null;
    const stale = fetched && Date.now() - fetched > 864e5;
    $("#meta").innerHTML = `${esc(t("fetched"))}: ${fetched ? esc(fmtDate(fetched)) : "?"}${m.issued ? ` (${esc(t("issued"))} ${esc(fmtDate(Date.parse(m.issued)))})` : ""}.
      ${stale ? `<br><b>${esc(t("stale"))}</b>` : ""}
      ${fromCache ? `<br><b>${esc(t("offlineData"))}</b>` : ""}
      <br>${esc(t("source"))}: <a href="${OFFICIAL}" target="_blank" rel="noopener">dnt.anac.pt</a>`;
  }

  /* ---------- PWA: service worker, install, offline ---------- */
  let fromCache = false;
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  const installBtn = $("#installBtn");
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  window.addEventListener("appinstalled", () => { installBtn.hidden = true; deferredPrompt = null; });
  if (isIOS && !standalone) installBtn.hidden = false;
  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    } else if (isIOS) {
      $("#iosDlg").showModal();
    }
  });

  const updateOnline = () => { $("#offlineBadge").hidden = navigator.onLine; };
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  updateOnline();

  /* ---------- boot ---------- */
  setNow();
  applyLang();

  const loaded = fetch("data/zones.geojson", { cache: "no-cache" })
    .then((r) => { if (!r.ok) throw new Error(r.status); fromCache = r.headers.get("X-From-Cache") === "1"; return r.json(); })
    .then((json) => {
      data = json;
      zones = json.features.map((f, idx) => ({
        idx, f, bbox: bboxOf(f.geometry),
        win: f.properties.windows.map(([a, b]) => [Date.parse(a), Date.parse(b)]).filter(([a, b]) => !isNaN(a) && !isNaN(b)),
      }));
      renderMeta();
    })
    .catch(() => { $("#meta").textContent = t("loadErr"); });

  // Don't wait for "load": offline it waits on tiles that never arrive. The zones
  // source is part of the initial style, so poll until the style has parsed it.
  loaded.then(() => {
    if (!zones.length) return;
    const fill = () => (map.getSource("zones") ? refreshMap() : setTimeout(fill, 100));
    fill();
  });
})();
