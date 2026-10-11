// "Nu in huis" als Home Assistant-kaart (type: custom:smart-devices-ems-huis).
//
// BEWUSTE KOPIE van de tekening op Home in de EMS-portal:
//   portal/frontend/src/components/klant/HuisStroom.vue  (tekening, labels, balken)
//   portal/frontend/src/utils/huisStroom.js               (stromen, puntOp, zonHoogte)
// Andere repo, geen gedeelde code: wijzigt de tekening daar, loop deze dan mee na.
// Verschillen met opzet: geen 0,7 s glijden van de getallen (HA ververst per 30 s),
// kleuren van achtergrond en tekst uit het HA-thema, gegevens uit de sensoren van
// deze integratie (gevonden op translation_key, dus taalonafhankelijk), en de
// label-vakjes iets breder (6,3 px per letter in plaats van 5,8): het HA-lettertype
// is breder dan dat van de portal. Het bestand is bewust puur ASCII (\uXXXX voor
// tekens als de middenpunt): HA levert het zonder charset en dan kan een browser
// het als Latin-1 lezen.

const DOMEIN = "smart_devices_ems";
const ACTIE = {
  levert: "#0F9D6B", zon: "#F59E0B", net: "#3B5BDB",
  wacht: "#9AA39E", auto: "#22A355", boiler: "#0EA5C6",
};
const MAAN = "#E9E4C9";
const BRON_KLEUR = { zon: ACTIE.zon, accu: ACTIE.levert, net: ACTIE.net };
const AUTO_PIL = {
  kabel_los: "kabel los", aangesloten: "aangesloten", laadt: "laadt",
  vol: "vol", wacht_op_zon: "wacht op zon", wacht: "wacht",
};
const NS = "http://www.w3.org/2000/svg";

// -- Rekenregels (kopie van huisStroom.js) ------------------------------------
function stromen({ pv = 0, huis = 0, auto = 0, boiler = 0, bat = 0, grid = 0 }) {
  const bron = { zon: Math.max(0, pv), accu: Math.max(0, -bat), net: Math.max(0, grid) };
  const vraag = {
    huis: Math.max(0, huis), auto: Math.max(0, auto), boiler: Math.max(0, boiler),
    accu: Math.max(0, bat), net: Math.max(0, -grid),
  };
  const voorkeur = {
    zon: ["huis", "auto", "boiler", "accu", "net"],
    accu: ["huis", "auto", "boiler", "net"],
    net: ["huis", "auto", "boiler", "accu"],
  };
  const uit = [];
  for (const b of ["zon", "accu", "net"]) {
    let rest = bron[b];
    for (const d of voorkeur[b]) {
      const w = Math.min(rest, vraag[d]);
      if (w > 1) { uit.push({ van: b, naar: d, w }); rest -= w; vraag[d] -= w; }
    }
  }
  return uit;
}
function lijnLengte(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}
function puntOp(pts, frac, lengte = lijnLengte(pts)) {
  let rest = Math.max(0, Math.min(1, frac)) * lengte;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const l = Math.hypot(x1 - x0, y1 - y0);
    if (rest <= l || i === pts.length - 1) {
      const f = l > 0 ? Math.min(1, rest / l) : 0;
      return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f];
    }
    rest -= l;
  }
  return pts[pts.length - 1];
}
function zonHoogte(ms, lat, lon) {
  if (!lat && !lon) [lat, lon] = [52.1, 5.3];
  const rad = Math.PI / 180;
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
  const e = (23.439 - 0.00000036 * d) * rad;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const ha = ((gmst * 15 + lon) * rad) - ra;
  const sinH = Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(ha);
  return Math.asin(sinH) / rad;
}
const isDonker = (ms, lat, lon) => zonHoogte(ms, lat, lon) < -0.833;

function fmtW(w) {
  const a = Math.abs(w ?? 0);
  if (a >= 1000) return (a / 1000).toLocaleString("nl-NL", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " kW";
  return Math.round(a) + " W";
}
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// -- Draden en paden (zelfde coordinaten als HuisStroom.vue) ------------------
const KAST = [187, 178];
const ALLE_DRADEN = {
  zon: [[172, 92], [172, 160]],
  lamp: [[245, 140], [245, 136], [200, 136], [200, 160]],
  tv: [[257, 204], [257, 178], [204, 178]],
  boiler: [[191, 126], [191, 160]],
  accu: [[122, 192], [122, 184], [170, 184]],
  auto: [[64, 236], [72, 236], [72, 246], [178, 246], [178, 196]],
  net: [[300, 246], [196, 246], [196, 196]],
};
const lijnD = (pts) => "M" + pts.map((p) => p.join(" ")).join(" L");
const padCache = {};
function pad(van, naar) {
  const k = van + "-" + naar;
  if (!padCache[k]) {
    const pts = [...ALLE_DRADEN[van], KAST, ...[...ALLE_DRADEN[naar]].reverse()];
    padCache[k] = { pts, len: lijnLengte(pts) };
  }
  return padCache[k];
}

// -- Uit de sensoren van Home Assistant ---------------------------------------
function vindEntiteiten(hass, deviceId) {
  const per = {};
  let apparaat = deviceId;
  for (const e of Object.values(hass.entities || {})) {
    if (e.platform !== DOMEIN || !e.translation_key) continue;
    if (!apparaat) apparaat = e.device_id;          // geen keuze: het eerste EMS-apparaat
    if (e.device_id !== apparaat) continue;
    per[e.translation_key] = e.entity_id;
  }
  return per;
}

function leesStand(hass, ent, config) {
  const st = (k) => (ent[k] ? hass.states[ent[k]] : undefined);
  const getal = (k) => {
    const s = st(k);
    const v = s ? parseFloat(s.state) : NaN;
    return Number.isFinite(v) ? v : null;
  };
  const tekst = (k) => st(k)?.state;
  const heeftAuto = !!ent.vermogen_auto;
  const slim = !!ent.auto_status;
  const heeftBoiler = !!ent.vermogen_boiler;
  const auto = getal("vermogen_auto") ?? 0;
  const boiler = getal("vermogen_boiler") ?? 0;
  const actie = tekst("ai_nu_actie");
  const autoSoc = getal("auto_stand");
  const onbekend = ["vermogen_huis", "vermogen_net", "vermogen_accu"]
    .some((k) => !st(k) || ["unavailable", "unknown"].includes(st(k).state));
  return {
    pv: getal("vermogen_zon") ?? 0,
    huis: getal("vermogen_huis") ?? 0,
    auto, boiler,
    bat: getal("vermogen_accu") ?? 0,
    grid: getal("vermogen_net") ?? 0,
    soc: getal("accu_stand"),
    temp: getal("boiler_temperatuur"),
    accuKleur: ACTIE[actie] ?? ACTIE.wacht,
    heeftZon: config.zon !== false,
    heeftAuto, heeftBoiler,
    autoNaam: slim && autoSoc != null ? `Auto \u00b7 ${Math.round(autoSoc)} %` : "Auto",
    autoPil: (slim && AUTO_PIL[tekst("auto_status")]) || (auto > 50 ? "laadt" : "wacht"),
    autoGeschat: heeftAuto && !slim,
    boilerPil: boiler > 50 ? "warmt op" : "uit",
    stil: onbekend || tekst("verouderd") === "on",
    lat: hass.config?.latitude || 0,
    lon: hass.config?.longitude || 0,
  };
}

// -- De kaart -----------------------------------------------------------------
class SmartDevicesEmsHuis extends HTMLElement {
  static getStubConfig() { return {}; }
  static getConfigElement() { return document.createElement("smart-devices-ems-huis-editor"); }

  setConfig(config) {
    this._config = { ...config };
    this._sleutel = null;
  }

  getCardSize() { return 7; }
  getGridOptions() { return { columns: 12, min_columns: 6, rows: "auto" }; }

  set hass(hass) {
    this._hass = hass;
    const ent = vindEntiteiten(hass, this._config?.apparaat);
    const stand = leesStand(hass, ent, this._config || {});
    stand.donker = isDonker(Date.now(), stand.lat, stand.lon);
    stand.leeg = !ent.vermogen_huis;
    const sleutel = JSON.stringify(stand);
    if (sleutel === this._sleutel) return;          // niets veranderd: niet opnieuw tekenen
    this._sleutel = sleutel;
    this._stand = stand;
    this._teken();
  }

  connectedCallback() {
    this._vorige = 0;
    if (!this._raf) this._raf = requestAnimationFrame((t) => this._stap(t));
  }
  disconnectedCallback() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _teken() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const s = this._stand;
    if (s.leeg) {
      this.shadowRoot.innerHTML = `<ha-card><div style="padding:16px">Geen Smart Devices EMS gevonden. Voeg eerst de integratie toe.</div></ha-card>`;
      return;
    }
    this._clip = this._clip || "boiler-vat-" + Math.random().toString(36).slice(2, 8);
    this._reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const accuHoogte = Math.max(0, Math.min(100, s.soc ?? 0)) / 100 * 34;
    const tvAan = s.huis > 150;
    const licht = Math.min(1, Math.max(0, s.huis) / 2000);
    let boilerKleur = ACTIE.wacht;
    if (s.temp != null) {
      const warm = Math.max(0, Math.min(1, (s.temp - 35) / 30));
      boilerKleur = `color-mix(in srgb, #E8590C ${Math.round(warm * 100)}%, ${ACTIE.boiler})`;
    }
    const draden = { lamp: ALLE_DRADEN.lamp, tv: ALLE_DRADEN.tv, accu: ALLE_DRADEN.accu, net: ALLE_DRADEN.net };
    if (s.heeftZon) draden.zon = ALLE_DRADEN.zon;
    if (s.heeftBoiler) draden.boiler = ALLE_DRADEN.boiler;
    if (s.heeftAuto) draden.auto = ALLE_DRADEN.auto;
    this._draden = draden;

    const onder = [];
    if (s.heeftAuto) onder.push({ naam: s.autoNaam, x: 6, waarde: (s.autoGeschat && s.auto > 0 ? "\u2248 " : "") + fmtW(s.auto),
      pil: s.autoPil, kleur: s.auto > 50 ? ACTIE.auto : ACTIE.wacht });
    onder.push({ naam: "Accu", x: 100, waarde: fmtW(s.bat),
      pil: s.bat > 50 ? "laadt" : s.bat < -50 ? "levert" : "wacht", kleur: s.accuKleur });
    if (s.heeftBoiler) onder.push({ naam: "Boiler" + (s.temp != null ? ` \u00b7 ${Math.round(s.temp)} \u00b0C` : ""), x: 140, dy: -246,
      waarde: fmtW(s.boiler), pil: s.boilerPil, kleur: s.boiler > 50 ? ACTIE.boiler : ACTIE.wacht });
    onder.push({ naam: "Net", x: 290, waarde: fmtW(s.grid),
      pil: s.grid > 50 ? "afname" : s.grid < -50 ? "terug" : "geen",
      kleur: s.grid > 50 ? ACTIE.net : s.grid < -50 ? ACTIE.levert : ACTIE.wacht });

    const balk = (titel, delen) => {
      const zicht = delen.filter((d) => d.w > 50);
      const tot = zicht.reduce((a, d) => a + d.w, 0) || 1;
      return { titel, delen: zicht.map((d) => ({ ...d, pct: Math.round(d.w / tot * 100) })) };
    };
    const mix = [
      balk("Je stroom komt nu van", [
        { naam: "zon", w: s.heeftZon ? Math.max(0, s.pv) : 0, kleur: ACTIE.zon },
        { naam: "accu", w: Math.max(0, -s.bat), kleur: ACTIE.levert },
        { naam: "net", w: Math.max(0, s.grid), kleur: ACTIE.net },
      ]),
      balk("en gaat naar", [
        { naam: "huis", w: Math.max(0, s.huis), kleur: "#94A3B8" },
        { naam: "auto", w: s.heeftAuto ? Math.max(0, s.auto) : 0, kleur: ACTIE.auto },
        { naam: "boiler", w: s.heeftBoiler ? Math.max(0, s.boiler) : 0, kleur: ACTIE.boiler },
        { naam: "accu", w: Math.max(0, s.bat), kleur: s.accuKleur },
        { naam: "terug naar net", w: Math.max(0, -s.grid), kleur: ACTIE.levert },
      ]),
    ];

    const aria = [
      s.heeftZon ? `zon ${fmtW(s.pv)}` : null, `huis ${fmtW(s.huis)}`,
      `accu ${s.bat > 50 ? "laadt" : s.bat < -50 ? "levert" : "wacht"} ${fmtW(s.bat)}`,
      `net ${s.grid > 50 ? "afname" : s.grid < -50 ? "teruglevering" : "geen"} ${fmtW(s.grid)}`,
      s.heeftAuto ? `auto ${fmtW(s.auto)}` : null, s.heeftBoiler ? `boiler ${fmtW(s.boiler)}` : null,
    ].filter(Boolean).join(", ");

    const titel = this._config?.titel;
    this.shadowRoot.innerHTML = `
<style>${CSS}</style>
<ha-card>
  ${titel ? `<h1 class="card-header">${esc(titel)}</h1>` : ""}
  <div class="inhoud ${s.stil ? "huis-stil" : ""}">
  <svg viewBox="0 0 360 316" role="img" aria-label="${esc("Stroom in huis: " + aria)}">
    <polygon points="70,130 185,64 300,130" style="fill: var(--k-line)" />
    <rect x="82" y="130" width="206" height="122" style="fill: var(--k-fill); stroke: var(--k-line3)" />
    ${s.heeftZon ? `<polygon points="106,116 176,76 176,88 106,128" fill="${s.pv > 50 && !s.donker ? "#2C3F6B" : "#4A556B"}" />` : ""}
    <line x1="0" y1="252" x2="360" y2="252" stroke-width="2" style="stroke: var(--k-line3)" />
    <g stroke-width="1" stroke-dasharray="2 3" fill="none" opacity="0.7" style="stroke: var(--k-muted)">
      ${s.heeftZon ? `<path d="M22 54 V122 H104" />` : ""}
      <path d="M245 52 V128" />
      ${s.heeftBoiler ? `<path d="M191 68 V94" />` : ""}
    </g>
    <g fill="none" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" style="stroke: var(--k-line3)">
      ${Object.values(draden).map((pts) => `<path d="${lijnD(pts)}" />`).join("")}
    </g>
    <g id="deeltjes"></g>
    <rect x="170" y="160" width="34" height="36" rx="4" style="fill: var(--k-card); stroke: var(--k-line3)" />
    <circle cx="187" cy="170" r="2.2" fill="${s.stil ? ACTIE.wacht : ACTIE.levert}" />
    <rect x="178" y="178" width="18" height="2" rx="1" style="fill: var(--k-line3)" />
    <rect x="178" y="184" width="18" height="2" rx="1" style="fill: var(--k-line3)" />
    <circle cx="245" cy="151" r="${6 + licht * 14}" fill="${ACTIE.zon}" opacity="${0.12 + licht * 0.25}" />
    <circle cx="245" cy="149" r="3.5" fill="${ACTIE.zon}" opacity="${0.4 + licht * 0.6}" />
    <path d="M240 140 H250 L254 148 H236 Z" style="fill: var(--k-ink)" />
    <rect x="254" y="227" width="6" height="7" style="fill: var(--k-line3)" />
    <rect x="236" y="234" width="42" height="6" rx="1.5" style="fill: var(--k-line3)" />
    <rect x="238" y="204" width="38" height="24" rx="2.5" fill="#1E2421" style="stroke: var(--k-line3)" />
    <g class="${tvAan ? "tv-beeld" : ""}">
      <rect x="240.5" y="206.5" width="33" height="19" rx="1" fill="${tvAan ? "#2C3F6B" : "#3A3F4A"}" />
      ${tvAan ? `<circle cx="266" cy="212" r="2.6" fill="${ACTIE.zon}" />
      <path d="M240.5 225.5 L248 216 L253 221 L258 215 L273.5 225.5 Z" fill="${ACTIE.levert}" opacity="0.9" />` : ""}
    </g>
    <rect x="116" y="192" width="12" height="5" rx="1.5" style="fill: var(--k-line3)" />
    <rect x="100" y="196" width="44" height="40" rx="5" style="fill: var(--k-card); stroke: var(--k-line3)" />
    <rect x="103" y="${199 + 34 - accuHoogte}" width="38" height="${accuHoogte}" rx="3" fill="${s.accuKleur}" />
    <text x="122" y="221" font-size="12" font-weight="700" text-anchor="middle" class="cijfer"
          style="fill: ${accuHoogte > 20 ? "#fff" : "var(--k-ink)"}">${s.soc != null ? Math.round(s.soc) + "%" : "\u2014"}</text>
    ${s.heeftBoiler ? `<g>
      <defs><clipPath id="${this._clip}"><rect x="183" y="99" width="16" height="24" rx="7" /></clipPath></defs>
      <path d="M202 117 H210 V122" fill="none" stroke-width="3" stroke-linecap="round" style="stroke: var(--k-line3)" />
      <rect x="205" y="113" width="5" height="2" rx="1" style="fill: var(--k-line3)" />
      <line x1="207.5" y1="115" x2="207.5" y2="117" stroke-width="1.5" style="stroke: var(--k-line3)" />
      <rect x="180" y="96" width="22" height="30" rx="10" style="fill: var(--k-card); stroke: var(--k-line3)" />
      <g clip-path="url(#${this._clip})">
        <path class="boiler-golf" opacity="0.85" style="fill: ${boilerKleur}"
              d="M173 104 q2.5 -2 5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 t5 0 V127 H173 Z" />
      </g></g>` : ""}
    ${s.heeftAuto ? `<g transform="translate(2 216)" opacity="${s.auto > 50 ? 1 : 0.45}">
      <path d="M4 22 L4 14 Q6 9 12 8 L20 2 Q22 1 26 1 L42 1 Q46 1 49 4 L55 9 Q62 10 63 15 L63 22 Z" fill="${ACTIE.auto}" />
      <rect x="22" y="4" width="22" height="7" rx="2" opacity="0.7" style="fill: var(--k-fill)" />
      <circle cx="16" cy="23" r="6" style="fill: var(--k-ink)" /><circle cx="51" cy="23" r="6" style="fill: var(--k-ink)" />
      <circle cx="16" cy="23" r="2.4" style="fill: var(--k-card)" /><circle cx="51" cy="23" r="2.4" style="fill: var(--k-card)" />
    </g>` : ""}
    <circle cx="300" cy="246" r="3.5" stroke-width="1.5" style="fill: var(--k-card); stroke: var(--k-muted)" />
    ${s.heeftZon || s.donker ? `<g transform="translate(22 30)">${!s.donker ? `
      <g opacity="${s.pv > 50 ? 1 : 0.35}">
        <g id="stralen" stroke="${ACTIE.zon}" stroke-width="2" stroke-linecap="round">
          <line x1="0" y1="-17" x2="0" y2="-13" /><line x1="0" y1="17" x2="0" y2="13" />
          <line x1="-17" y1="0" x2="-13" y2="0" /><line x1="17" y1="0" x2="13" y2="0" />
          <line x1="-12" y1="-12" x2="-9.2" y2="-9.2" /><line x1="12" y1="12" x2="9.2" y2="9.2" />
          <line x1="-12" y1="12" x2="-9.2" y2="9.2" /><line x1="12" y1="-12" x2="9.2" y2="-9.2" />
        </g>
        <circle r="8.5" fill="${ACTIE.zon}" />
      </g>` : `
      <g>
        <circle r="10" fill="${MAAN}" />
        <circle cx="5" cy="-4" r="9" style="fill: var(--k-card)" />
        <circle cx="-19" cy="-12" r="1.2" fill="${MAAN}" /><circle cx="14" cy="10" r="1" fill="${MAAN}" />
        <circle cx="-14" cy="14" r="0.9" fill="${MAAN}" />
      </g>`}</g>` : ""}
    ${s.heeftZon ? `<g>
      <text x="46" y="24" font-size="11" style="fill: var(--k-muted)">Zon</text>
      <text x="46" y="42" font-size="15" font-weight="700" class="cijfer" style="fill: var(--k-ink)">${fmtW(s.pv)}</text>
    </g>` : ""}
    <text x="238" y="24" font-size="11" style="fill: var(--k-muted)">Huis</text>
    <text x="238" y="42" font-size="15" font-weight="700" class="cijfer" style="fill: var(--k-ink)">${fmtW(s.huis)}</text>
    ${onder.map((l) => `<g transform="translate(${l.x} ${l.dy ?? 0})">
      <text y="270" font-size="11" style="fill: var(--k-muted)">${esc(l.naam)}</text>
      <text y="287" font-size="14" font-weight="700" class="cijfer" style="fill: var(--k-ink)">${esc(l.waarde)}</text>
      <rect y="295" height="16" rx="4" fill="none" width="${l.pil.length * 6.3 + 13}" stroke="${l.kleur}" />
      <text x="6" y="306.5" font-size="10" font-weight="600" fill="${l.kleur}">${esc(l.pil)}</text>
    </g>`).join("")}
  </svg>
  ${mix.map((m) => `<div class="mix">
    <span class="mix-titel">${m.titel}</span>
    <div class="mix-balk">${m.delen.map((d) => `<i class="mix-deel" style="flex-grow:${d.w};background-color:${d.kleur}"></i>`).join("")}</div>
    <div class="mix-legenda">${m.delen.map((d) => `<span><b style="background:${d.kleur}"></b>${d.naam} ${d.pct}%</span>`).join("") || "<span>niets</span>"}</div>
  </div>`).join("")}
  </div>
</ha-card>`;
    this._deeltjesG = this.shadowRoot.getElementById("deeltjes");
    this._stralenG = this.shadowRoot.getElementById("stralen");
    this._pool = [];
  }

  // Bolletjes rechtstreeks in de DOM vanuit requestAnimationFrame (zoals in de portal).
  _stap(tijd) {
    this._raf = requestAnimationFrame((t) => this._stap(t));
    const dt = this._vorige ? Math.min(0.1, (tijd - this._vorige) / 1000) : 0;
    this._vorige = tijd;
    const s = this._stand;
    if (!s || s.leeg || !this._deeltjesG) return;
    this._fasen = this._fasen || {};
    let n = 0;
    if (!s.stil) {
      for (const f of stromen(s)) {
        const doelen = f.naar === "huis" ? ["lamp", "tv"] : [f.naar];
        if (f.w < 30 || !this._draden[f.van] || !doelen.every((d) => this._draden[d])) continue;
        const totaal = Math.min(10, 2 + Math.round(f.w / 1100));
        const snelheid = 28 + Math.sqrt(f.w) * 1.1;
        for (const doel of doelen) {
          const pd = pad(f.van, doel);
          const aantal = Math.max(1, Math.round(totaal / doelen.length));
          const sleutel = f.van + ">" + doel;
          this._fasen[sleutel] = ((this._fasen[sleutel] ?? 0) + dt * snelheid / pd.len) % 1;
          for (let i = 0; i < aantal; i++) {
            const fase = this._reduce ? (i + 0.5) / aantal : (this._fasen[sleutel] + i / aantal) % 1;
            const [x, y] = puntOp(pd.pts, fase, pd.len);
            const c = this._bolletje(n++);
            c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1));
            c.setAttribute("fill", BRON_KLEUR[f.van]); c.setAttribute("visibility", "visible");
          }
        }
      }
    }
    for (let i = n; i < this._pool.length; i++) this._pool[i].setAttribute("visibility", "hidden");
    if (this._stralenG && !this._reduce && !s.stil) this._stralenG.setAttribute("transform", `rotate(${(tijd / 60) % 360})`);
  }

  _bolletje(i) {
    if (!this._pool[i]) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("r", "3.2");
      this._deeltjesG.appendChild(c);
      this._pool[i] = c;
    }
    return this._pool[i];
  }
}

const CSS = `
:host {
  --k-card: var(--ha-card-background, var(--card-background-color, #fff));
  --k-fill: var(--secondary-background-color, #F6F7F3);
  --k-line: var(--divider-color, #E3E6DE);
  --k-line3: var(--divider-color, #DCDFD6);
  --k-ink: var(--primary-text-color, #101614);
  --k-muted: var(--secondary-text-color, #5D6661);
}
.inhoud { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.card-header { margin: 0; padding: 16px 16px 0; font-size: var(--ha-card-header-font-size, 24px); font-weight: normal; color: var(--ha-card-header-color, var(--primary-text-color)); }
svg { width: 100%; height: auto; display: block; font-family: inherit; }
.cijfer { font-variant-numeric: tabular-nums; }
.mix { display: flex; flex-direction: column; gap: 6px; }
.mix-titel { font-size: 12px; color: var(--k-muted); }
.mix-balk { display: flex; height: 12px; border-radius: 6px; overflow: hidden; gap: 2px; background: var(--k-fill); }
.mix-legenda { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--k-muted); }
.mix-legenda span { display: inline-flex; align-items: center; gap: 6px; }
.mix-legenda b { width: 8px; height: 8px; border-radius: 3px; display: inline-block; }
.mix-deel {
  display: block; height: 100%; min-width: 0;
  background-image: repeating-linear-gradient(110deg, rgba(255,255,255,0) 0 8px, rgba(255,255,255,.35) 8px 11px);
  background-size: 40px 100%;
  animation: mix-strepen 1.4s linear infinite;
}
@keyframes mix-strepen { to { background-position: 40px 0; } }
.boiler-golf { animation: golfjes 2.4s linear infinite; }
.tv-beeld { animation: tv-flikker 3.1s steps(1) infinite; }
@keyframes tv-flikker { 0%, 100% { opacity: 1; } 37% { opacity: .82; } 41% { opacity: 1; } 73% { opacity: .9; } }
@keyframes golfjes { to { transform: translateX(-10px); } }
.huis-stil { filter: grayscale(1); opacity: .6; }
.huis-stil .mix-deel, .huis-stil .boiler-golf, .huis-stil .tv-beeld { animation: none; }
@media (prefers-reduced-motion: reduce) { .mix-deel, .boiler-golf, .tv-beeld { animation: none; } }
`;

// -- Instelscherm in de dashboard-editor --------------------------------------
class SmartDevicesEmsHuisEditor extends HTMLElement {
  setConfig(config) { this._config = { ...config }; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => ({
        apparaat: "Installatie (leeg = de eerste)", titel: "Titel (optioneel)", zon: "Zonnepanelen tonen",
      }[s.name] ?? s.name);
      this._form.addEventListener("value-changed", (ev) => {
        const cfg = { ...ev.detail.value };
        for (const k of Object.keys(cfg)) if (cfg[k] === "" || cfg[k] === undefined) delete cfg[k];
        if (cfg.zon === true) delete cfg.zon;
        this._config = cfg;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = [
      { name: "apparaat", selector: { device: { integration: DOMEIN } } },
      { name: "titel", selector: { text: {} } },
      { name: "zon", selector: { boolean: {} } },
    ];
    this._form.data = { zon: true, ...this._config };
  }
}

if (!customElements.get("smart-devices-ems-huis")) {
  customElements.define("smart-devices-ems-huis", SmartDevicesEmsHuis);
  customElements.define("smart-devices-ems-huis-editor", SmartDevicesEmsHuisEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "smart-devices-ems-huis",
    name: "Smart Devices EMS: nu in huis",
    description: "Het huis met de stroom van zon, accu, net, auto en boiler, zoals in de EMS-portal.",
    preview: true,
  });
}
