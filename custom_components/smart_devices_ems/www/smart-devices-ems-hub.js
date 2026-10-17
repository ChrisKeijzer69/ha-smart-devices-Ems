// Scherm voor een Google Nest Hub (type: custom:smart-devices-ems-hub).
//
// Bedoeld om met Home Assistant Cast op een Nest Hub te zetten: een gecast dashboard
// reageert niet op aanraken, dus dit is een kijkscherm zonder knoppen. Alles is getekend
// op een vast canvas van 1024 x 600 (de Nest Hub) en wordt als geheel geschaald naar de
// ruimte die er is, zodat het ook op een Hub Max of in de dashboard-editor klopt.
// Bewust schalen met transform en geen container-eenheden: de browser van de Hub is
// niet de nieuwste.
//
// Twee weergaven:
//   weergave: ringen  grote ringen en getallen, zoals het HomeWizard Energy Display
//   weergave: huis    de huistekening van smart-devices-ems-huis met een zijpaneel
// Standaard donker (thema: donker); "ha" volgt het thema van Home Assistant.
//
// vindEntiteiten en fmtW zijn een kopie van smart-devices-ems-huis.js (zelfde map);
// pas ze daar ook aan. Puur ASCII, om dezelfde reden als die kaart.

const DOMEIN = "smart_devices_ems";
const B = 1024, H = 600;
const KLEUR = {
  levert: "#0F9D6B", zon: "#F59E0B", net: "#3B5BDB",
  wacht: "#9AA39E", auto: "#22A355", boiler: "#0EA5C6", huis: "var(--h-ink)",
};
// Zelfde tokens als de klantweergave van de portal (styles/klant.css).
const THEMA = {
  licht: { bg: "#F3F4EF", card: "#FFFFFF", fill: "#F6F7F3", line: "#E3E6DE", ink: "#101614", muted: "#5D6661", waarsch: "#7A3E00", waarschBg: "#FFF4E5" },
  donker: { bg: "#0D1210", card: "#161D1A", fill: "#1C2521", line: "#26302B", ink: "#ECF1EE", muted: "#9CA9A2", waarsch: "#FFCF8A", waarschBg: "#33260F" },
};
const ACTIE_KLEUR = { levert: KLEUR.levert, zon: KLEUR.zon, net: KLEUR.net, wacht: KLEUR.wacht, onderhoud: KLEUR.wacht };

function vindEntiteiten(hass, deviceId) {
  const per = {};
  let apparaat = deviceId;
  for (const e of Object.values(hass.entities || {})) {
    if (e.platform !== DOMEIN || !e.translation_key) continue;
    if (!apparaat) apparaat = e.device_id;
    if (e.device_id !== apparaat) continue;
    per[e.translation_key] = e.entity_id;
  }
  return per;
}

const nl = (v, d) => v.toLocaleString("nl-NL", { minimumFractionDigits: d, maximumFractionDigits: d });
function fmtW(w) {
  const a = Math.abs(w ?? 0);
  if (a >= 1000) return { getal: nl(a / 1000, 1), eenheid: "kW" };
  return { getal: String(Math.round(a)), eenheid: "W" };
}
const fmtKwh = (v) => (v == null ? "\u2014" : nl(v, v >= 100 ? 0 : 1));
const fmtCt = (eur) => (eur == null ? "\u2014" : nl(eur * 100, 1));
function fmtTijd(iso) {
  if (!iso || ["unknown", "unavailable"].includes(iso)) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function leesStand(hass, ent) {
  const st = (k) => (ent[k] ? hass.states[ent[k]] : undefined);
  const getal = (k) => {
    const v = parseFloat(st(k)?.state);
    return Number.isFinite(v) ? v : null;
  };
  const tekst = (k) => {
    const v = st(k)?.state;
    return v && !["unknown", "unavailable"].includes(v) ? v : null;
  };
  return {
    pv: getal("vermogen_zon") ?? 0, huis: getal("vermogen_huis") ?? 0,
    bat: getal("vermogen_accu") ?? 0, grid: getal("vermogen_net") ?? 0,
    auto: getal("vermogen_auto"), boiler: getal("vermogen_boiler"),
    soc: getal("accu_stand"), autoSoc: getal("auto_stand"), autoStatus: tekst("auto_status"),
    temp: getal("boiler_temperatuur"),
    heeftAuto: !!ent.vermogen_auto, heeftBoiler: !!ent.vermogen_boiler,
    prijs: getal("prijs_nu"), prijsUur: getal("prijs_over_een_uur"),
    laagst: getal("prijs_laagst_vandaag"), hoogst: getal("prijs_hoogst_vandaag"), laagstOm: fmtTijd(tekst("prijs_laagst_vandaag_om")),
    zonDag: getal("vandaag_zon"), huisDag: getal("vandaag_huis"),
    afnameDag: getal("vandaag_net_afname"), terugDag: getal("vandaag_net_terug"),
    autoDag: getal("vandaag_auto"), boilerDag: getal("vandaag_boiler"),
    bespaard: getal("besparing_vandaag"),
    gas: getal("gas_vandaag"), gasGem: getal("gas_gemiddeld_dag"),
    water: getal("water_vandaag"), waterGem: getal("water_gemiddeld_dag"),
    heeftGas: !!ent.gas_vandaag, heeftWater: !!ent.water_vandaag,
    aiNu: tekst("ai_nu"), aiActie: tekst("ai_nu_actie"),
    aiStraks: tekst("ai_straks"), aiStraksOm: fmtTijd(tekst("ai_straks_om")),
    verouderd: tekst("verouderd") === "on",
    leeg: !ent.vermogen_huis,
  };
}

const AUTO_TEKST = {
  kabel_los: "kabel los", aangesloten: "aangesloten", laadt: "laadt",
  vol: "vol", wacht_op_zon: "wacht op zon", wacht: "wacht",
};

// "Je stroom komt nu van" / "en gaat naar": zelfde verdeling als de huiskaart.
function balk(delen) {
  const zicht = delen.filter((d) => d.w > 50);
  const tot = zicht.reduce((a, d) => a + d.w, 0) || 1;
  return zicht.map((d) => ({ ...d, pct: Math.round(d.w / tot * 100) }));
}
function mixen(s) {
  return [
    { titel: "Je stroom komt nu van", delen: balk([
      { naam: "zon", w: Math.max(0, s.pv), kleur: KLEUR.zon },
      { naam: "accu", w: Math.max(0, -s.bat), kleur: KLEUR.levert },
      { naam: "net", w: Math.max(0, s.grid), kleur: KLEUR.net },
    ]) },
    { titel: "en gaat naar", delen: balk([
      // Huis in de tekstkleur en auto lichtgroen, zoals "Nu in huis" in de portal (16 okt 2026).
      { naam: "huis", w: Math.max(0, s.huis), kleur: KLEUR.huis },
      { naam: "auto", w: Math.max(0, s.auto ?? 0), kleur: RING.auto },
      { naam: "boiler", w: Math.max(0, s.boiler ?? 0), kleur: KLEUR.boiler },
      { naam: "accu", w: Math.max(0, s.bat), kleur: ACTIE_KLEUR[s.aiActie] ?? KLEUR.levert },
      { naam: "terug naar net", w: Math.max(0, -s.grid), kleur: KLEUR.levert },
    ]) },
  ];
}
const mixHtml = (m) => `<div class="mix">
  <div class="mix-titel">${m.titel}</div>
  <div class="mix-balk">${m.delen.map((d) => `<i style="flex-grow:${d.w};background:${d.kleur}"></i>`).join("")}</div>
  <div class="mix-legenda">${m.delen.map((d) => `<span><b style="background:${d.kleur}"></b>${d.naam} ${d.pct}%</span>`).join("") || "<span>niets</span>"}</div>
</div>`;

// -- Weergave "ringen": zoals het HomeWizard Energy Display -----------------
// Zelfde kleuren als STREAM in de portal (portal/frontend/src/utils/colors.js):
// afname paars, teruglevering groen, zon amber, gas rozerood, water blauw.
// Pas ze daar ook aan als ze hier veranderen.
const RING = { gas: "#E11D48", water: "#3B82F6", net: "#A855F7", terug: "#10B981", zon: "#F59E0B",
  auto: "#4ADE80", boiler: "#06B6D4", prijs: "#F59E0B", euro: "#10B981" };
const klem = (v) => Math.max(0, Math.min(1, v));

function ring(cx, cy, r, dikte, frac, kleur) {
  const omtrek = 2 * Math.PI * r;
  const f = klem(frac);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke-width="${dikte}" style="stroke: var(--h-line)" />`
    + (f > 0.004 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${kleur}" stroke-width="${dikte}"
        stroke-linecap="round" stroke-dasharray="${(f * omtrek).toFixed(1)} ${omtrek.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" />` : "");
}

const ICOON = {
  prijs: `<path d="M8 20 L20 8 H32 V20 L20 32 Z" /><circle cx="26" cy="14" r="2.2" />`,
  euro: `<circle cx="20" cy="20" r="13" /><path d="M25 14.5 A7 7 0 1 0 25 25.5 M11 18 H22 M11 22 H22" />`,
  auto: `<path d="M6 26 V20 L10 13 H30 L34 20 V26 Z M6 26 V29 M34 26 V29" /><circle cx="12" cy="22" r="1.6" /><circle cx="28" cy="22" r="1.6" />`,
  boiler: `<path d="M17 25 V8 A3 3 0 0 1 23 8 V25 A6 6 0 1 1 17 25 Z" /><path d="M20 15 V28" />`,
  zon: `<circle cx="20" cy="20" r="6.5" /><path d="M20 5 V9 M20 31 V35 M5 20 H9 M31 20 H35 M9.4 9.4 L12.2 12.2 M27.8 27.8 L30.6 30.6 M9.4 30.6 L12.2 27.8 M27.8 12.2 L30.6 9.4" />`,
};

// "12 \u20ac67": het hele getal groot, eenheid en decimalen klein ernaast.
function regel({ icoon, kleur, heel, boven, onder, balk = "", label }) {
  return `<div class="regel">
    <svg class="icoon" viewBox="0 0 40 40" fill="none" stroke="${kleur}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICOON[icoon]}</svg>
    <div class="regel-rechts">
      <div class="regel-getal cijfer"><span class="heel">${heel}</span><span class="stapel"><span>${boven}</span><span>${onder}</span></span></div>
      ${balk}
      <div class="regel-label">${label}</div>
    </div>
  </div>`;
}
const balkVol = (frac, kleur) => `<div class="balk"><i style="width:${(klem(frac) * 100).toFixed(1)}%;background:${kleur}"></i></div>`;
const balkPunt = (frac, kleur) => `<div class="balk schuif"><b style="left:${(klem(frac) * 100).toFixed(1)}%;background:${kleur}"></b></div>`;
function splits(v, d) {                            // 21.34 -> ["21", "3"]
  const [h, f = ""] = nl(v, d).split(",");
  return [h, f];
}

function stroomRegels(s) {
  const regels = [];
  if (s.prijs != null) {
    const [h, f] = splits(s.prijs * 100, 1);
    const bereik = s.hoogst != null && s.laagst != null && s.hoogst > s.laagst ? (s.prijs - s.laagst) / (s.hoogst - s.laagst) : 0.5;
    regels.push(regel({ icoon: "prijs", kleur: RING.prijs, heel: h, boven: "ct", onder: f,
      balk: balkPunt(bereik, RING.prijs),
      label: s.laagst != null && s.hoogst != null ? `${fmtCt(s.laagst)} \u2013 ${fmtCt(s.hoogst)} vandaag` : "per kWh" }));
  }
  if (s.bespaard != null) {
    const [h, f] = splits(s.bespaard, 2);
    regels.push(regel({ icoon: "euro", kleur: RING.euro, heel: h, boven: "\u20ac", onder: f,
      balk: balkVol(1, RING.euro), label: "bespaard vandaag" }));
  }
  if (s.heeftAuto && s.autoSoc != null) {
    const laadt = (s.auto ?? 0) > 50;
    regels.push(regel({ icoon: "auto", kleur: RING.auto, heel: String(Math.round(s.autoSoc)), boven: "%",
      onder: laadt ? fmtW(s.auto).getal : "", balk: balkVol(s.autoSoc / 100, RING.auto),
      label: laadt ? `auto laadt \u00b7 ${fmtW(s.auto).getal} ${fmtW(s.auto).eenheid}` : `auto \u00b7 ${AUTO_TEKST[s.autoStatus] ?? "wacht"}` }));
  } else if (s.heeftBoiler && s.temp != null) {
    regels.push(regel({ icoon: "boiler", kleur: RING.boiler, heel: String(Math.round(s.temp)), boven: "\u00b0C", onder: "",
      balk: balkPunt((s.temp - 30) / 40, RING.boiler), label: (s.boiler ?? 0) > 50 ? "boiler warmt op" : "boiler" }));
  } else if (s.zonDag != null) {
    const [h, f] = splits(s.zonDag, 1);
    regels.push(regel({ icoon: "zon", kleur: RING.zon, heel: h, boven: "kWh", onder: f, label: "zon vandaag" }));
  }

  return regels;
}

function ringenHtml(s, cfg) {
  if (s.heeftGas || s.heeftWater) return ringenGasWaterHtml(s, cfg);
  const netAf = s.grid > 50, netTerug = s.grid < -50;
  const netKleur = netTerug ? RING.terug : RING.net;
  const net = fmtW(s.grid), zon = fmtW(s.pv);
  const netMax = cfg.net_max_w || 6000, zonMax = cfg.zon_max_w || 5000;
  const accuKleur = { levert: RING.terug, zon: RING.zon, net: RING.net }[s.aiActie] ?? "#9AA39E";
  const accuTekst = s.bat > 50 ? "laadt" : s.bat < -50 ? "levert" : "accu";

  const regels = stroomRegels(s);

  return `<div class="ringen">
    <svg class="ringen-svg" viewBox="0 0 ${B} ${H}" aria-hidden="true">
      ${ring(250, 262, 178, 30, Math.abs(s.grid) / netMax, netKleur)}
      <text x="250" y="200" text-anchor="middle" font-size="22" style="fill: var(--h-muted)">${netAf ? "van het net" : netTerug ? "terug naar het net" : "net"}</text>
      <text x="250" y="292" text-anchor="middle" font-size="112" font-weight="600" class="cijfer" style="fill: var(--h-ink)">${net.getal}</text>
      <text x="250" y="340" text-anchor="middle" font-size="34" font-weight="600" fill="${netKleur}">${net.eenheid}</text>
      <text x="250" y="532" text-anchor="middle" font-size="34" font-weight="600" class="cijfer" style="fill: var(--h-ink)"><tspan fill="${RING.terug}">\u2191</tspan>${fmtKwh(s.terugDag)}<tspan dx="26" fill="${RING.net}">\u2193</tspan>${fmtKwh(s.afnameDag)}</text>
      <text x="250" y="562" text-anchor="middle" font-size="18" style="fill: var(--h-muted)">kWh vandaag</text>

      ${ring(585, 160, 104, 20, (s.soc ?? 0) / 100, accuKleur)}
      <text x="585" y="122" text-anchor="middle" font-size="18" style="fill: var(--h-muted)">${accuTekst}</text>
      <text x="585" y="180" text-anchor="middle" font-size="64" font-weight="600" class="cijfer" style="fill: var(--h-ink)">${s.soc != null ? Math.round(s.soc) : "\u2014"}</text>
      <text x="585" y="214" text-anchor="middle" font-size="26" font-weight="600" fill="${accuKleur}">%</text>

      ${ring(585, 440, 104, 20, s.pv / zonMax, RING.zon)}
      <text x="585" y="402" text-anchor="middle" font-size="18" style="fill: var(--h-muted)">zon</text>
      <text x="585" y="460" text-anchor="middle" font-size="64" font-weight="600" class="cijfer" style="fill: var(--h-ink)">${zon.getal}</text>
      <text x="585" y="494" text-anchor="middle" font-size="26" font-weight="600" fill="${RING.zon}">${zon.eenheid}</text>
    </svg>
    <section class="regels">${regels.join("")}</section>
  </div>`;
}

// Met gas en/of water: links alles van stroom bij elkaar, rechts gas en water.
// Hun ring is vol bij het gemiddelde dagverbruik van de afgelopen vier weken.
function ringenGasWaterHtml(s, cfg) {
  const netAf = s.grid > 50, netTerug = s.grid < -50;
  const netKleur = netTerug ? RING.terug : RING.net;
  const net = fmtW(s.grid), zon = fmtW(s.pv);
  const netMax = cfg.net_max_w || 6000, zonMax = cfg.zon_max_w || 5000;
  const accuKleur = { levert: RING.terug, zon: RING.zon, net: RING.net }[s.aiActie] ?? "#9AA39E";
  const accuTekst = s.bat > 50 ? "laadt" : s.bat < -50 ? "levert" : "accu";
  const tekst = (x, y, grootte, inhoud, extra = 'style="fill: var(--h-ink)"', gewicht = 600) =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-size="${grootte}" font-weight="${gewicht}" class="cijfer" ${extra}>${inhoud}</text>`;
  const zacht = 'style="fill: var(--h-muted)"';
  const meter = (cx, cy, naam, kleur, waarde, gem, eenheid, d) => {
    const v = waarde == null ? "\u2014" : nl(waarde, d);
    return ring(cx, cy, 92, 18, gem ? (waarde ?? 0) / gem : 0, kleur)
      + tekst(cx, cy - 34, 17, naam, zacht, 400)
      + tekst(cx, cy + 18, 54, v)
      + tekst(cx, cy + 46, 22, eenheid, `fill="${kleur}"`)
      + (gem ? tekst(cx, cy + 68, 14, `gem. ${nl(gem, d)}`, zacht, 400) : "");
  };
  const gw = [];
  if (s.heeftWater) gw.push((cy) => meter(880, cy, "water vandaag", RING.water, s.water, s.waterGem, "liter", 0));
  if (s.heeftGas) gw.push((cy) => meter(880, cy, "gas vandaag", RING.gas, s.gas, s.gasGem, "m\u00b3", 2));
  const ys = gw.length === 2 ? [160, 420] : [290];

  return `<div class="ringen">
    <svg class="ringen-svg" viewBox="0 0 ${B} ${H}" aria-hidden="true">
      ${ring(196, 222, 160, 26, Math.abs(s.grid) / netMax, netKleur)}
      ${tekst(196, 150, 20, netAf ? "van het net" : netTerug ? "terug naar het net" : "net", zacht, 400)}
      ${tekst(196, 248, 100, net.getal)}
      ${tekst(196, 288, 30, net.eenheid, `fill="${netKleur}"`)}
      <text x="196" y="336" text-anchor="middle" font-size="24" font-weight="600" class="cijfer" style="fill: var(--h-ink)"><tspan fill="${RING.terug}">\u2191</tspan>${fmtKwh(s.terugDag)}<tspan dx="16" fill="${RING.net}">\u2193</tspan>${fmtKwh(s.afnameDag)}<tspan dx="8" font-size="16" font-weight="400" style="fill: var(--h-muted)">kWh</tspan></text>

      ${ring(520, 118, 86, 17, (s.soc ?? 0) / 100, accuKleur)}
      ${tekst(520, 86, 17, accuTekst, zacht, 400)}
      ${tekst(520, 134, 54, s.soc != null ? Math.round(s.soc) : "\u2014")}
      ${tekst(520, 162, 22, "%", `fill="${accuKleur}"`)}

      ${ring(520, 328, 86, 17, s.pv / zonMax, RING.zon)}
      ${tekst(520, 296, 17, "zon", zacht, 400)}
      ${tekst(520, 344, 54, zon.getal)}
      ${tekst(520, 372, 22, zon.eenheid, `fill="${RING.zon}"`)}

      <line x1="728" y1="40" x2="728" y2="560" stroke-width="2" style="stroke: var(--h-line)" />
      ${gw.map((f, i) => f(ys[i])).join("")}
    </svg>
    <section class="strook">${stroomRegels(s).join("")}</section>
  </div>`;
}

function huisPaneelHtml(s) {
  return `<div class="huis-scherm">
    <div class="huis-plek"></div>
    <section class="paneel">
      <div class="klok cijfer" data-klok></div>
      ${s.aiNu ? `<p class="ai-nu groot"><b style="background:${ACTIE_KLEUR[s.aiActie] ?? KLEUR.wacht}"></b>${esc(s.aiNu)}</p>` : ""}
      ${s.aiStraks ? `<p class="ai-straks">${s.aiStraksOm ? `<span>Vanaf ${s.aiStraksOm}</span>` : "<span>Straks</span>"}${esc(s.aiStraks)}</p>` : ""}
      ${mixen(s).map(mixHtml).join("")}
      <div class="mini">
        <div><span>Stroomprijs</span><b class="cijfer">${fmtCt(s.prijs)} ct</b></div>
        <div><span>Bespaard vandaag</span><b class="cijfer">${s.bespaard != null ? "\u20ac " + nl(s.bespaard, 2) : "\u2014"}</b></div>
      </div>
    </section>
  </div>`;
}

class SmartDevicesEmsHub extends HTMLElement {
  static getStubConfig() { return { weergave: "ringen" }; }
  static getConfigElement() { return document.createElement("smart-devices-ems-hub-editor"); }

  setConfig(config) {
    this._config = { weergave: "ringen", ...config };
    this._sleutel = null;
    this._huis = null;
    if (this._hass) this.hass = this._hass;
  }

  getCardSize() { return 10; }
  getGridOptions() { return { columns: "full", rows: "auto" }; }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const ent = vindEntiteiten(hass, this._config.apparaat);
    const s = leesStand(hass, ent);
    const sleutel = JSON.stringify(s);
    if (this._huis) this._huis.hass = hass;
    if (sleutel === this._sleutel) return;
    this._sleutel = sleutel;
    this._stand = s;
    this._teken();
  }

  connectedCallback() {
    if (!this._ro) {
      this._ro = new ResizeObserver(() => this._schaal());
      this._ro.observe(this);
    }
    this._klokTimer = this._klokTimer || setInterval(() => this._klok(), 15000);
  }
  disconnectedCallback() {
    this._ro?.disconnect();
    this._ro = null;
    clearInterval(this._klokTimer);
    this._klokTimer = 0;
  }

  _thema() {
    const k = this._config.thema ?? "donker";
    if (k === "licht" || k === "donker") return THEMA[k];
    return null;                                   // "ha": de kleuren van het HA-thema
  }

  _teken() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const s = this._stand;
    const th = this._thema();
    const vars = th ? `--h-bg:${th.bg};--h-card:${th.card};--h-fill:${th.fill};--h-line:${th.line};--h-ink:${th.ink};--h-muted:${th.muted};--h-w:${th.waarsch};--h-wbg:${th.waarschBg};`
      + `--primary-text-color:${th.ink};--secondary-text-color:${th.muted};--divider-color:${th.line};--card-background-color:${th.card};--ha-card-background:${th.card};--secondary-background-color:${th.fill};` : "";
    const huis = this._config.weergave === "huis";
    let inhoud;
    if (s.leeg) inhoud = `<div class="leeg">Geen Smart Devices EMS gevonden. Voeg eerst de integratie toe.</div>`;
    else inhoud = huis ? huisPaneelHtml(s) : ringenHtml(s, this._config);
    this.shadowRoot.innerHTML = `<style>${CSS}</style>
      <div class="buiten" style="${vars}"><div class="canvas">
        ${s.verouderd ? `<div class="oud">Geen verse gegevens van de installatie</div>` : ""}
        ${inhoud}
      </div></div>`;
    if (huis && !s.leeg && !customElements.get("smart-devices-ems-huis")) {
      // De twee kaarten zijn aparte bronnen en laden in willekeurige volgorde.
      customElements.whenDefined("smart-devices-ems-huis").then(() => { this._sleutel = null; this.hass = this._hass; });
    } else if (huis && !s.leeg) {
      // De tekening zelf komt uit de huiskaart, zonder balken (die staan in het paneel).
      if (!this._huis) {
        this._huis = document.createElement("smart-devices-ems-huis");
        this._huis.setConfig({ mix: false, beweging: this._config.beweging, apparaat: this._config.apparaat, zon: this._config.zon });
      }
      this.shadowRoot.querySelector(".huis-plek").appendChild(this._huis);
      this._huis.hass = this._hass;
    } else {
      this._huis = null;
    }
    this._klok();
    this._schaal();
  }

  _klok() {
    const el = this.shadowRoot?.querySelector("[data-klok]");
    if (el) el.textContent = new Date().toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  }

  _schaal() {
    const buiten = this.shadowRoot?.querySelector(".buiten");
    const canvas = this.shadowRoot?.querySelector(".canvas");
    if (!buiten || !canvas) return;
    const breed = this.clientWidth || B;
    // Op het scherm zelf (cast) vult hij de hoogte; in een gewoon dashboard de breedte.
    const hoog = this._config.vullen === false ? breed * H / B : Math.min(window.innerHeight || H, breed * H / B);
    const f = Math.min(breed / B, hoog / H);
    buiten.style.height = `${H * f}px`;
    canvas.style.transform = `scale(${f})`;
  }
}

const CSS = `
:host { display: block; }
.buiten {
  --h-bg: var(--primary-background-color, #F3F4EF); --h-card: var(--ha-card-background, var(--card-background-color, #fff));
  --h-fill: var(--secondary-background-color, #F6F7F3); --h-line: var(--divider-color, #E3E6DE);
  --h-ink: var(--primary-text-color, #101614); --h-muted: var(--secondary-text-color, #5D6661);
  --h-w: #7A3E00; --h-wbg: #FFF4E5;
  background: var(--h-bg); color: var(--h-ink); overflow: hidden; position: relative;
  font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, system-ui, sans-serif));
}
.canvas { width: ${B}px; height: ${H}px; transform-origin: 0 0; position: relative; box-sizing: border-box; }
.cijfer { font-variant-numeric: tabular-nums; }
.leeg { padding: 40px; font-size: 22px; }
.oud { position: absolute; top: 0; left: 0; right: 0; z-index: 2; text-align: center; padding: 6px;
  font-size: 15px; font-weight: 600; color: var(--h-w); background: var(--h-wbg); }

.ringen { position: relative; width: 100%; height: 100%; }
.ringen-svg { position: absolute; inset: 0; width: 100%; height: 100%; font-family: inherit; }
.regels { position: absolute; left: 730px; top: 40px; bottom: 40px; width: 270px;
  display: flex; flex-direction: column; justify-content: space-around; }
.regel { display: flex; align-items: center; gap: 18px; }
.strook { position: absolute; left: 24px; width: 680px; top: 448px; height: 128px;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; align-items: center; }
.strook .regel { gap: 12px; }
.strook .icoon { width: 34px; height: 34px; }
.strook .heel { font-size: 50px; }
.strook .stapel { font-size: 17px; gap: 3px; }
.strook .regel-label { font-size: 13px; }
.icoon { width: 44px; height: 44px; flex: none; }
.regel-rechts { flex: 1; min-width: 0; }
.regel-getal { display: flex; align-items: center; gap: 6px; line-height: 1; }
.heel { font-size: 70px; font-weight: 600; letter-spacing: -1px; }
.stapel { display: flex; flex-direction: column; gap: 6px; font-size: 22px; font-weight: 600; color: var(--h-muted); }
.balk { position: relative; height: 6px; border-radius: 3px; background: var(--h-line); margin-top: 10px; overflow: visible; }
.balk i { display: block; height: 100%; border-radius: 3px; }
.balk.schuif b { position: absolute; top: 50%; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 8px; }
.regel-label { margin-top: 7px; font-size: 15px; color: var(--h-muted); white-space: nowrap; }
.ai-nu { margin: 0; font-size: 19px; line-height: 1.3; font-weight: 600; display: flex; gap: 10px; }
.ai-nu b { flex: none; width: 12px; height: 12px; border-radius: 6px; margin-top: 7px; }
.ai-nu.groot { font-size: 24px; }
.ai-straks { margin: 0; font-size: 16px; line-height: 1.35; color: var(--h-muted); }
.ai-straks span { display: block; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 2px; }

.huis-scherm { display: grid; grid-template-columns: 620px 1fr; height: 100%; }
.huis-plek { display: flex; align-items: center; padding: 8px 0 8px 8px; }
.huis-plek > * { width: 100%; --ha-card-border-width: 0; --ha-card-box-shadow: none; --ha-card-background: transparent; }
.paneel { padding: 24px 26px 22px 6px; display: flex; flex-direction: column; gap: 18px; }
.mix { display: flex; flex-direction: column; gap: 8px; }
.mix-titel { font-size: 16px; color: var(--h-muted); }
.mix-balk { display: flex; height: 16px; border-radius: 8px; overflow: hidden; gap: 3px; background: var(--h-fill); }
.mix-balk i { display: block; height: 100%; min-width: 0; }
.mix-legenda { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 16px; color: var(--h-muted); }
.mix-legenda span { display: inline-flex; align-items: center; gap: 7px; }
.mix-legenda b { width: 10px; height: 10px; border-radius: 3px; }
.mini { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mini div { background: var(--h-card); border: 1px solid var(--h-line); border-radius: 18px; padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; }
.mini span { font-size: 15px; color: var(--h-muted); }
.mini b { font-size: 30px; font-weight: 700; }
`;

class SmartDevicesEmsHubEditor extends HTMLElement {
  setConfig(config) { this._config = { ...config }; this._render(); }
  set hass(hass) { this._hass = hass; this._render(); }
  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => ({
        weergave: "Weergave", thema: "Kleuren", beweging: "Bewegende stroom (huis)",
        apparaat: "Installatie (leeg = de eerste)",
        net_max_w: "Volle ring net (standaard 6000 W)", zon_max_w: "Volle ring zon (standaard 5000 W)",
      }[s.name] ?? s.name);
      this._form.addEventListener("value-changed", (ev) => {
        const cfg = { ...ev.detail.value };
        for (const k of Object.keys(cfg)) if (cfg[k] === "" || cfg[k] === undefined) delete cfg[k];
        if (cfg.beweging === true) delete cfg.beweging;
        if (cfg.thema === "donker") delete cfg.thema;
        this._config = cfg;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = [
      { name: "weergave", selector: { select: { mode: "dropdown", options: [
        { value: "ringen", label: "Ringen (zoals HomeWizard)" }, { value: "huis", label: "Huis met zijpaneel" }] } } },
      { name: "thema", selector: { select: { mode: "dropdown", options: [
        { value: "ha", label: "Zoals Home Assistant" }, { value: "licht", label: "Licht" }, { value: "donker", label: "Donker" }] } } },
      { name: "beweging", selector: { boolean: {} } },
      { name: "net_max_w", selector: { number: { min: 1000, max: 30000, step: 500, unit_of_measurement: "W", mode: "box" } } },
      { name: "zon_max_w", selector: { number: { min: 500, max: 30000, step: 100, unit_of_measurement: "W", mode: "box" } } },
      { name: "apparaat", selector: { device: { integration: DOMEIN } } },
    ];
    this._form.data = { weergave: "ringen", thema: "donker", beweging: true, ...this._config };
  }
}

if (!customElements.get("smart-devices-ems-hub")) {
  customElements.define("smart-devices-ems-hub", SmartDevicesEmsHub);
  customElements.define("smart-devices-ems-hub-editor", SmartDevicesEmsHubEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "smart-devices-ems-hub",
    name: "Smart Devices EMS: Google Hub-scherm",
    description: "Een volledig scherm van 1024 x 600 voor een Nest Hub (via Home Assistant Cast): ringen zoals HomeWizard, of het huis.",
    preview: false,
  });
}
