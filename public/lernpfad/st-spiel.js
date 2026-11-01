/* ==========================================================================
   Lernpfad-Baukasten · st-spiel.js (Spiel-Erweiterung 1.0.0 für den Lernpfad Spieltheorie)
   Einbinden NACH lernpfad.js:
     <script src="/lernpfad/lernpfad.js"></script>
     <script src="/lernpfad/st-spiel.js"></script>
   Stellt window.Lernpfad.spiel bereit: figur, szene, sprecher, spielbrett, turnier,
   baum, szenario, akteure, mischer. Vanilla-JS, keine Abhängigkeiten, keine Server-Aufrufe.
   Doku: docs/lernpfad-spieltheorie.md (Abschnitt 5)
   ========================================================================== */
(function () {
  "use strict";
  if (!window.Lernpfad) { console.error("[Lernpfad] st-spiel.js braucht lernpfad.js davor."); return; }
  if (window.Lernpfad.spiel) return;
  const L = window.Lernpfad;

  // ------------------------------------------------------------------------
  // Hilfen
  // ------------------------------------------------------------------------
  let zaehler = 0;
  const uid = (p) => (p || "st") + "-" + (++zaehler).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const esc = (s) => String(s).replace(/[&<>"]/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[z]);
  const ohneTags = (s) => String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const ruhig = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function ziel(el) {
    const e = typeof el === "string" ? document.querySelector(el) : el;
    if (!e) console.error("[Lernpfad] spiel: Element nicht gefunden:", el);
    return e;
  }
  function neu(tag, attrs, html) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (attrs[k] === null || attrs[k] === undefined || attrs[k] === false) continue;
      if (k === "class") e.className = attrs[k];
      else e.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function knopf(text, cls, aria) {
    const b = neu("button", { type: "button", class: "btn" + (cls ? " " + cls : "") }, text);
    if (aria) b.setAttribute("aria-label", aria);
    return b;
  }
  function formeln(el) { if (L.formeln) L.formeln(el); }
  function melde(el, name, detail) {
    try { el.dispatchEvent(new CustomEvent(name, { bubbles: true, detail })); } catch (e) { /* alter Browser */ }
  }
  /** Zufall mit Startwert (reproduzierbar) */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const mz = (x) => String(x).replace(/^-/, "−");
  const zahl = (x, st) => (L.zahlText ? L.zahlText(x, st === undefined ? 1 : st) : String(Math.round(x * 10) / 10));
  const fehler = (msg) => { console.error("[Lernpfad] spiel: " + msg); return null; };

  // ------------------------------------------------------------------------
  // Figuren (viewBox 0 0 100 120), cartoonhaft im Stil eines Aufbauspiels
  // ------------------------------------------------------------------------
  const K = 'class="st-kontur ';
  function gesicht(stimmung, ohneAugen) {
    let a = "";
    if (!ohneAugen) {
      if (stimmung === "froh") {
        a += '<path class="st-linie" d="M38 53 Q42 48 46 53"/><path class="st-linie" d="M54 53 Q58 48 62 53"/>';
      } else {
        a += '<ellipse class="st-f-auge" cx="42" cy="52" rx="2.8" ry="3.6"/><ellipse class="st-f-auge" cx="58" cy="52" rx="2.8" ry="3.6"/>';
        a += '<circle class="st-f-weiss" cx="43" cy="50.6" r="1"/><circle class="st-f-weiss" cx="59" cy="50.6" r="1"/>';
      }
    }
    if (stimmung === "boese") a += '<path class="st-linie" d="M36 44 L46 48"/><path class="st-linie" d="M64 44 L54 48"/>';
    if (stimmung === "sorge") a += '<path class="st-linie" d="M37 47 L46 44"/><path class="st-linie" d="M54 44 L63 47"/>';
    a += '<circle class="st-f-wange" cx="36" cy="60" r="4.5"/><circle class="st-f-wange" cx="64" cy="60" r="4.5"/>';
    a += '<path class="st-linie" style="stroke-width:1.6" d="M50 54 Q54 59 49 61"/>';
    const mund = {
      froh: '<path class="st-kontur-d st-f-rot2" d="M42 64 Q50 74 58 64 Q50 67 42 64 Z"/>',
      boese: '<path class="st-linie" d="M43 69 Q50 64 57 69"/>',
      sorge: '<path class="st-linie" d="M44 68 Q47 66 50 68 Q53 70 56 68"/>',
    }[stimmung] || '<path class="st-linie" d="M44 66 Q50 69 56 66"/>';
    return a + mund;
  }
  function kopf() {
    return '<circle ' + K + 'st-f-haut" cx="28" cy="55" r="5"/><circle ' + K + 'st-f-haut" cx="72" cy="55" r="5"/>' +
      '<circle ' + K + 'st-f-haut" cx="50" cy="52" r="22"/>';
  }
  function koerper(farbe, farbe2) {
    return '<ellipse class="st-f-schatten" cx="50" cy="116" rx="30" ry="4.5"/>' +
      '<path ' + K + "st-f-" + farbe + '" d="M23 118 C23 93 32 79 50 79 C68 79 77 93 77 118 Z"/>' +
      (farbe2 ? '<path class="st-f-' + farbe2 + '" d="M44 80 L50 96 L56 80 Z"/>' : "") +
      '<circle ' + K + 'st-f-haut" cx="27" cy="108" r="5.5"/><circle ' + K + 'st-f-haut" cx="73" cy="108" r="5.5"/>';
  }
  const knoepfe = '<circle class="st-f-gold" cx="50" cy="100" r="2.3"/><circle class="st-f-gold" cx="50" cy="109" r="2.3"/>';

  const FIGUREN = {
    papagei(st) {
      const auge = st === "froh"
        ? '<path class="st-linie" d="M55 38 Q59 33 63 38"/>'
        : '<circle class="st-f-weiss" cx="59" cy="38" r="6" ' + 'stroke="none"/><circle class="st-f-auge" cx="60" cy="38" r="3"/>';
      return '<ellipse class="st-f-schatten" cx="50" cy="116" rx="26" ry="4"/>' +
        '<rect ' + K + 'st-f-holz" x="16" y="98" width="68" height="8" rx="4"/>' +
        '<path ' + K + 'st-f-blau" d="M42 90 L32 118 L44 114 L48 118 L54 94 Z"/>' +
        '<ellipse ' + K + 'st-f-gruen" cx="50" cy="70" rx="21" ry="28"/>' +
        '<ellipse class="st-f-gold" cx="54" cy="76" rx="11" ry="17"/>' +
        '<path ' + K + 'st-f-rot" d="M33 60 C26 76 30 92 40 98 C38 84 40 70 46 62 Z"/>' +
        '<path class="st-linie" style="stroke-width:1.2" d="M34 74 L42 72 M34 82 L41 80"/>' +
        '<circle ' + K + 'st-f-gruen" cx="52" cy="40" r="17"/>' +
        '<path ' + K + 'st-f-rot" d="M40 26 C42 14 52 12 54 22 C58 14 66 18 62 26 Z"/>' + auge +
        '<circle class="st-ohne" style="stroke:var(--st-messing);stroke-width:2" cx="60" cy="38" r="8"/>' +
        '<path class="st-ohne" style="stroke:var(--st-messing);stroke-width:1.2" d="M66 42 Q70 56 62 64"/>' +
        '<path ' + K + 'st-f-gold2" d="M66 40 C80 40 80 56 68 56 C72 50 70 46 64 46 Z"/>' +
        (st === "sorge" ? '<path class="st-linie" d="M52 30 L62 28"/>' : "") +
        (st === "boese" ? '<path class="st-linie" d="M52 28 L63 32"/>' : "") +
        '<path ' + K + 'st-f-gold2" d="M42 98 L40 106 M50 98 L50 106" />';
    },
    kapitaenin(st) {
      return '<path ' + K + 'st-f-haar" d="M27 50 C24 78 30 92 37 94 L63 94 C70 92 76 78 73 50 Z"/>' +
        koerper("rot", "weiss") + knoepfe +
        '<path class="st-f-rot2" d="M30 95 L40 118 L34 118 Z M70 95 L60 118 L66 118 Z"/>' +
        kopf() + gesicht(st) +
        '<path ' + K + 'st-f-haar" d="M29 46 C32 32 68 32 71 46 C62 40 40 40 29 46 Z"/>' +
        '<path ' + K + 'st-f-schwarz" d="M14 38 C30 34 40 38 50 30 C60 38 70 34 86 38 C78 44 62 40 50 42 C38 40 22 44 14 38 Z"/>' +
        '<path ' + K + 'st-f-schwarz" d="M30 36 C32 16 68 16 70 36 Z"/>' +
        '<path class="st-f-gold" d="M30 34 L70 34 L70 37 L30 37 Z"/>' +
        '<path ' + K + 'st-f-rot" d="M64 24 C74 6 92 4 96 10 C86 12 78 18 68 30 Z"/>';
    },
    pirat(st) {
      return koerper("blau", "weiss") + knoepfe +
        kopf() + gesicht(st) +
        '<path ' + K + 'st-f-haar2" d="M29 60 C30 88 70 88 71 60 C66 72 58 74 50 72 C42 74 34 72 29 60 Z"/>' +
        '<path class="st-linie" d="M44 67 Q50 70 56 67"/>' +
        '<path class="st-f-schwarz" d="M27 44 L73 58 L73 61 L27 47 Z"/>' +
        '<ellipse ' + K + 'st-f-schwarz" cx="58" cy="52" rx="7" ry="6"/>' +
        '<path ' + K + 'st-f-rot" d="M26 46 C26 24 74 24 74 46 C60 40 40 40 26 46 Z"/>' +
        '<circle class="st-f-weiss" cx="40" cy="36" r="2"/><circle class="st-f-weiss" cx="56" cy="33" r="2"/><circle class="st-f-weiss" cx="66" cy="38" r="2"/>' +
        '<path ' + K + 'st-f-rot" d="M24 44 L12 52 L16 40 Z"/>' +
        '<circle class="st-f-gold" cx="27" cy="62" r="2.6"/>';
    },
    haendlerin(st) {
      return '<ellipse class="st-f-schatten" cx="50" cy="116" rx="30" ry="4.5"/>' +
        '<path ' + K + 'st-f-gruen" d="M20 118 C22 96 32 80 50 80 C68 80 78 96 80 118 Z"/>' +
        '<path class="st-f-weiss" d="M40 82 L50 100 L60 82 Z"/>' +
        '<rect ' + K + 'st-f-holz2" x="56" y="96" width="22" height="16" rx="2"/>' +
        '<path class="st-linie" style="stroke:var(--st-gold)" d="M67 96 L67 112"/>' +
        '<circle ' + K + 'st-f-haut" cx="27" cy="108" r="5.5"/><circle ' + K + 'st-f-haut" cx="60" cy="104" r="5"/>' +
        kopf() + gesicht(st) +
        '<circle class="st-ohne" style="stroke:var(--st-kontur);stroke-width:2" cx="42" cy="52" r="6.5"/>' +
        '<circle class="st-ohne" style="stroke:var(--st-kontur);stroke-width:2" cx="58" cy="52" r="6.5"/>' +
        '<path class="st-linie" d="M48.5 52 L51.5 52"/>' +
        '<path ' + K + 'st-f-haar" d="M29 48 C30 32 70 32 71 48 C64 40 36 40 29 48 Z"/>' +
        '<path ' + K + 'st-f-weiss" d="M22 56 C18 24 82 24 78 56 C72 38 28 38 22 56 Z"/>' +
        '<path ' + K + 'st-f-gruen" d="M24 50 C34 44 66 44 76 50 L76 54 C66 48 34 48 24 54 Z"/>' +
        '<path ' + K + 'st-f-gruen" d="M70 56 L80 72 L72 70 Z"/>';
    },
    gouverneur(st) {
      return koerper("blau2", "weiss") +
        '<path class="st-f-gold" d="M44 80 L42 118 L45 118 L47 82 Z M56 80 L58 118 L55 118 L53 82 Z"/>' + knoepfe +
        '<circle ' + K + 'st-f-weiss" cx="27" cy="50" r="9"/><circle ' + K + 'st-f-weiss" cx="27" cy="64" r="8"/>' +
        '<circle ' + K + 'st-f-weiss" cx="73" cy="50" r="9"/><circle ' + K + 'st-f-weiss" cx="73" cy="64" r="8"/>' +
        kopf() + gesicht(st) +
        '<path ' + K + 'st-f-weiss" d="M28 46 C30 26 70 26 72 46 C64 38 36 38 28 46 Z"/>' +
        '<path ' + K + 'st-f-schwarz" d="M10 34 C30 14 70 14 90 34 C70 28 30 28 10 34 Z"/>' +
        '<circle ' + K + 'st-f-gold" cx="50" cy="24" r="5"/>' +
        '<path class="st-linie" d="M44 66 L56 66"/>';
    },
    spionin(st) {
      return koerper("violett") +
        '<path ' + K + 'st-f-violett" d="M20 64 C14 22 86 22 80 64 C74 42 26 42 20 64 Z"/>' +
        kopf() + gesicht(st, true) +
        '<path ' + K + 'st-f-schwarz" d="M29 46 Q50 41 71 46 L71 57 Q50 53 29 57 Z"/>' +
        '<ellipse class="st-f-weiss" cx="42" cy="51" rx="4.5" ry="3.4"/><ellipse class="st-f-weiss" cx="58" cy="51" rx="4.5" ry="3.4"/>' +
        '<circle class="st-f-auge" cx="' + (st === "boese" ? 44 : 42) + '" cy="51" r="2"/><circle class="st-f-auge" cx="' + (st === "boese" ? 60 : 58) + '" cy="51" r="2"/>' +
        '<path ' + K + 'st-f-violett" d="M24 40 C28 18 72 18 76 40 C64 30 36 30 24 40 Z"/>';
    },
    feldherr(st) {
      return koerper("grau") +
        '<path ' + K + 'st-f-stein" d="M30 84 C40 80 60 80 70 84 L66 104 C56 108 44 108 34 104 Z"/>' +
        '<circle class="st-f-gold" cx="50" cy="92" r="4"/>' +
        '<path ' + K + 'st-f-rot" d="M76 90 L92 118 L72 118 Z"/>' +
        kopf() + gesicht(st) +
        '<path ' + K + 'st-f-haar2" d="M40 63 C44 60 48 62 50 63 C52 62 56 60 60 63 C56 66 44 66 40 63 Z"/>' +
        '<path ' + K + 'st-f-stein2" d="M25 50 C25 22 75 22 75 50 L70 50 C68 36 32 36 30 50 Z"/>' +
        '<path ' + K + 'st-f-gold" d="M24 48 L76 48 L76 53 L24 53 Z"/>' +
        '<path ' + K + 'st-f-rot" d="M46 26 C36 4 66 0 60 24 Z"/>';
    },
    diplomatin(st) {
      return koerper("blau2", "weiss") +
        '<path class="st-f-rot" d="M48 82 L50 98 L52 82 Z"/>' +
        '<rect ' + K + 'st-f-holz3" x="60" y="94" width="20" height="18" rx="2"/>' +
        kopf() + gesicht(st) +
        '<path ' + K + 'st-f-haar2" d="M27 52 C22 22 78 22 73 52 C70 40 62 34 50 36 C40 36 30 42 27 52 Z"/>' +
        '<circle class="st-f-gold" cx="28" cy="62" r="2"/><circle class="st-f-gold" cx="72" cy="62" r="2"/>';
    },
    matrose(st) {
      return '<ellipse class="st-f-schatten" cx="50" cy="116" rx="30" ry="4.5"/>' +
        '<path ' + K + 'st-f-weiss" d="M23 118 C23 93 32 79 50 79 C68 79 77 93 77 118 Z"/>' +
        '<path class="st-f-blau" d="M25 98 L75 98 L76 104 L24 104 Z M24 110 L76 110 L77 116 L23 116 Z M30 88 L70 88 L72 93 L28 93 Z"/>' +
        '<path ' + K + 'st-f-blau" d="M40 80 L50 92 L60 80 Z"/>' +
        '<circle ' + K + 'st-f-haut" cx="27" cy="108" r="5.5"/><circle ' + K + 'st-f-haut" cx="73" cy="108" r="5.5"/>' +
        kopf() + gesicht(st) +
        '<path ' + K + 'st-f-weiss" d="M28 40 C30 24 70 24 72 40 Z"/>' +
        '<path ' + K + 'st-f-blau" d="M27 38 L73 38 L73 44 L27 44 Z"/>';
    },
    buerger(st) {
      return koerper("holz3") +
        '<path class="st-f-holz2" d="M38 82 L36 118 L40 118 Z M62 82 L64 118 L60 118 Z"/>' +
        kopf() + gesicht(st) +
        '<path ' + K + 'st-f-haar" d="M29 48 C30 30 70 30 71 48 C62 40 38 40 29 48 Z"/>' +
        '<path ' + K + 'st-f-gruen" d="M26 40 C30 22 70 22 74 40 L86 42 C70 46 30 46 26 40 Z"/>';
    },
  };
  const FIGUR_NAMEN = { papagei: "Kasimir, der Papagei", kapitaenin: "Kapitänin Mara", pirat: "Käpt'n Bors", haendlerin: "Händlerin Ilse",
    gouverneur: "Gouverneur Albrecht", spionin: "Spionin Nell", feldherr: "Feldherr", diplomatin: "Diplomatin", matrose: "Matrose", buerger: "Bürger" };

  function figurInhalt(art, stimmung) {
    const f = FIGUREN[art];
    if (!f) { console.error("[Lernpfad] spiel.figur: unbekannte Figur «" + art + "»"); return FIGUREN.buerger("neutral"); }
    return f(stimmung || "neutral");
  }
  function figur(art, opts) {
    const o = opts || {};
    const g = o.groesse || 72;
    const titel = o.titel;
    const id = uid("fig");
    const svg = '<svg class="st-svg" viewBox="0 0 100 120" ' +
      (titel ? 'role="img" aria-labelledby="' + id + '"><title id="' + id + '">' + esc(titel) + "</title>" : 'aria-hidden="true" focusable="false">') +
      figurInhalt(art, o.stimmung) + "</svg>";
    return '<span class="st-figur" style="width:' + g + 'px">' + svg + "</span>";
  }

  // ------------------------------------------------------------------------
  // Szenen (viewBox 0 0 640 240)
  // ------------------------------------------------------------------------
  function wolke(x, y, s) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + (s || 1) + ')" class="st-f-segel" opacity=".9">' +
      '<circle cx="0" cy="0" r="14"/><circle cx="16" cy="-6" r="18"/><circle cx="34" cy="0" r="13"/><rect x="0" y="0" width="34" height="13"/></g>';
  }
  function meer(y) {
    let w = '<rect class="st-f-meer" x="0" y="' + y + '" width="640" height="' + (240 - y) + '"/>';
    for (let i = 0; i < 4; i++) {
      const yy = y + 12 + i * 20;
      let d = "M-20 " + yy;
      for (let x = -20; x < 680; x += 40) d += " q10 -6 20 0 q10 6 20 0";
      w += '<path class="st-welle' + (i % 2 ? " b" : "") + '" d="' + d + '" fill="none" style="stroke:var(--st-' + (i % 2 ? "meer2" : "schaum") + ');stroke-width:2.5;opacity:.7"/>';
    }
    return w;
  }
  function palme(x, y, s) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + (s || 1) + ')">' +
      '<path class="st-kontur-d st-f-holz" d="M-3 0 C-2 -20 2 -36 8 -50 L12 -48 C6 -34 3 -20 3 0 Z"/>' +
      '<path class="st-kontur-d st-f-gras2" d="M10 -50 C-6 -60 -22 -52 -26 -42 C-14 -50 -2 -50 10 -48 Z"/>' +
      '<path class="st-kontur-d st-f-gras" d="M10 -50 C24 -62 40 -56 44 -46 C32 -52 20 -52 10 -48 Z"/>' +
      '<path class="st-kontur-d st-f-gras" d="M10 -50 C4 -68 16 -76 26 -74 C16 -70 12 -60 10 -50 Z"/>' +
      '<circle class="st-f-holz2" cx="9" cy="-47" r="3"/></g>';
  }
  function haus(x, y, s, dach) {
    return '<g transform="translate(' + x + " " + y + ") scale(" + (s || 1) + ')">' +
      '<rect class="st-kontur-d st-f-wand" x="0" y="-26" width="34" height="26"/>' +
      '<path class="st-kontur-d st-f-' + (dach || "dach") + '" d="M-4 -24 L17 -42 L38 -24 Z"/>' +
      '<rect class="st-kontur-d st-f-holz2" x="13" y="-14" width="8" height="14"/>' +
      '<rect class="st-kontur-d st-f-licht" x="4" y="-20" width="6" height="6"/><rect class="st-kontur-d st-f-licht" x="24" y="-20" width="6" height="6"/>' +
      '<rect class="st-kontur-d st-f-stein2" x="24" y="-44" width="5" height="10"/></g>';
  }
  function insel(x, y, w, inhalt) {
    return '<g transform="translate(' + x + " " + y + ')">' +
      '<ellipse class="st-f-sand" cx="0" cy="6" rx="' + (w / 2 + 10) + '" ry="14"/>' +
      '<ellipse class="st-kontur-d st-f-gras" cx="0" cy="0" rx="' + w / 2 + '" ry="12"/>' + (inhalt || "") + "</g>";
  }
  function schiff(x, y, farbe, s, spiegel) {
    const sx = (spiegel ? -1 : 1) * (s || 1);
    return '<g transform="translate(' + x + " " + y + ") scale(" + sx + " " + (s || 1) + ')"><g class="st-schiff">' +
      '<path class="st-kontur st-f-holz" d="M-46 -6 L46 -6 L36 14 L-36 14 Z"/>' +
      '<path class="st-f-' + farbe + '" d="M-44 -2 L44 -2 L42 3 L-42 3 Z"/>' +
      '<circle class="st-f-schwarz" cx="-20" cy="6" r="2.5"/><circle class="st-f-schwarz" cx="0" cy="6" r="2.5"/><circle class="st-f-schwarz" cx="20" cy="6" r="2.5"/>' +
      '<path class="st-kontur-d st-f-holz2" d="M-2 -6 L-2 -78 L2 -78 L2 -6 Z M-28 -6 L-28 -54 L-25 -54 L-25 -6 Z"/>' +
      '<path class="st-kontur-d st-f-segel" d="M-24 -70 C-6 -64 -6 -30 -24 -26 L-24 -70 Z" transform="translate(26 0)"/>' +
      '<path class="st-kontur-d st-f-segel" d="M4 -72 C28 -66 28 -34 4 -28 Z"/>' +
      '<path class="st-kontur-d st-f-segel2" d="M-25 -50 C-12 -46 -12 -26 -25 -22 Z"/>' +
      '<path class="st-kontur-d st-f-' + farbe + '" d="M2 -78 L20 -73 L2 -68 Z"/>' +
      '<path class="st-kontur-d st-f-holz" d="M36 -6 L54 -14 L50 -6 Z"/></g></g>';
  }
  function moewe(x, y) {
    return '<path class="st-moewe st-linie" style="stroke-width:1.8" d="M' + x + " " + y + " q6 -6 12 0 q6 -6 12 0\"/>";
  }
  function festungBau(x, y, s) {
    let z = "";
    for (let i = 0; i < 9; i++) z += '<rect class="st-kontur-d st-f-stein" x="' + (-90 + i * 20) + '" y="-74" width="12" height="10"/>';
    return '<g transform="translate(' + x + " " + y + ") scale(" + (s || 1) + ')">' +
      '<path class="st-kontur-d st-f-fels" d="M-130 20 C-110 -30 110 -30 130 20 Z"/>' +
      '<rect class="st-kontur-d st-f-stein" x="-90" y="-64" width="180" height="70"/>' + z +
      '<rect class="st-kontur-d st-f-stein2" x="-110" y="-96" width="36" height="100"/><rect class="st-kontur-d st-f-stein2" x="74" y="-96" width="36" height="100"/>' +
      '<path class="st-kontur-d st-f-dach" d="M-116 -96 L-92 -126 L-68 -96 Z M68 -96 L92 -126 L116 -96 Z"/>' +
      '<path class="st-kontur-d st-f-holz2" d="M-18 6 L-18 -24 C-18 -40 18 -40 18 -24 L18 6 Z"/>' +
      '<path class="st-linie" d="M-92 -126 L-92 -146 M92 -126 L92 -146"/>' +
      '<path class="st-kontur-d st-f-gold" d="M-92 -146 L-72 -140 L-92 -134 Z M92 -146 L112 -140 L92 -134 Z"/>' +
      '<rect class="st-f-fenster" x="-98" y="-80" width="10" height="14" rx="5"/><rect class="st-f-fenster" x="86" y="-80" width="10" height="14" rx="5"/>' +
      "</g>";
  }
  function himmel(id, nacht) {
    return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="st-s-himmel"/><stop offset="1" class="st-s-himmel2"/></linearGradient></defs>' +
      '<rect x="0" y="0" width="640" height="240" fill="url(#' + id + ')"/>' +
      (nacht ? "" : '<circle class="st-f-licht" cx="560" cy="52" r="24" opacity=".9"/>');
  }
  const SZENEN = {
    hafen(id) {
      return himmel(id) + wolke(90, 40) + wolke(330, 30, .8) + moewe(240, 50) + moewe(270, 64) + meer(150) +
        insel(140, 150, 300, haus(-120, -6) + haus(-76, -8, 1.1, "dach2") + haus(-30, -6, .9) + palme(60, -4) + palme(100, -2, .8) +
          '<rect class="st-kontur-d st-f-holz" x="100" y="-4" width="90" height="8"/><rect class="st-f-holz2" x="110" y="2" width="5" height="18"/><rect class="st-f-holz2" x="170" y="2" width="5" height="18"/>' +
          '<rect class="st-kontur-d st-f-holz3" x="120" y="-16" width="14" height="12"/><rect class="st-kontur-d st-f-holz3" x="136" y="-14" width="10" height="10"/>') +
        schiff(390, 176, "rot", .9) + schiff(540, 186, "blau", .75, true);
    },
    see(id) {
      return himmel(id) + wolke(60, 50, .9) + wolke(420, 36) + moewe(300, 60) + meer(140) +
        insel(320, 142, 90, palme(0, -4, .7)) + schiff(170, 186, "rot", 1) + schiff(470, 186, "blau", 1, true);
    },
    festung(id) {
      return himmel(id) + wolke(120, 40) + wolke(460, 50, .7) + meer(178) + festungBau(320, 170, .95) +
        schiff(90, 206, "rot", .7) + schiff(560, 206, "rot", .6, true);
    },
    klippen(id) {
      return himmel(id) + meer(150) +
        '<path class="st-kontur-d st-f-fels" d="M0 240 L0 70 C30 60 60 90 90 110 C110 150 120 200 130 240 Z"/>' +
        '<path class="st-kontur-d st-f-fels2" d="M640 240 L640 60 C600 70 570 100 550 130 C530 170 520 210 515 240 Z"/>' +
        '<path class="st-f-gras2" d="M0 72 C30 60 60 88 90 108 L86 112 C56 94 30 70 0 80 Z"/>' +
        schiff(260, 180, "blau", .7) + schiff(360, 176, "blau", .75, true) + schiff(455, 182, "blau", .65) + schiff(150, 214, "rot", .7) +
        '<rect class="st-f-nebel" x="0" y="120" width="640" height="26"/><rect class="st-f-nebel" x="80" y="96" width="420" height="16" rx="8"/>';
    },
    kerker(id) {
      let ziegel = "";
      for (let r = 0; r < 9; r++) for (let c = -1; c < 14; c++) {
        ziegel += '<rect class="st-kontur-d st-f-' + ((r + c) % 3 ? "stein" : "stein2") + '" x="' + (c * 48 + (r % 2) * 24) + '" y="' + r * 26 + '" width="48" height="26"/>';
      }
      return '<rect class="st-f-stein2" x="0" y="0" width="640" height="240"/>' + ziegel +
        '<rect class="st-kontur st-f-himmel" x="270" y="34" width="100" height="70" rx="6"/>' +
        '<circle class="st-f-licht" cx="340" cy="58" r="12"/>' +
        '<path class="st-linie" style="stroke-width:5" d="M290 34 L290 104 M310 34 L310 104 M330 34 L330 104 M350 34 L350 104"/>' +
        '<rect class="st-kontur-d st-f-holz2" x="96" y="70" width="10" height="40"/>' +
        '<path class="st-flamme st-f-licht" d="M101 70 C90 58 96 46 101 38 C106 46 112 58 101 70 Z"/>' +
        '<rect class="st-kontur-d st-f-holz2" x="534" y="70" width="10" height="40"/>' +
        '<path class="st-flamme st-f-licht" d="M539 70 C528 58 534 46 539 38 C544 46 550 58 539 70 Z"/>' +
        '<rect class="st-f-fels2" x="0" y="200" width="640" height="40"/>' +
        '<path class="st-linie" style="stroke-width:3" d="M150 150 C170 170 190 170 210 150 M430 150 C450 170 470 170 490 150"/>';
    },
    lagetisch(id) {
      return '<rect class="st-f-wand" x="0" y="0" width="640" height="240"/>' +
        '<rect class="st-kontur st-f-himmel" x="40" y="24" width="150" height="90" rx="6"/>' +
        '<rect class="st-f-meer" x="42" y="80" width="146" height="32"/>' +
        '<path class="st-linie" d="M115 24 L115 114 M40 69 L190 69"/>' +
        '<rect class="st-kontur st-f-holz3" x="430" y="20" width="170" height="100" rx="4"/>' +
        '<path class="st-kontur-d st-f-gras" d="M450 60 C470 40 500 50 510 70 C520 90 490 100 470 90 Z"/>' +
        '<path class="st-kontur-d st-f-sand" d="M530 40 C560 30 590 50 580 80 C570 100 540 90 535 70 Z"/>' +
        '<path class="st-linie" style="stroke:var(--st-rot);stroke-dasharray:4 4" d="M480 80 C510 110 540 90 560 60"/>' +
        '<path class="st-linie" d="M320 0 L320 40"/><path class="st-kontur st-f-messing" d="M296 40 L344 40 L332 58 L308 58 Z"/>' +
        '<ellipse class="st-f-licht" cx="320" cy="64" rx="18" ry="6" opacity=".7"/>' +
        '<path class="st-kontur st-f-holz" d="M90 170 L550 170 L600 226 L40 226 Z"/>' +
        '<path class="st-kontur-d st-f-pergament" d="M160 176 L480 176 L510 214 L130 214 Z"/>' +
        '<path class="st-kontur-d st-f-meer" d="M200 182 L440 182 L462 208 L178 208 Z" opacity=".55"/>' +
        '<path class="st-kontur-d st-f-gras" d="M260 186 C290 180 320 190 316 200 C300 208 270 206 258 198 Z"/>' +
        '<path class="st-kontur-d st-f-sand" d="M350 188 C380 182 410 192 404 202 C392 208 362 206 352 198 Z"/>' +
        '<circle class="st-kontur-d st-f-rot" cx="290" cy="194" r="5"/><circle class="st-kontur-d st-f-blau" cx="380" cy="196" r="5"/>' +
        '<circle class="st-kontur-d st-f-gold" cx="334" cy="186" r="4"/>' +
        '<rect class="st-f-holz2" x="60" y="226" width="14" height="14"/><rect class="st-f-holz2" x="566" y="226" width="14" height="14"/>';
    },
    markt(id) {
      function stand(x, farbe) {
        let streifen = "";
        for (let i = 0; i < 5; i++) streifen += '<path class="st-f-' + (i % 2 ? "weiss" : farbe) + '" d="M' + (x + i * 20) + " 110 L" + (x + i * 20 + 20) + " 110 L" + (x + i * 20 + 22) + " 130 L" + (x + i * 20 - 2) + ' 130 Z"/>';
        return '<rect class="st-kontur-d st-f-holz2" x="' + (x + 2) + '" y="110" width="5" height="70"/><rect class="st-kontur-d st-f-holz2" x="' + (x + 92) + '" y="110" width="5" height="70"/>' +
          streifen + '<rect class="st-kontur-d st-f-holz" x="' + (x - 4) + '" y="160" width="108" height="20"/>' +
          '<circle class="st-kontur-d st-f-gold" cx="' + (x + 24) + '" cy="154" r="7"/><circle class="st-kontur-d st-f-rot" cx="' + (x + 44) + '" cy="154" r="7"/><circle class="st-kontur-d st-f-gruen" cx="' + (x + 64) + '" cy="154" r="7"/>';
      }
      return himmel(id) + wolke(200, 30) + haus(30, 120, 1.6) + haus(520, 120, 1.7, "dach2") +
        '<rect class="st-f-sand" x="0" y="176" width="640" height="64"/>' + stand(150, "rot") + stand(370, "blau") +
        '<ellipse class="st-kontur-d st-f-holz" cx="300" cy="196" rx="14" ry="18"/><ellipse class="st-kontur-d st-f-holz" cx="590" cy="200" rx="14" ry="18"/>';
    },
  };
  function szene(art, opts) {
    const o = opts || {};
    const f = SZENEN[art];
    if (!f) { console.error("[Lernpfad] spiel.szene: unbekannte Szene «" + art + "»"); return ""; }
    const id = uid("sz");
    let figs = "";
    const liste = o.figuren || [];
    const n = liste.length;
    liste.forEach((fg, i) => {
      const a = typeof fg === "string" ? { art: fg.split(":")[0], stimmung: fg.split(":")[1] } : fg;
      const x = n === 1 ? 300 : 60 + i * (480 / Math.max(1, n - 1));
      const s = a.groesse || 0.95;
      figs += '<g transform="translate(' + (x - 50 * s + (a.dx || 0)) + " " + (240 - 118 * s) + ") scale(" + s + ')">' + figurInhalt(a.art, a.stimmung) + "</g>";
    });
    const titelId = uid("szt");
    const t = o.titel;
    return '<figure class="st-szene"><div class="st-rahmen"><div class="st-innen">' +
      '<svg class="st-svg" viewBox="0 0 640 240" ' + (t ? 'role="img" aria-labelledby="' + titelId + '"><title id="' + titelId + '">' + esc(t) + "</title>" : 'aria-hidden="true" focusable="false">') +
      f(id) + figs + "</svg></div></div>" + (o.unterschrift ? "<figcaption>" + o.unterschrift + "</figcaption>" : "") + "</figure>";
  }
  function sprecher(art, name, html, opts) {
    const o = opts || {};
    return '<div class="st-sprecher' + (o.klein ? " klein" : "") + '">' + figur(art, { groesse: o.klein ? 56 : 76, stimmung: o.stimmung }) +
      '<div class="st-blase"><span class="st-wer">' + (name || FIGUR_NAMEN[art] || "") + "</span>" + html + "</div></div>";
  }

  // ------------------------------------------------------------------------
  // Spielbrett (Bimatrix)
  // ------------------------------------------------------------------------
  function analysiere(werte, weniger) {
    const besser = (a, b) => (weniger ? a < b : a > b);
    const nz = werte.length, ns = werte[0].length;
    const bestZ = [], bestS = [];
    for (let j = 0; j < ns; j++) {
      let opt = werte[0][j][0];
      for (let i = 1; i < nz; i++) if (besser(werte[i][j][0], opt)) opt = werte[i][j][0];
      bestZ[j] = []; for (let i = 0; i < nz; i++) if (werte[i][j][0] === opt) bestZ[j].push(i);
    }
    for (let i = 0; i < nz; i++) {
      let opt = werte[i][0][1];
      for (let j = 1; j < ns; j++) if (besser(werte[i][j][1], opt)) opt = werte[i][j][1];
      bestS[i] = []; for (let j = 0; j < ns; j++) if (werte[i][j][1] === opt) bestS[i].push(j);
    }
    const gg = [];
    for (let i = 0; i < nz; i++) for (let j = 0; j < ns; j++) if (bestZ[j].includes(i) && bestS[i].includes(j)) gg.push([i, j]);
    // streng dominante Strategie
    function dominantZ() {
      for (let i = 0; i < nz; i++) {
        let ok = true;
        for (let k = 0; k < nz && ok; k++) if (k !== i) for (let j = 0; j < ns; j++) if (!besser(werte[i][j][0], werte[k][j][0])) { ok = false; break; }
        if (ok) return i;
      }
      return -1;
    }
    function dominantS() {
      for (let j = 0; j < ns; j++) {
        let ok = true;
        for (let k = 0; k < ns && ok; k++) if (k !== j) for (let i = 0; i < nz; i++) if (!besser(werte[i][j][1], werte[i][k][1])) { ok = false; break; }
        if (ok) return j;
      }
      return -1;
    }
    const dominiertZ = [], dominiertS = [];
    for (let i = 0; i < nz; i++) for (let k = 0; k < nz; k++) if (k !== i) {
      let alle = true; for (let j = 0; j < ns; j++) if (!besser(werte[k][j][0], werte[i][j][0])) { alle = false; break; }
      if (alle) { dominiertZ.push(i); break; }
    }
    for (let j = 0; j < ns; j++) for (let k = 0; k < ns; k++) if (k !== j) {
      let alle = true; for (let i = 0; i < nz; i++) if (!besser(werte[i][k][1], werte[i][j][1])) { alle = false; break; }
      if (alle) { dominiertS.push(j); break; }
    }
    return { bestZ, bestS, gg, domZ: dominantZ(), domS: dominantS(), dominiertZ, dominiertS, besser };
  }

  function spielbrett(el, cfg) {
    const root = ziel(el); if (!root) return null;
    if (!cfg || !cfg.zeile || !cfg.spalte || !Array.isArray(cfg.werte)) return fehler("spielbrett braucht zeile, spalte und werte.");
    const Z = cfg.zeile, S = cfg.spalte, W = cfg.werte;
    const nz = Z.strategien.length, ns = S.strategien.length;
    if (W.length !== nz || W.some((r) => r.length !== ns)) return fehler("spielbrett: werte passen nicht zu den Strategien.");
    const weniger = !!cfg.weniger_ist_besser;
    const einheit = cfg.einheit || "Gold";
    const A = analysiere(W, weniger);
    if (Array.isArray(cfg.gleichgewichte)) A.gg = cfg.gleichgewichte;
    const modi = cfg.modi || ["lesen", "antworten", "gleichgewicht", "dominanz"];
    const MODUSNAME = { lesen: "📜 Lesen", spielen: "🎲 Spielen", antworten: "🎯 Beste Antworten", gleichgewicht: "⚖ Gleichgewicht finden", dominanz: "🗡 Dominanz" };
    const zn = Z.name, sn = S.name;
    const zs = (i) => "«" + ohneTags(Z.strategien[i]) + "»", ss = (j) => "«" + ohneTags(S.strategien[j]) + "»";
    const EINZAHL = { Jahre: "Jahr", Punkte: "Punkt", Monate: "Monat", Tage: "Tag", Schiffe: "Schiff", Stimmen: "Stimme" };
    const w = (x) => mz(x) + " " + (Math.abs(x) === 1 ? cfg.einheit_eins || EINZAHL[einheit] || einheit : einheit);

    root.innerHTML = "";
    root.classList.add("st-brett-box", "stack");
    if (cfg.titel) root.appendChild(neu("div", { class: "uebung-kopf" }, '<span class="eyebrow">Spielbrett</span><h3>' + cfg.titel + "</h3>"));
    if (cfg.frage) root.appendChild(neu("div", { class: "prose" }, cfg.frage));

    const kopf = neu("div", { class: "st-brett-kopf" });
    kopf.innerHTML = '<span class="st-brett-spieler">' + figur(Z.figur || "kapitaenin", { groesse: 40 }) + '<span><span class="st-z">' + zn + '</span><br><small class="hint">wählt die Zeile · <span class="st-dot z"></span> unten links</small></span></span>' +
      '<span class="st-brett-spieler">' + figur(S.figur || "pirat", { groesse: 40 }) + '<span><span class="st-s">' + sn + '</span><br><small class="hint">wählt die Spalte · <span class="st-dot s"></span> oben rechts</small></span></span>';
    root.appendChild(kopf);

    const modiLeiste = neu("div", { class: "st-brett-modi modes", role: "group", "aria-label": "Modus des Spielbretts" });
    const modusKnoepfe = {};
    if (modi.length > 1) {
      modi.forEach((m) => {
        const b = knopf(MODUSNAME[m] || m);
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", () => modus(m));
        modusKnoepfe[m] = b; modiLeiste.appendChild(b);
      });
      root.appendChild(modiLeiste);
    }

    const tisch = neu("div", { class: "st-rahmen st-brett-tisch" });
    const innen = neu("div", { class: "st-innen", style: "padding:10px" });
    const brett = neu("div", { class: "st-brett", style: "grid-template-columns:minmax(64px, auto) repeat(" + ns + ", minmax(0, 1fr))" });
    innen.appendChild(brett); tisch.appendChild(innen); root.appendChild(tisch);

    const ecke = neu("div", { class: "st-brett-ecke" }, '<span><span class="st-z">' + zn + "</span> ↓<br><span class=\"st-s\">" + sn + "</span> →</span>");
    brett.appendChild(ecke);
    const spKopf = [], zeKopf = [], felder = [];
    for (let j = 0; j < ns; j++) { const h = neu("div", { class: "st-brett-sp" }, S.strategien[j]); spKopf.push(h); brett.appendChild(h); }
    for (let i = 0; i < nz; i++) {
      const h = neu("div", { class: "st-brett-ze" }, Z.strategien[i]); zeKopf.push(h); brett.appendChild(h);
      felder[i] = [];
      for (let j = 0; j < ns; j++) {
        const f = neu("button", { type: "button", class: "st-feld" });
        f.innerHTML = '<span class="st-diag" aria-hidden="true"></span><span class="st-ws"><span class="st-ba" data-w="s">' + mz(W[i][j][1]) + '</span><span class="st-chip" aria-hidden="true"></span></span>' +
          '<span class="st-wz"><span class="st-chip" aria-hidden="true"></span><span class="st-ba" data-w="z">' + mz(W[i][j][0]) + "</span></span>";
        f.setAttribute("aria-label", zn + " " + zs(i) + ", " + sn + " " + ss(j) + ": " + zn + " " + w(W[i][j][0]) + ", " + sn + " " + w(W[i][j][1]));
        f.addEventListener("click", () => klick(i, j));
        felder[i][j] = f; brett.appendChild(f);
      }
    }
    root.appendChild(neu("div", { class: "st-brett-legende" },
      '<span><span class="st-dot z"></span> ' + zn + " (" + einheit + ")</span><span><span class=\"st-dot s\"></span> " + sn + " (" + einheit + ")</span>" +
      (weniger ? "<span>Achtung: hier ist <b>weniger besser</b>.</span>" : "")));

    const panel = neu("div", { class: "st-brett-panel stack" });
    const info = neu("div", { class: "info st-brett-info", "aria-live": "polite" });
    const steuer = neu("div", { class: "row" });
    panel.appendChild(info); panel.appendChild(steuer);
    root.appendChild(panel);

    let aktuell = null, aufgaben = [], aufgabe = 0, gewaehlt = new Set();
    let konto = { z: 0, s: 0, runden: 0 }, letzteZeile = -1;

    function alleZuruecksetzen() {
      felder.flat().forEach((f) => {
        f.classList.remove("an", "ne", "richtig", "falsch", "gedimmt");
        f.removeAttribute("aria-pressed");
        f.querySelectorAll(".st-ba").forEach((b) => b.classList.remove("best"));
        const m = f.querySelector(".st-marke-ok"); if (m) m.remove();
      });
      spKopf.concat(zeKopf).forEach((h) => h.classList.remove("gestrichen"));
      steuer.innerHTML = ""; info.innerHTML = "";
    }
    function markiereBest(alle) {
      for (let j = 0; j < ns; j++) A.bestZ[j].forEach((i) => felder[i][j].querySelector('[data-w="z"]').classList.add("best"));
      for (let i = 0; i < nz; i++) A.bestS[i].forEach((j) => felder[i][j].querySelector('[data-w="s"]').classList.add("best"));
      if (alle) zeigeGG();
    }
    function zeigeGG() { A.gg.forEach(([i, j]) => felder[i][j].classList.add("ne")); }
    function ggText() {
      if (!A.gg.length) return "Es gibt <b>kein</b> Feld, in dem beide zufrieden sind (kein Gleichgewicht in reinen Strategien).";
      return (A.gg.length === 1 ? "Nash-Gleichgewicht: " : "Nash-Gleichgewichte: ") +
        A.gg.map(([i, j]) => "<b>" + zs(i) + " / " + ss(j) + "</b>").join(" und ") + ".";
    }

    function modus(m) {
      aktuell = m;
      Object.keys(modusKnoepfe).forEach((k) => { modusKnoepfe[k].classList.toggle("on", k === m); modusKnoepfe[k].setAttribute("aria-pressed", String(k === m)); });
      alleZuruecksetzen();
      if (m === "lesen") {
        info.innerHTML = "Tippe auf ein Feld. Jedes Feld ist ein möglicher Ausgang: <span class=\"st-z\">unten links</span> bekommt " + zn + ", <span class=\"st-s\">oben rechts</span> " + sn + ".";
      } else if (m === "antworten") {
        aufgaben = [];
        for (let j = 0; j < ns; j++) aufgaben.push({ wer: "z", j });
        for (let i = 0; i < nz; i++) aufgaben.push({ wer: "s", i });
        aufgabe = 0;
        const alle = knopf("Alle besten Antworten zeigen");
        alle.addEventListener("click", () => { markiereBest(true); felder.flat().forEach((f) => f.classList.remove("gedimmt")); aufgabe = aufgaben.length; info.innerHTML = "Häkchen = beste Antwort. " + ggText(); formeln(info); });
        steuer.appendChild(alle);
        stelleAufgabe();
      } else if (m === "gleichgewicht") {
        gewaehlt = new Set();
        info.innerHTML = "Markiere jedes Feld, aus dem <b>keiner allein</b> ausbrechen will (Fahne setzen). Dann «Prüfen».";
        felder.flat().forEach((f) => f.setAttribute("aria-pressed", "false"));
        const p = knopf("Prüfen", "primary"); p.addEventListener("click", pruefeGG);
        const l = knopf("Lösung zeigen"); l.addEventListener("click", () => { markiereBest(true); info.innerHTML = ggText() + " Ein Feld mit zwei Häkchen ist ein Gleichgewicht."; });
        steuer.appendChild(p); steuer.appendChild(l);
      } else if (m === "dominanz") {
        baueDominanz();
      } else if (m === "spielen") {
        baueSpiel();
      }
      melde(root, "lernpfad:spielbrett", { modus: m, richtig: null });
    }

    function stelleAufgabe() {
      felder.flat().forEach((f) => f.classList.remove("gedimmt", "richtig", "falsch"));
      if (aufgabe >= aufgaben.length) {
        info.innerHTML = "Geschafft! " + ggText() + " In diesen Feldern stehen <b>zwei Häkchen</b>: Beide spielen schon ihre beste Antwort.";
        zeigeGG(); formeln(info);
        melde(root, "lernpfad:spielbrett", { modus: "antworten", richtig: true });
        return;
      }
      const a = aufgaben[aufgabe];
      if (a.wer === "z") {
        for (let i = 0; i < nz; i++) for (let j = 0; j < ns; j++) if (j !== a.j) felder[i][j].classList.add("gedimmt");
        info.innerHTML = "<b>Frage " + (aufgabe + 1) + " von " + aufgaben.length + ":</b> " + sn + " wählt " + ss(a.j) + ". Was ist für <span class=\"st-z\">" + zn + "</span> die beste Antwort? Tippe auf das Feld in dieser Spalte.";
      } else {
        for (let i = 0; i < nz; i++) for (let j = 0; j < ns; j++) if (i !== a.i) felder[i][j].classList.add("gedimmt");
        info.innerHTML = "<b>Frage " + (aufgabe + 1) + " von " + aufgaben.length + ":</b> " + zn + " wählt " + zs(a.i) + ". Was ist für <span class=\"st-s\">" + sn + "</span> die beste Antwort? Tippe auf das Feld in dieser Zeile.";
      }
    }

    function klick(i, j) {
      if (aktuell === "lesen" || !aktuell) {
        felder.flat().forEach((f) => f.classList.remove("an"));
        felder[i][j].classList.add("an");
        info.innerHTML = "Wenn <span class=\"st-z\">" + zn + "</span> " + zs(i) + " wählt und <span class=\"st-s\">" + sn + "</span> " + ss(j) + ", bekommt " + zn + " <b>" + w(W[i][j][0]) + "</b> und " + sn + " <b>" + w(W[i][j][1]) + "</b>." +
          (cfg.feldtexte && cfg.feldtexte[i] && cfg.feldtexte[i][j] ? " " + cfg.feldtexte[i][j] : "");
        formeln(info);
      } else if (aktuell === "antworten") {
        if (aufgabe >= aufgaben.length) return;
        const a = aufgaben[aufgabe];
        if (a.wer === "z") {
          if (j !== a.j) { info.innerHTML = "Bleib in der Spalte " + ss(a.j) + ": " + sn + " hat sich ja schon entschieden."; return; }
          if (A.bestZ[j].includes(i)) {
            A.bestZ[j].forEach((k) => felder[k][j].querySelector('[data-w="z"]').classList.add("best"));
            aufgabe++; stelleAufgabe();
            info.insertAdjacentHTML("afterbegin", '<span class="marke">✓</span> Richtig: ' + zs(i) + " bringt " + zn + " " + w(W[i][j][0]) + ". ");
          } else {
            const b = A.bestZ[j][0];
            felder[i][j].classList.add("falsch");
            info.innerHTML = '<span class="marke">✗</span> Nicht ganz: Mit ' + zs(i) + " bekommt " + zn + " " + w(W[i][j][0]) + ", mit " + zs(b) + " aber " + w(W[b][j][0]) + ". Versuch es nochmals.";
          }
        } else {
          if (i !== a.i) { info.innerHTML = "Bleib in der Zeile " + zs(a.i) + ": " + zn + " hat sich ja schon entschieden."; return; }
          if (A.bestS[i].includes(j)) {
            A.bestS[i].forEach((k) => felder[i][k].querySelector('[data-w="s"]').classList.add("best"));
            aufgabe++; stelleAufgabe();
            info.insertAdjacentHTML("afterbegin", '<span class="marke">✓</span> Richtig: ' + ss(j) + " bringt " + sn + " " + w(W[i][j][1]) + ". ");
          } else {
            const b = A.bestS[i][0];
            felder[i][j].classList.add("falsch");
            info.innerHTML = '<span class="marke">✗</span> Nicht ganz: Mit ' + ss(j) + " bekommt " + sn + " " + w(W[i][j][1]) + ", mit " + ss(b) + " aber " + w(W[i][b][1]) + ". Versuch es nochmals.";
          }
        }
      } else if (aktuell === "gleichgewicht") {
        const k = i + "," + j;
        if (gewaehlt.has(k)) gewaehlt.delete(k); else gewaehlt.add(k);
        felder[i][j].setAttribute("aria-pressed", String(gewaehlt.has(k)));
        felder[i][j].classList.remove("richtig", "falsch");
      } else if (aktuell === "spielen") {
        // Felder sind im Spielmodus nur Anzeige
      }
    }

    function pruefeGG() {
      const soll = new Set(A.gg.map(([i, j]) => i + "," + j));
      let ok = true; const teile = [];
      felder.flat().forEach((f) => { f.classList.remove("richtig", "falsch"); const m = f.querySelector(".st-marke-ok"); if (m) m.remove(); });
      gewaehlt.forEach((k) => {
        const [i, j] = k.split(",").map(Number);
        const f = felder[i][j];
        if (soll.has(k)) { f.classList.add("richtig"); f.insertAdjacentHTML("beforeend", '<span class="st-marke-ok" aria-hidden="true">✓</span>'); }
        else {
          ok = false; f.classList.add("falsch"); f.insertAdjacentHTML("beforeend", '<span class="st-marke-ok" aria-hidden="true">✗</span>');
          const grund = [];
          if (!A.bestZ[j].includes(i)) { const b = A.bestZ[j][0]; grund.push(zn + " würde zu " + zs(b) + " wechseln (" + w(W[b][j][0]) + " statt " + w(W[i][j][0]) + ")"); }
          if (!A.bestS[i].includes(j)) { const b = A.bestS[i][0]; grund.push(sn + " würde zu " + ss(b) + " wechseln (" + w(W[i][b][1]) + " statt " + w(W[i][j][1]) + ")"); }
          teile.push("✗ " + zs(i) + " / " + ss(j) + ": " + grund.join("; ") + ".");
        }
      });
      let fehlend = 0; soll.forEach((k) => { if (!gewaehlt.has(k)) { ok = false; fehlend++; } });
      if (ok) {
        info.innerHTML = '<span class="marke">✓</span> Genau! ' + ggText() + (cfg.erklaerung ? " " + cfg.erklaerung : "");
        zeigeGG();
      } else {
        info.innerHTML = (teile.length ? teile.join("<br>") + "<br>" : "") + (fehlend ? "Es fehlt noch " + (fehlend === 1 ? "ein Gleichgewicht." : fehlend + " Gleichgewichte.") : "") +
          (!A.gg.length && !gewaehlt.size ? "" : "") + " Tipp: Prüfe für jedes Feld: Will " + zn + " die Zeile wechseln? Will " + sn + " die Spalte wechseln?";
        if (!A.gg.length && !gewaehlt.size) info.innerHTML = '<span class="marke">✓</span> Richtig: ' + ggText();
      }
      formeln(info);
      melde(root, "lernpfad:spielbrett", { modus: "gleichgewicht", richtig: ok || (!A.gg.length && !gewaehlt.size) });
    }

    function baueDominanz() {
      info.innerHTML = "Hat ein Spieler eine Strategie, die <b>immer</b> besser ist, egal was der andere tut? Wähle für beide.";
      const box = neu("div", { class: "stack" });
      const wahl = { z: null, s: null };
      [["z", zn, Z.strategien], ["s", sn, S.strategien]].forEach(([wer, name, strats]) => {
        const g = neu("div", { class: "st-wahl", role: "group", "aria-label": "Dominante Strategie von " + ohneTags(name) });
        g.appendChild(neu("span", { class: wer === "z" ? "st-z" : "st-s", style: "align-self:center" }, name + ":"));
        const opts = strats.map((s, idx) => [ohneTags(s), idx]).concat([["keine", -1]]);
        const bs = [];
        opts.forEach(([t, idx]) => {
          const b = knopf(t); b.setAttribute("aria-pressed", "false");
          b.addEventListener("click", () => { wahl[wer] = idx; bs.forEach((x) => { x.classList.remove("on"); x.setAttribute("aria-pressed", "false"); }); b.classList.add("on"); b.setAttribute("aria-pressed", "true"); });
          bs.push(b); g.appendChild(b);
        });
        box.appendChild(g);
      });
      const p = knopf("Prüfen", "primary");
      p.addEventListener("click", () => {
        if (wahl.z === null || wahl.s === null) { info.innerHTML = "Wähle für beide Spieler eine Antwort."; return; }
        const okZ = wahl.z === A.domZ, okS = wahl.s === A.domS;
        A.dominiertZ.forEach((i) => zeKopf[i].classList.add("gestrichen"));
        A.dominiertS.forEach((j) => spKopf[j].classList.add("gestrichen"));
        const tz = A.domZ >= 0 ? zn + " hat die dominante Strategie " + zs(A.domZ) + "." : zn + " hat keine dominante Strategie: Die beste Wahl hängt davon ab, was " + sn + " tut.";
        const ts = A.domS >= 0 ? sn + " hat die dominante Strategie " + ss(A.domS) + "." : sn + " hat keine dominante Strategie.";
        info.innerHTML = (okZ ? '<span class="marke">✓</span> ' : '<span class="marke">✗</span> ') + tz + "<br>" + (okS ? '<span class="marke">✓</span> ' : '<span class="marke">✗</span> ') + ts +
          (A.dominiertZ.length || A.dominiertS.length ? "<br>Durchgestrichen: dominierte Strategien, die ein vernünftiger Spieler nie wählt." : "");
        melde(root, "lernpfad:spielbrett", { modus: "dominanz", richtig: okZ && okS });
      });
      box.appendChild(p);
      steuer.appendChild(box);
    }

    function gegnerZug() {
      const g = cfg.gegner || "gierig";
      const zufall = () => Math.floor(Math.random() * ns);
      if (g === "zufall") return zufall();
      if (g === "vorsichtig") {
        let best = 0, bestWert = -Infinity;
        for (let j = 0; j < ns; j++) {
          let schlecht = Infinity;
          for (let i = 0; i < nz; i++) { const v = weniger ? -W[i][j][1] : W[i][j][1]; if (v < schlecht) schlecht = v; }
          if (schlecht > bestWert) { bestWert = schlecht; best = j; }
        }
        return best;
      }
      if (g === "dominant" && A.domS >= 0) return A.domS;
      if (letzteZeile < 0) return A.domS >= 0 ? A.domS : zufall();
      const b = A.bestS[letzteZeile];
      return b[Math.floor(Math.random() * b.length)];
    }
    function baueSpiel() {
      konto = { z: 0, s: 0, runden: 0 }; letzteZeile = -1;
      const gname = { zufall: "würfelt", vorsichtig: "spielt vorsichtig", gierig: "antwortet gierig auf deinen letzten Zug", dominant: "spielt hart" }[cfg.gegner || "gierig"] || "";
      info.innerHTML = "Du bist <span class=\"st-z\">" + zn + "</span>. Wähle deine Zeile. " + sn + " " + gname + ".";
      const tafel = neu("div", { class: "st-tafel", "aria-live": "polite" });
      const wahl = neu("div", { class: "st-wahl", role: "group", "aria-label": "Deine Strategie" });
      Z.strategien.forEach((s, i) => {
        const b = knopf(s, "primary");
        b.addEventListener("click", () => {
          const j = gegnerZug();
          felder.flat().forEach((f) => f.classList.remove("an"));
          felder[i][j].classList.add("an");
          konto.z += W[i][j][0]; konto.s += W[i][j][1]; konto.runden++; letzteZeile = i;
          proto.insertAdjacentHTML("beforeend", "<li>R" + konto.runden + ": " + ohneTags(Z.strategien[i]) + " / " + ohneTags(S.strategien[j]) + " → " + mz(W[i][j][0]) + " : " + mz(W[i][j][1]) + "</li>");
          zeichneTafel();
          info.innerHTML = "Runde " + konto.runden + ": " + sn + " wählte " + ss(j) + ". Du bekommst <b>" + w(W[i][j][0]) + "</b>, " + sn + " <b>" + w(W[i][j][1]) + "</b>.";
        });
        wahl.appendChild(b);
      });
      const proto = neu("ol", { class: "st-protokoll", "aria-label": "Verlauf" });
      const reset = knopf("↺ Neu"); reset.addEventListener("click", () => modus("spielen"));
      function zeichneTafel() {
        tafel.innerHTML = '<span class="st-konto">' + figur(Z.figur || "kapitaenin", { groesse: 28 }) + ' <span class="st-z">' + zn + "</span> <b>" + mz(konto.z) + "</b></span>" +
          '<span class="st-konto">' + figur(S.figur || "pirat", { groesse: 28 }) + ' <span class="st-s">' + sn + "</span> <b>" + mz(konto.s) + "</b></span>" +
          '<span class="st-konto">Runden <b>' + konto.runden + "</b></span>";
      }
      zeichneTafel();
      steuer.appendChild(wahl); steuer.appendChild(reset);
      panel.appendChild(tafel); panel.appendChild(proto);
      const alt = panel.querySelectorAll(".st-tafel, .st-protokoll");
      alt.forEach((x) => { if (x !== tafel && x !== proto) x.remove(); });
    }

    modus(modi[0]);
    return {
      modus,
      zuruecksetzen() { modus(aktuell || modi[0]); },
      analyse: A,
    };
  }

  // ------------------------------------------------------------------------
  // Wiederholtes Gefangenendilemma: Duell, Turnier, Evolution
  // ------------------------------------------------------------------------
  const STRATEGIEN = {
    tft: { name: "Tit-for-Tat (Wie du mir, so ich dir)", kurz: "Tit-for-Tat", info: "Beginnt ehrlich, macht dann den letzten Zug des anderen nach.",
      zug: (m, d) => (d.length ? d[d.length - 1] : "K") },
    immer_k: { name: "Immer ehrlich (Gutmensch)", kurz: "Immer ehrlich", info: "Handelt immer ehrlich, egal was passiert.", zug: () => "K" },
    immer_v: { name: "Immer Betrug (Halsabschneider)", kurz: "Immer Betrug", info: "Betrügt immer.", zug: () => "V" },
    grim: { name: "Groll (vergisst nie)", kurz: "Groll", info: "Ehrlich, bis du einmal betrügst. Danach nie wieder.", zug: (m, d) => (d.includes("V") ? "V" : "K") },
    tf2t: { name: "Tit-for-Two-Tats (Geduldig)", kurz: "Geduldig", info: "Betrügt erst, wenn du zweimal hintereinander betrogen hast.",
      zug: (m, d) => (d.length >= 2 && d[d.length - 1] === "V" && d[d.length - 2] === "V" ? "V" : "K") },
    zufall: { name: "Würfel (zufällig)", kurz: "Würfel", info: "Wirft jede Runde eine Münze.", zug: (m, d, r) => (r() < 0.5 ? "K" : "V") },
    pavlov: { name: "Pavlov (Gewinn: bleib, Verlust: wechsle)", kurz: "Pavlov", info: "Gewinn: bleib, Verlust: wechsle. Heisst: ehrlich, wenn beide zuletzt dasselbe taten, sonst Betrug.",
      // Gewinn (3 oder 5) heisst: bleib; Verlust (0 oder 1) heisst: wechsle. Ergibt: ehrlich, wenn beide zuletzt dasselbe taten.
      zug: (m, d) => (!m.length ? "K" : m[m.length - 1] === d[d.length - 1] ? "K" : "V") },
    nachsichtig: { name: "Nachsichtiges Tit-for-Tat", kurz: "Nachsichtig", info: "Wie Tit-for-Tat, vergibt aber jeden zehnten Betrug.",
      zug: (m, d, r) => (!d.length ? "K" : d[d.length - 1] === "V" ? (r() < 0.1 ? "K" : "V") : "K") },
    misstrauisch: { name: "Misstrauisches Tit-for-Tat", kurz: "Misstrauisch", info: "Beginnt mit Betrug, macht dann den letzten Zug des anderen nach.",
      zug: (m, d) => (d.length ? d[d.length - 1] : "V") },
  };
  function auszahlung(a, b, P) {
    if (a === "K" && b === "K") return [P.R, P.R];
    if (a === "K" && b === "V") return [P.S, P.T];
    if (a === "V" && b === "K") return [P.T, P.S];
    return [P.P, P.P];
  }
  function partie(sa, sb, runden, rauschen, r, P) {
    const ha = [], hb = []; let pa = 0, pb = 0;
    for (let k = 0; k < runden; k++) {
      let a = STRATEGIEN[sa].zug(ha, hb, r), b = STRATEGIEN[sb].zug(hb, ha, r);
      if (rauschen && r() < rauschen) a = a === "K" ? "V" : "K";
      if (rauschen && r() < rauschen) b = b === "K" ? "V" : "K";
      ha.push(a); hb.push(b);
      const [x, y] = auszahlung(a, b, P); pa += x; pb += y;
    }
    return { pa, pb, ha, hb };
  }

  function turnier(el, cfg) {
    const root = ziel(el); if (!root) return null;
    const c = cfg || {};
    const P = Object.assign({ T: 5, R: 3, P: 1, S: 0 }, c.werte || {});
    const modusArt = c.modus || "duell";
    const liste = (c.strategien || ["tft", "immer_k", "immer_v", "grim", "zufall"]).filter((s) => STRATEGIEN[s] || (console.error("[Lernpfad] turnier: unbekannte Strategie «" + s + "»"), false));
    root.innerHTML = ""; root.classList.add("stack");
    if (c.titel) root.appendChild(neu("div", { class: "uebung-kopf" }, '<span class="eyebrow">' + ({ duell: "Handelsduell", turnier: "Turnier", evolution: "Evolution" })[modusArt] + "</span><h3>" + c.titel + "</h3>"));
    if (c.frage) root.appendChild(neu("div", { class: "prose" }, c.frage));
    root.appendChild(neu("p", { class: "hint" },
      "Auszahlung je Fahrt: beide ehrlich je " + P.R + ", beide betrügen je " + P.P + ", wer allein betrügt " + P.T + ", wer betrogen wird " + P.S + " Gold."));
    if (modusArt === "duell") return duell(root, c, P, liste);
    if (modusArt === "turnier") return rundum(root, c, P, liste);
    if (modusArt === "evolution") return evolution(root, c, P, liste);
    return fehler("turnier: unbekannter modus «" + modusArt + "»");
  }

  function rauschenRegler(root, start, beiAenderung) {
    const id = uid("rausch");
    const box = neu("div", { class: "regler" });
    box.innerHTML = '<label for="' + id + '">Rauschen (Missverständnisse)</label><input type="range" id="' + id + '" min="0" max="20" step="1" value="' + Math.round((start || 0) * 100) + '"><output for="' + id + '">' + Math.round((start || 0) * 100) + " %</output>";
    const inp = box.querySelector("input"), out = box.querySelector("output");
    inp.addEventListener("input", () => { out.textContent = inp.value + " %"; beiAenderung(Number(inp.value) / 100); });
    root.appendChild(neu("div", { class: "card rechner" })).appendChild(box);
    return () => Number(inp.value) / 100;
  }
  function strategieChips(root, liste, gewaehlt, titel) {
    const g = neu("div", { class: "st-chips", role: "group", "aria-label": titel || "Strategien" });
    liste.forEach((s) => {
      const b = knopf(STRATEGIEN[s].kurz);
      b.title = STRATEGIEN[s].info;
      b.setAttribute("aria-pressed", String(gewaehlt.has(s)));
      b.addEventListener("click", () => {
        if (gewaehlt.has(s) && gewaehlt.size <= 2) return;
        if (gewaehlt.has(s)) gewaehlt.delete(s); else gewaehlt.add(s);
        b.setAttribute("aria-pressed", String(gewaehlt.has(s)));
      });
      g.appendChild(b);
    });
    root.appendChild(neu("p", { class: "hint" }, "Strategien wählen (mindestens zwei). Fahre mit der Maus über einen Namen oder lies die Liste unten."));
    root.appendChild(g);
    const dl = neu("details", { class: "sol" }, "<summary>Was machen die Strategien?</summary><ul>" + liste.map((s) => "<li><b>" + STRATEGIEN[s].name + ":</b> " + STRATEGIEN[s].info + "</li>").join("") + "</ul>");
    root.appendChild(dl);
  }

  function duell(root, c, P, liste) {
    const runden = c.runden || 10;
    const unbekannt = !!c.rundenUnbekannt;
    let r = rng(Date.now() & 0xffffff);
    let gegner, ich, du, punkte, ende, rausch = c.rauschen || 0;
    root.insertAdjacentHTML("beforeend", szene("see", { figuren: [{ art: "kapitaenin", groesse: .7, dx: 40 }, { art: "pirat", groesse: .7, dx: -40 }] }));
    const status = neu("div", { class: "st-tafel", "aria-live": "polite" });
    const fahrten = neu("div", { class: "st-fahrten", "aria-label": "Verlauf: oben du, unten Gegenüber" });
    const info = neu("div", { class: "info", "aria-live": "polite" });
    const wahl = neu("div", { class: "st-wahl", role: "group", "aria-label": "Dein Zug" });
    const bK = knopf("🤝 Ehrlich handeln", "primary"), bV = knopf("🗡 Betrügen");
    wahl.appendChild(bK); wahl.appendChild(bV);
    const neuB = knopf("↺ Neues Duell (neues Gegenüber)");
    root.appendChild(status); root.appendChild(wahl); root.appendChild(fahrten); root.appendChild(info);
    if (c.rauschenRegler) rauschenRegler(root, rausch, (v) => { rausch = v; });
    root.appendChild(neu("div", { class: "row" })).appendChild(neuB);

    function start() {
      gegner = c.gegner && c.gegner !== "geheim" ? c.gegner : liste[Math.floor(Math.random() * liste.length)];
      ich = []; du = []; punkte = [0, 0]; ende = false;
      fahrten.innerHTML = ""; bK.disabled = false; bV.disabled = false;
      info.innerHTML = (c.gegner && c.gegner !== "geheim" ? "Dein Gegenüber spielt <b>" + STRATEGIEN[gegner].name + "</b>. " : "Dein Gegenüber hat eine <b>geheime Strategie</b>. Finde heraus, wie es tickt. ") +
        (unbekannt ? "Niemand weiss, wann die Handelssaison endet." : "Es gibt " + runden + " Fahrten.");
      zeichne();
    }
    function zeichne() {
      status.innerHTML = '<span class="st-konto">' + figur("kapitaenin", { groesse: 28 }) + " Du <b>" + punkte[0] + "</b></span>" +
        '<span class="st-konto">' + figur("pirat", { groesse: 28 }) + " Gegenüber <b>" + punkte[1] + "</b></span>" +
        '<span class="st-konto">Fahrt <b>' + ich.length + (unbekannt ? "" : " / " + runden) + "</b></span>";
    }
    function zug(meins) {
      if (ende) return;
      let a = meins, b = STRATEGIEN[gegner].zug(du, ich, r);
      let ra = false, rb = false;
      if (rausch && r() < rausch) { a = a === "K" ? "V" : "K"; ra = true; }
      if (rausch && r() < rausch) { b = b === "K" ? "V" : "K"; rb = true; }
      ich.push(a); du.push(b);
      const [x, y] = auszahlung(a, b, P); punkte[0] += x; punkte[1] += y;
      fahrten.insertAdjacentHTML("beforeend", '<span class="st-fahrt" role="img" aria-label="Fahrt ' + ich.length + ": du " + (a === "K" ? "ehrlich" : "Betrug") + (ra ? " (Missverständnis)" : "") + ", Gegenüber " + (b === "K" ? "ehrlich" : "Betrug") + (rb ? " (Missverständnis)" : "") + '">' +
        '<span class="' + (a === "K" ? "k" : "v") + (ra ? " rausch" : "") + '">' + (a === "K" ? "🤝" : "🗡") + "</span>" +
        '<span class="' + (b === "K" ? "k" : "v") + (rb ? " rausch" : "") + '">' + (b === "K" ? "🤝" : "🗡") + "</span></span>");
      let t = "Fahrt " + ich.length + ": Du " + (a === "K" ? "handelst ehrlich" : "betrügst") + (ra ? " (ein Missverständnis!)" : "") + ", dein Gegenüber " + (b === "K" ? "handelt ehrlich" : "betrügt") + (rb ? " (ein Missverständnis!)" : "") + ". +" + x + " Gold für dich.";
      zeichne();
      const vorbei = unbekannt ? (ich.length >= 3 && r() < (c.endeWahrscheinlichkeit || 0.12)) || ich.length >= 40 : ich.length >= runden;
      if (vorbei) {
        ende = true; bK.disabled = true; bV.disabled = true;
        // Vergleich: was hätte Tit-for-Tat gegen dieses Gegenüber geholt?
        const vgl = partie("tft", gegner, ich.length, 0, rng(7), P);
        t += "<br><b>" + (unbekannt ? "Sturm zieht auf, die Saison ist vorbei." : "Alle Fahrten gemacht.") + "</b> Dein Gegenüber spielte <b>" + STRATEGIEN[gegner].name + "</b>: " + STRATEGIEN[gegner].info +
          " Du hast " + punkte[0] + " Gold, dein Gegenüber " + punkte[1] + ". Zum Vergleich: Tit-for-Tat hätte gegen dieses Gegenüber " + vgl.pa + " Gold geholt.";
        info.innerHTML = t; neuB.focus();
        melde(root, "lernpfad:turnier", { modus: "duell", punkte: punkte[0], gegner });
        return;
      }
      info.innerHTML = t;
    }
    bK.addEventListener("click", () => zug("K"));
    bV.addEventListener("click", () => zug("V"));
    neuB.addEventListener("click", start);
    start();
    return { neuStarten: start };
  }

  function rundum(root, c, P, liste) {
    const gewaehlt = new Set(c.vorauswahl || liste);
    strategieChips(root, liste, gewaehlt, "Strategien im Turnier");
    let rausch = c.rauschen || 0;
    if (c.rauschenRegler !== false) rauschenRegler(root, rausch, (v) => { rausch = v; });
    const runden = c.runden || 200;
    const los = knopf("⚔ Turnier starten", "primary");
    root.appendChild(neu("div", { class: "row" })).appendChild(los);
    const erg = neu("div", { class: "stack", "aria-live": "polite" });
    root.appendChild(erg);
    let durchgang = 0;
    los.addEventListener("click", () => {
      durchgang++;
      const r = rng(1234 + durchgang * 7919);
      const sl = liste.filter((s) => gewaehlt.has(s));
      const summe = {}; sl.forEach((s) => (summe[s] = 0));
      for (let a = 0; a < sl.length; a++) for (let b = a; b < sl.length; b++) {
        const p = partie(sl[a], sl[b], runden, rausch, r, P);
        if (a === b) summe[sl[a]] += p.pa; else { summe[sl[a]] += p.pa; summe[sl[b]] += p.pb; }
      }
      const sortiert = sl.slice().sort((x, y) => summe[y] - summe[x]);
      const max = summe[sortiert[0]] || 1;
      const proRunde = (s) => summe[s] / (runden * sl.length);
      erg.innerHTML = "<h4>Ergebnis (" + runden + " Fahrten pro Begegnung, jeder gegen jeden und gegen sich selbst" + (rausch ? ", " + Math.round(rausch * 100) + " % Rauschen" : "") + ")</h4>" +
        '<ol class="st-balkenliste">' + sortiert.map((s, i) => '<li class="' + (i === 0 ? "erster" : "") + '"><span>' + (i === 0 ? "🏆 " : "") + STRATEGIEN[s].kurz + '</span><span class="st-bb" aria-hidden="true"><i style="width:' + Math.round((summe[s] / max) * 100) + '%"></i></span><span class="zahl">' + zahl(proRunde(s), 2) + " / Fahrt</span></li>").join("") + "</ol>" +
        '<p class="hint">Durchschnitt Gold pro Fahrt. Nochmals starten würfelt neu (Würfel, Rauschen).</p>';
      melde(root, "lernpfad:turnier", { modus: "turnier", sieger: sortiert[0] });
    });
    return {};
  }

  function evolution(root, c, P, liste) {
    const gewaehlt = new Set(c.vorauswahl || liste);
    strategieChips(root, liste, gewaehlt, "Strategien in der Population");
    let rausch = c.rauschen || 0;
    if (c.rauschenRegler !== false) rauschenRegler(root, rausch, (v) => { rausch = v; zuruecksetzen(); });
    const steuer = neu("div", { class: "row" });
    const b1 = knopf("▶ 1 Generation", "primary"), b10 = knopf("⏩ 10 Generationen"), b0 = knopf("↺ Neu beginnen");
    steuer.appendChild(b1); steuer.appendChild(b10); steuer.appendChild(b0);
    root.appendChild(steuer);
    const bild = neu("div", { class: "st-evo" });
    const legende = neu("div", { class: "st-legende-ev st-evo" });
    const info = neu("div", { class: "info", "aria-live": "polite" });
    root.appendChild(bild); root.appendChild(legende); root.appendChild(info);
    let sl, M, anteile, verlauf;
    const maxGen = 40;
    function matrix() {
      const r = rng(4242);
      sl = liste.filter((s) => gewaehlt.has(s));
      M = sl.map(() => sl.map(() => 0));
      for (let a = 0; a < sl.length; a++) for (let b = 0; b < sl.length; b++) {
        let s = 0; for (let k = 0; k < 4; k++) s += partie(sl[a], sl[b], 50, rausch, r, P).pa;
        M[a][b] = s / 200;
      }
    }
    function zuruecksetzen() {
      matrix();
      const start = c.anteile || null;
      anteile = sl.map((s) => (start && start[s] !== undefined ? start[s] : 1));
      const sum = anteile.reduce((x, y) => x + y, 0); anteile = anteile.map((x) => x / sum);
      verlauf = [anteile.slice()];
      zeichne();
    }
    function schritt() {
      const fit = sl.map((_, i) => sl.reduce((acc, __, j) => acc + anteile[j] * M[i][j], 0));
      const mittel = fit.reduce((acc, f, i) => acc + f * anteile[i], 0) || 1;
      anteile = anteile.map((a, i) => (a * fit[i]) / mittel);
      anteile = anteile.map((a) => (a < 0.001 ? 0 : a));
      const s = anteile.reduce((x, y) => x + y, 0); anteile = anteile.map((a) => a / s);
      verlauf.push(anteile.slice());
      if (verlauf.length > maxGen + 1) verlauf.shift();
    }
    function zeichne() {
      const B = 320, H = 160, n = verlauf.length, bw = B / Math.max(n, 12);
      let svg = '<svg viewBox="0 0 ' + B + " " + (H + 18) + '" role="img" aria-label="Anteile der Strategien über die Generationen"><title>Anteile über die Generationen</title>';
      verlauf.forEach((a, g) => {
        let y = H;
        a.forEach((v, i) => { const h = v * H; y -= h; if (h > 0.2) svg += '<rect class="st-ev' + ((i % 9) + 1) + '" x="' + (g * bw).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw - 0.6).toFixed(1) + '" height="' + h.toFixed(1) + '"/>'; });
      });
      svg += '<text x="0" y="' + (H + 14) + '" style="font-size:9px">Generation ' + Math.max(0, (verlauf.length - 1)) + " (letzte " + Math.min(maxGen, verlauf.length) + ")</text></svg>";
      bild.innerHTML = svg;
      legende.innerHTML = sl.map((s, i) => '<span><svg width="12" height="12" aria-hidden="true"><rect class="st-ev' + ((i % 9) + 1) + '" width="12" height="12" rx="2"/></svg>' + STRATEGIEN[s].kurz + " " + Math.round(anteile[i] * 100) + " %</span>").join("");
      const top = sl.map((s, i) => [s, anteile[i]]).sort((x, y) => y[1] - x[1])[0];
      info.innerHTML = "Stärkste Flotte: <b>" + STRATEGIEN[top[0]].kurz + "</b> mit " + Math.round(top[1] * 100) + " %. Erfolgreiche Strategien bekommen in der nächsten Generation mehr Schiffe.";
    }
    b1.addEventListener("click", () => { if (sl.length !== gewaehlt.size || sl.some((s) => !gewaehlt.has(s))) zuruecksetzen(); schritt(); zeichne(); });
    b10.addEventListener("click", () => { if (sl.length !== gewaehlt.size || sl.some((s) => !gewaehlt.has(s))) zuruecksetzen(); for (let k = 0; k < 10; k++) schritt(); zeichne(); });
    b0.addEventListener("click", zuruecksetzen);
    zuruecksetzen();
    return { zuruecksetzen };
  }

  // ------------------------------------------------------------------------
  // Spielbaum mit Rückwärtsinduktion
  // ------------------------------------------------------------------------
  function baum(el, cfg) {
    const root = ziel(el); if (!root) return null;
    if (!cfg || !cfg.knoten || !Array.isArray(cfg.spieler)) return fehler("baum braucht spieler und knoten.");
    const KN = cfg.knoten, SP = cfg.spieler;
    const wurzel = cfg.wurzel || Object.keys(KN)[0];
    for (const id in KN) {
      const k = KN[id];
      if (!k.ende) (k.aeste || []).forEach((a) => { if (!KN[a.ziel]) console.error("[Lernpfad] baum: Ziel «" + a.ziel + "» fehlt"); });
    }
    root.innerHTML = ""; root.classList.add("stack", "st-baum");
    if (cfg.titel) root.appendChild(neu("div", { class: "uebung-kopf" }, '<span class="eyebrow">Spielbaum</span><h3>' + cfg.titel + "</h3>"));
    if (cfg.frage) root.appendChild(neu("div", { class: "prose" }, cfg.frage));
    root.appendChild(neu("p", { class: "hint" }, "Werte am Ende: " + SP.map((s, i) => '<span class="' + (i === 0 ? "st-z" : "st-s") + '">' + s.name + "</span>").join(" | ") + ". Löse den Baum von hinten: An jedem Punkt wählt, wer am Zug ist, was <b>ihm selbst</b> am meisten bringt."));
    const bild = neu("div", { class: "tablebox" });
    const frage = neu("div", { class: "st-baum-frage stack" });
    const info = neu("div", { class: "info", "aria-live": "polite" });
    const steuer = neu("div", { class: "row" });
    const bLoes = knopf("Lösung zeigen"), bNeu = knopf("↺ Zurücksetzen");
    steuer.appendChild(bLoes); steuer.appendChild(bNeu);
    root.appendChild(bild); root.appendChild(frage); root.appendChild(info); root.appendChild(steuer);

    // Layout
    const pos = {}; let blattNr = 0; let tiefeMax = 0;
    (function lay(id, tiefe) {
      const k = KN[id]; tiefeMax = Math.max(tiefeMax, tiefe);
      if (k.ende) { pos[id] = { x: blattNr++, y: tiefe }; return; }
      k.aeste.forEach((a) => lay(a.ziel, tiefe + 1));
      const xs = k.aeste.map((a) => pos[a.ziel].x);
      pos[id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: tiefe };
    })(wurzel, 0);
    const DX = 118, DY = 92, PAD = 64;
    const breite = Math.max(320, (blattNr - 1) * DX + 2 * PAD);
    const hoehe = tiefeMax * DY + 80;
    const px = (id) => PAD + pos[id].x * DX + (breite - 2 * PAD - (blattNr - 1) * DX) / 2;
    const py = (id) => 26 + pos[id].y * DY;

    let wert = {}, wahl = {};
    const reihenfolge = [];
    (function post(id) { const k = KN[id]; if (k.ende) return; k.aeste.forEach((a) => post(a.ziel)); reihenfolge.push(id); })(wurzel);

    function zeichne(aktuell) {
      let s = '<svg viewBox="0 0 ' + breite + " " + hoehe + '" style="width:' + Math.max(320, Math.min(breite, 900)) + 'px" role="img" aria-label="Spielbaum, Beschreibung im Text darunter"><title>Spielbaum</title>';
      (function kanten(id) {
        const k = KN[id]; if (k.ende) return;
        k.aeste.forEach((a, n) => {
          const cls = wahl[id] === undefined ? "" : wahl[id] === n ? " gewaehlt" : " weg";
          s += '<path class="st-ast' + cls + '" d="M' + px(id) + " " + py(id) + " L" + px(a.ziel) + " " + (py(a.ziel) - (KN[a.ziel].ende ? 18 : 0)) + '"/>';
          const mx = (px(id) + px(a.ziel)) / 2, my = (py(id) + py(a.ziel)) / 2;
          s += '<text class="st-ast-t" text-anchor="' + (px(a.ziel) < px(id) ? "end" : px(a.ziel) > px(id) ? "start" : "middle") + '" x="' + (mx + (px(a.ziel) < px(id) ? -14 : px(a.ziel) > px(id) ? 14 : 0)) + '" y="' + (my - 4) + '">' + esc(ohneTags(a.text)) + "</text>";
          kanten(a.ziel);
        });
      })(wurzel);
      for (const id in pos) {
        const k = KN[id];
        if (k.ende) {
          s += '<rect class="st-blatt" x="' + (px(id) - 52) + '" y="' + (py(id) - 18) + '" width="104" height="44" rx="8"/>';
          if (k.kurz) s += '<text class="st-blatt-t" text-anchor="middle" x="' + px(id) + '" y="' + (py(id) - 2) + '">' + esc(k.kurz) + "</text>";
          s += '<text class="st-wert" text-anchor="middle" x="' + px(id) + '" y="' + (py(id) + (k.kurz ? 16 : 8)) + '">' + k.werte.map(mz).join(" | ") + "</text>";
        } else {
          const cls = k.spieler === 0 ? "z" : k.spieler === 1 ? "s" : "d";
          s += '<circle class="st-knoten ' + cls + (id === aktuell ? " aktuell" : "") + '" cx="' + px(id) + '" cy="' + py(id) + '" r="17"/>';
          s += '<text class="st-kn-t" text-anchor="middle" x="' + px(id) + '" y="' + (py(id) + 4) + '">' + esc(SP[k.spieler].name.charAt(0)) + "</text>";
          if (wert[id]) s += '<text class="st-wert" text-anchor="middle" x="' + px(id) + '" y="' + (py(id) - 22) + '">(' + wert[id].map(mz).join(" | ") + ")</text>";
        }
      }
      bild.innerHTML = s + "</svg>";
    }
    function wertVon(id) { return KN[id].ende ? KN[id].werte : wert[id]; }
    function naechster() { return reihenfolge.find((id) => wahl[id] === undefined); }
    function frageStellen() {
      const id = naechster();
      zeichne(id);
      frage.innerHTML = "";
      if (!id) { fertig(); return; }
      const k = KN[id]; const sp = SP[k.spieler];
      frage.appendChild(neu("p", null, "<b>Punkt " + (reihenfolge.indexOf(id) + 1) + " von " + reihenfolge.length + ":</b> " + (k.text || "") + " Hier entscheidet <span class=\"" + (k.spieler === 0 ? "st-z" : "st-s") + "\">" + sp.name + "</span>. Was wählt " + sp.name + "?"));
      const opt = neu("div", { class: "st-optionen" });
      k.aeste.forEach((a, n) => {
        const v = wertVon(a.ziel);
        const b = knopf(a.text + ' <span class="hint">→ ' + SP.map((p, i) => p.name + " " + mz(v[i])).join(", ") + "</span>");
        b.addEventListener("click", () => antwort(id, n));
        opt.appendChild(b);
      });
      frage.appendChild(opt);
    }
    function antwort(id, n) {
      const k = KN[id]; const sp = k.spieler;
      const werte = k.aeste.map((a) => wertVon(a.ziel)[sp]);
      const best = Math.max(...werte);
      if (werte[n] === best) {
        wahl[id] = n; wert[id] = wertVon(k.aeste[n].ziel);
        info.innerHTML = '<span class="marke">✓</span> Richtig: ' + SP[sp].name + " wählt «" + ohneTags(k.aeste[n].text) + "» und bekommt " + mz(best) + ". " + (k.warum ? k.warum : "");
        frageStellen();
        const b = frage.querySelector("button"); if (b) b.focus();
      } else {
        const bi = werte.indexOf(best);
        info.innerHTML = '<span class="marke">✗</span> ' + SP[sp].name + " bekäme hier nur " + mz(werte[n]) + ", mit «" + ohneTags(k.aeste[bi].text) + "» aber " + mz(best) + ". Am Zug zählt nur der eigene Vorteil, keine Versprechen.";
      }
    }
    function fertig() {
      const pfad = []; let id = wurzel;
      while (!KN[id].ende) { const a = KN[id].aeste[wahl[id]]; pfad.push(SP[KN[id].spieler].name + ": «" + ohneTags(a.text) + "»"); id = a.ziel; }
      frage.innerHTML = '<div class="note tipp"><b>Gleichgewichtspfad:</b> ' + pfad.join(" → ") + " → Ergebnis " + SP.map((p, i) => p.name + " " + mz(KN[id].werte[i])).join(", ") + "." + (cfg.erklaerung ? "<p>" + cfg.erklaerung + "</p>" : "") + "</div>";
      formeln(frage);
      melde(root, "lernpfad:baum", { fertig: true });
    }
    function loesen() {
      reihenfolge.forEach((id) => {
        if (wahl[id] !== undefined) return;
        const k = KN[id]; const werte = k.aeste.map((a) => wertVon(a.ziel)[k.spieler]);
        const n = werte.indexOf(Math.max(...werte)); wahl[id] = n; wert[id] = wertVon(k.aeste[n].ziel);
      });
      info.innerHTML = "Lösung eingezeichnet: dicke Äste werden gewählt, gestrichelte nie.";
      frageStellen();
    }
    function neuStart() { wert = {}; wahl = {}; info.innerHTML = ""; frageStellen(); }
    bLoes.addEventListener("click", loesen);
    bNeu.addEventListener("click", neuStart);
    neuStart();
    return { loesen, zuruecksetzen: neuStart };
  }

  // ------------------------------------------------------------------------
  // Szenario (verzweigte Geschichte mit Ressourcen und Entscheidungskarten)
  // ------------------------------------------------------------------------
  function szenario(el, cfg) {
    const root = ziel(el); if (!root) return null;
    if (!cfg || !cfg.knoten || !cfg.start) return fehler("szenario braucht start und knoten.");
    const RES = cfg.ressourcen || [];
    root.innerHTML = ""; root.classList.add("stack", "st-szenario");
    if (cfg.titel) root.appendChild(neu("div", { class: "uebung-kopf" }, '<span class="eyebrow">Simulation</span><h3>' + cfg.titel + "</h3>"));
    if (cfg.einleitung) root.appendChild(neu("div", { class: "prose" }, cfg.einleitung));
    const leiste = neu("div", { class: "st-leiste", role: "group", "aria-label": "Deine Ressourcen" });
    const buehne = neu("div", { class: "st-buehne stack" });
    const live = neu("div", { class: "sr-only", "aria-live": "polite" });
    root.appendChild(leiste); root.appendChild(buehne); root.appendChild(live);
    let stand, verlauf, knotenId;

    function begrenze(r, v) { return Math.max(r.min === undefined ? 0 : r.min, Math.min(r.max === undefined ? 100 : r.max, v)); }
    function zeichneLeiste(deltas) {
      leiste.innerHTML = RES.map((r) => {
        const v = stand[r.id]; const max = r.max === undefined ? 100 : r.max, min = r.min === undefined ? 0 : r.min;
        const anteil = Math.round(((v - min) / (max - min || 1)) * 100);
        const kritisch = r.gut === "tief" ? anteil >= 75 : anteil <= 20;
        const d = deltas && deltas[r.id] ? '<span class="st-delta ' + (deltas[r.id] > 0 ? "plus" : "minus") + '">' + (deltas[r.id] > 0 ? "+" : "") + deltas[r.id] + "</span>" : "";
        return '<div class="st-res' + (kritisch ? " kritisch" : "") + '" role="group" aria-label="' + esc(r.name) + ": " + v + (kritisch ? " (kritisch)" : "") + '">' +
          '<span class="st-sym" aria-hidden="true">' + (r.symbol || "◆") + '</span><span class="st-rn">' + r.name + '</span><span class="st-rw">' + v + d +
          '<span class="st-balken" aria-hidden="true"><i style="width:' + anteil + '%"></i></span></span></div>';
      }).join("");
    }
    function text(t) { return typeof t === "function" ? t(stand, verlauf) : t || ""; }
    function zeige(id) {
      knotenId = id;
      const k = cfg.knoten[id];
      if (!k) { fehler("szenario: Knoten «" + id + "» fehlt."); return; }
      if (k.effekte) anwenden(k.effekte);
      if (k.weiche) { const z = k.weiche(stand, verlauf); if (z && z !== id) { zeige(z); return; } }
      if (k.ende) { endeZeigen(k.ende); return; }
      zeichneLeiste();
      buehne.innerHTML = "";
      if (k.szene) buehne.insertAdjacentHTML("beforeend", szene(k.szene, { figuren: k.figuren || [] }));
      if (k.ort) buehne.appendChild(neu("span", { class: "st-ort" }, k.ort));
      const rede = neu("div", { tabindex: "-1" }, sprecher(k.figur || "papagei", k.sprecher, text(k.text), { stimmung: k.stimmung }));
      buehne.appendChild(rede);
      const karten = neu("div", { class: "st-karten", role: "group", "aria-label": "Deine Möglichkeiten" });
      (k.karten || []).filter((ka) => !ka.bedingung || ka.bedingung(stand, verlauf)).forEach((ka) => {
        const b = neu("button", { type: "button", class: "st-karte" });
        b.innerHTML = '<span class="st-ksym" aria-hidden="true">' + (ka.symbol || "✦") + '</span><span class="st-kt">' + ka.titel + "</span>" + (ka.text ? '<span class="st-kx">' + text(ka.text) + "</span>" : "");
        b.addEventListener("click", () => waehle(k, ka));
        karten.appendChild(b);
      });
      buehne.appendChild(karten);
      formeln(buehne);
      return rede;
    }
    function anwenden(eff) {
      const d = {};
      RES.forEach((r) => {
        if (eff[r.id] === undefined) return;
        const v = typeof eff[r.id] === "function" ? eff[r.id](stand) : eff[r.id];
        const alt = stand[r.id]; stand[r.id] = begrenze(r, alt + v); d[r.id] = stand[r.id] - alt;
      });
      return d;
    }
    function waehle(k, ka) {
      const d = anwenden(ka.effekte || {});
      if (ka.setze) Object.assign(stand, ka.setze);
      verlauf.push({ knoten: knotenId, karte: ohneTags(ka.titel) });
      zeichneLeiste(d);
      const karten = buehne.querySelector(".st-karten");
      if (karten) karten.remove();
      const gewaehlt = neu("p", { class: "hint" }, "Deine Wahl: <b>" + ka.titel + "</b>");
      buehne.appendChild(gewaehlt);
      const folge = ka.folge ? neu("div", null, sprecher(ka.folgeFigur || k.figur || "papagei", ka.folgeSprecher || k.sprecher, text(ka.folge), { klein: true, stimmung: ka.folgeStimmung })) : null;
      if (folge) buehne.appendChild(folge);
      const lupe = neu("div", { class: "st-lupe", tabindex: "-1" });
      const dt = Object.keys(d).filter((x) => d[x]).map((x) => { const r = RES.find((q) => q.id === x); return (r.symbol || "") + " " + r.name + " " + (d[x] > 0 ? "+" : "") + d[x]; }).join(", ");
      lupe.innerHTML = "<h4>Konzept-Lupe</h4>" + (ka.lupe ? "<p>" + text(ka.lupe) + "</p>" : "") + (dt ? '<p class="hint">Folgen: ' + dt + "</p>" : "");
      buehne.appendChild(lupe);
      const weiter = knopf("Weiter →", "primary");
      weiter.addEventListener("click", () => {
        let zielId = ka.ziel;
        if (cfg.pruefe) { const e = cfg.pruefe(stand, verlauf); if (e) { endeZeigen(e); return; } }
        if (typeof zielId === "function") zielId = zielId(stand, verlauf);
        if (ka.ende) { endeZeigen(ka.ende); return; }
        const r = zeige(zielId);
        if (r) r.focus();
      });
      buehne.appendChild(neu("div", { class: "row" })).appendChild(weiter);
      live.textContent = "Gewählt: " + ohneTags(ka.titel) + (dt ? ". Folgen: " + dt : "");
      formeln(buehne);
      lupe.focus();
    }
    function endeZeigen(endeId) {
      const e = (cfg.enden || {})[endeId];
      if (!e) { fehler("szenario: Ende «" + endeId + "» fehlt."); return; }
      zeichneLeiste();
      buehne.innerHTML = "";
      if (e.szene) buehne.insertAdjacentHTML("beforeend", szene(e.szene, { figuren: e.figuren || [] }));
      const box = neu("div", { class: "st-pergament stack", tabindex: "-1" });
      box.innerHTML = '<div class="st-ende"><span class="st-siegel ' + (e.farbe || "") + '"><span aria-hidden="true">' + (e.symbol || "⚓") + "</span>" + (e.siegel || "Ende") + "</span><div><span class=\"eyebrow\">Ende der Simulation</span><h4 style=\"margin:.2em 0\">" + e.titel + "</h4></div></div>" +
        "<div class=\"prose\">" + text(e.text) + "</div>" +
        (e.konzepte ? '<div><b>Diese Konzepte haben entschieden:</b><ul class="st-konzepte">' + e.konzepte.map((x) => "<li>" + x + "</li>").join("") + "</ul></div>" : "") +
        '<details class="sol"><summary>Dein Weg</summary><ol class="st-verlauf">' + verlauf.map((v) => "<li>" + esc(v.karte) + "</li>").join("") + "</ol></details>";
      const nochmal = knopf("↺ Nochmals spielen", "primary");
      nochmal.addEventListener("click", () => { neuStarten(); const r = buehne.querySelector("[tabindex='-1']"); if (r) r.focus(); });
      box.appendChild(neu("div", { class: "row" })).appendChild(nochmal);
      buehne.appendChild(box);
      formeln(buehne);
      box.focus();
      live.textContent = "Ende: " + ohneTags(e.titel);
      melde(root, "lernpfad:szenario", { ende: endeId, stand: Object.assign({}, stand) });
    }
    function neuStarten() {
      stand = {}; RES.forEach((r) => (stand[r.id] = r.start === undefined ? 50 : r.start));
      if (cfg.zustand) Object.assign(stand, JSON.parse(JSON.stringify(cfg.zustand)));
      verlauf = [];
      zeige(cfg.start);
    }
    neuStarten();
    return { neuStarten, stand: () => Object.assign({}, stand) };
  }

  // ------------------------------------------------------------------------
  // Lagetisch: Akteure und ihr wahrscheinlicher Zug
  // ------------------------------------------------------------------------
  function akteure(el, cfg) {
    const root = ziel(el); if (!root) return null;
    if (!cfg || !Array.isArray(cfg.akteure)) return fehler("akteure braucht akteure.");
    root.innerHTML = ""; root.classList.add("stack");
    if (cfg.titel) root.appendChild(neu("div", { class: "uebung-kopf" }, '<span class="eyebrow">Lagetisch</span><h3>' + cfg.titel + "</h3>"));
    if (cfg.lage) root.appendChild(neu("div", { class: "prose" }, cfg.lage));
    if (cfg.hinweis) root.appendChild(neu("p", { class: "st-hinweis-lage" }, cfg.hinweis));
    const liste = neu("div", { class: "st-akteure" });
    const karten = cfg.akteure.map((a, n) => {
      const id = uid("akt");
      const k = neu("div", { class: "st-akteur" });
      k.innerHTML = figur(a.figur || "diplomatin", { groesse: 60 }) + "<div><h4>" + a.name + "</h4><dl>" +
        (a.interessen ? "<dt>Will</dt><dd>" + a.interessen + "</dd>" : "") + (a.alternative ? "<dt>Sonst</dt><dd>" + a.alternative + "</dd>" : "") +
        (a.druck ? "<dt>Druck</dt><dd>" + a.druck + "</dd>" : "") + "</dl></div>" +
        '<fieldset><legend>' + (a.frage || "Welcher Zug ist am wahrscheinlichsten?") + "</legend>" +
        a.optionen.map((o, i) => '<label><input type="radio" name="' + id + '" value="' + i + '"> <span>' + o + "</span></label>").join("") + "</fieldset>" +
        '<div class="st-urteil" aria-live="polite"></div>';
      liste.appendChild(k);
      return k;
    });
    root.appendChild(liste);
    const steuer = neu("div", { class: "row" });
    const p = knopf("Lage auswerten", "primary"), z = knopf("↺ Zurücksetzen");
    const stand = neu("div", { class: "info", "aria-live": "polite" });
    steuer.appendChild(p); steuer.appendChild(z);
    root.appendChild(steuer); root.appendChild(stand);
    p.addEventListener("click", () => {
      let richtig = 0, offen = 0;
      cfg.akteure.forEach((a, n) => {
        const k = karten[n]; const sel = k.querySelector("input:checked");
        const u = k.querySelector(".st-urteil");
        k.classList.remove("richtig", "falsch");
        if (!sel) { offen++; u.innerHTML = '<p class="hint">Noch keine Wahl.</p>'; return; }
        const ok = Number(sel.value) === a.richtig;
        if (ok) richtig++;
        k.classList.add(ok ? "richtig" : "falsch");
        u.innerHTML = '<div class="rueckmeldung ' + (ok ? "ok" : "bad") + '"><span class="marke">' + (ok ? "✓" : "✗") + "</span> " + (ok ? "Passt. " : "Wahrscheinlicher: «" + ohneTags(a.optionen[a.richtig]) + "». ") + (a.begruendung || "") + "</div>";
      });
      stand.innerHTML = richtig + " von " + cfg.akteure.length + " Zügen richtig vorhergesagt" + (offen ? " (" + offen + " offen)" : "") + "." + (cfg.erklaerung && !offen ? "<br>" + cfg.erklaerung : "");
      formeln(root);
      melde(root, "lernpfad:akteure", { richtig, gesamt: cfg.akteure.length });
    });
    z.addEventListener("click", () => {
      karten.forEach((k) => { k.classList.remove("richtig", "falsch"); k.querySelectorAll("input").forEach((i) => (i.checked = false)); k.querySelector(".st-urteil").innerHTML = ""; });
      stand.innerHTML = "";
    });
    return {};
  }

  // ------------------------------------------------------------------------
  // Mischer: Unberechenbar sein gegen eine lernende Gegenspielerin
  // ------------------------------------------------------------------------
  function mischer(el, cfg) {
    const root = ziel(el); if (!root) return null;
    const c = cfg || {};
    const links = c.links || "Nordroute", rechts = c.rechts || "Südroute";
    const runden = c.runden || 30;
    root.innerHTML = ""; root.classList.add("stack", "st-mischer");
    if (c.titel) root.appendChild(neu("div", { class: "uebung-kopf" }, '<span class="eyebrow">Versteckspiel</span><h3>' + c.titel + "</h3>"));
    if (c.frage) root.appendChild(neu("div", { class: "prose" }, c.frage));
    const tafel = neu("div", { class: "st-tafel", "aria-live": "polite" });
    const wahl = neu("div", { class: "st-mischer-wahl", role: "group", "aria-label": "Deine Wahl" });
    const bL = knopf("⬅ " + links, "primary"), bR = knopf(rechts + " ➡", "primary");
    wahl.appendChild(bL); wahl.appendChild(bR);
    const info = neu("div", { class: "info", "aria-live": "polite" });
    const bild = neu("div");
    const auto = neu("div", { class: "card rechner" });
    const rid = uid("mix");
    auto.innerHTML = '<div class="regler"><label for="' + rid + '">Automatisch spielen: Anteil ' + esc(links) + '</label><input type="range" id="' + rid + '" min="0" max="100" step="5" value="50"><output for="' + rid + '">50 %</output></div>';
    const autoB = knopf("🎲 " + runden + " Runden automatisch");
    auto.appendChild(neu("div", { class: "row" })).appendChild(autoB);
    const neuB = knopf("↺ Neu");
    root.appendChild(tafel); root.appendChild(wahl); root.appendChild(info); root.appendChild(bild); root.appendChild(auto);
    root.appendChild(neu("div", { class: "row" })).appendChild(neuB);
    const inp = auto.querySelector("input"), out = auto.querySelector("output");
    inp.addEventListener("input", () => (out.textContent = inp.value + " %"));
    let zuege, treffer, r = rng(99);
    function vorhersage() {
      if (zuege.length < 2) return r() < 0.5 ? "L" : "R";
      const z = { L: 0, R: 0 };
      const letzte2 = zuege.slice(-2).join("");
      for (let i = 2; i < zuege.length; i++) if (zuege[i - 2] + zuege[i - 1] === letzte2) z[zuege[i]] += 2;
      zuege.slice(-8).forEach((x) => (z[x] += 1));
      if (z.L === z.R) return r() < 0.5 ? "L" : "R";
      return z.L > z.R ? "L" : "R";
    }
    function zug(x, still) {
      if (zuege.length >= runden) return;
      const v = vorhersage();
      zuege.push(x);
      const erwischt = v === x;
      treffer.push(erwischt ? 0 : 1);
      if (!still) info.innerHTML = "Du nimmst die " + (x === "L" ? links : rechts) + ". " + (c.gegnerin || "Die Küstenwache") + " wartet bei der " + (v === "L" ? links : rechts) + ": " + (erwischt ? "<b>erwischt!</b>" : "<b>durchgekommen!</b>");
      zeichne();
      if (zuege.length >= runden) fertig();
    }
    function zeichne() {
      const ok = treffer.reduce((a, b) => a + b, 0);
      const anteilL = zuege.length ? Math.round((zuege.filter((x) => x === "L").length / zuege.length) * 100) : 0;
      tafel.innerHTML = '<span class="st-konto">Runde <b>' + zuege.length + " / " + runden + '</b></span><span class="st-konto">Durchgekommen <b>' + ok + '</b></span><span class="st-konto">Anteil ' + esc(links) + " <b>" + anteilL + " %</b></span>";
      const B = 320, H = 110;
      let d = "", pts = "", s = 0;
      treffer.forEach((t, i) => {
        s += t; const x = 10 + (i / Math.max(1, runden - 1)) * (B - 20), y = H - 10 - (s / (i + 1)) * (H - 20);
        d += (i ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
        pts += '<circle class="st-mpunkt ' + (t ? "ok" : "bad") + '" cx="' + x.toFixed(1) + '" cy="' + (H + 6) + '" r="2.6"/>';
      });
      bild.innerHTML = '<svg viewBox="0 0 ' + B + " " + (H + 14) + '" role="img" aria-label="Erfolgsquote über die Runden: ' + (treffer.length ? Math.round((s / treffer.length) * 100) : 0) + ' Prozent"><title>Erfolgsquote</title>' +
        '<line class="achse" x1="10" y1="' + (H - 10) + '" x2="' + (B - 10) + '" y2="' + (H - 10) + '"/>' +
        '<line class="st-mref" x1="10" y1="' + (H / 2) + '" x2="' + (B - 10) + '" y2="' + (H / 2) + '"/>' +
        '<text x="' + (B - 10) + '" y="' + (H / 2 - 4) + '" text-anchor="end" style="font-size:8px">50 %</text>' +
        (d ? '<path class="st-mk" d="' + d + '"/>' : "") + pts + "</svg>";
    }
    function fertig() {
      const ok = treffer.reduce((a, b) => a + b, 0);
      info.innerHTML = "<b>Ergebnis:</b> " + ok + " von " + runden + " Mal durchgekommen (" + Math.round((ok / runden) * 100) + " %). " +
        (ok / runden >= 0.4 ? "Gut gemischt: Die Gegenseite fand kaum ein Muster." : "Die Gegenseite hat ein Muster bei dir gefunden. Wer berechenbar ist, wird ausgenutzt. (Auch echter Zufall schwankt: Spiel nochmals und vergleiche.)") +
        (c.erklaerung ? " " + c.erklaerung : "");
      bL.disabled = true; bR.disabled = true;
      melde(root, "lernpfad:mischer", { durch: ok, runden });
    }
    function neuStart() { zuege = []; treffer = []; r = rng(99 + Math.floor(Math.random() * 1000)); bL.disabled = false; bR.disabled = false; info.innerHTML = c.start || "Wähle Runde für Runde eine Route. Die Gegenseite merkt sich deine Gewohnheiten."; zeichne(); }
    bL.addEventListener("click", () => zug("L"));
    bR.addEventListener("click", () => zug("R"));
    autoB.addEventListener("click", () => {
      neuStart();
      const p = Number(inp.value) / 100; const rz = rng(Math.floor(Math.random() * 1e6));
      for (let i = 0; i < runden; i++) zug(rz() < p ? "L" : "R", true);
    });
    neuB.addEventListener("click", neuStart);
    neuStart();
    return { neuStarten: neuStart };
  }

  // ------------------------------------------------------------------------
  // Automatisch: [data-st-figur], [data-st-szene]
  // ------------------------------------------------------------------------
  function automatisch() {
    document.querySelectorAll("[data-st-figur]").forEach((e) => {
      e.innerHTML = figur(e.getAttribute("data-st-figur"), { groesse: Number(e.getAttribute("data-st-groesse")) || 72, stimmung: e.getAttribute("data-st-stimmung") || undefined, titel: e.getAttribute("data-st-titel") || undefined });
    });
    document.querySelectorAll("[data-st-szene]").forEach((e) => {
      const f = (e.getAttribute("data-st-figuren") || "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
        const [art, stimmung] = x.split(":"); return { art, stimmung };
      });
      e.innerHTML = szene(e.getAttribute("data-st-szene"), { titel: e.getAttribute("data-st-titel") || undefined, figuren: f, unterschrift: e.getAttribute("data-st-unterschrift") || undefined });
    });
  }

  L.spiel = {
    version: "1.0.0",
    figur, szene, sprecher, spielbrett, turnier, baum, szenario, akteure, mischer,
    strategien: STRATEGIEN, partie: (a, b, n, rausch, seed, werte) => partie(a, b, n, rausch || 0, rng(seed || 1), Object.assign({ T: 5, R: 3, P: 1, S: 0 }, werte || {})),
    analysiere,
    figurNamen: FIGUR_NAMEN,
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", automatisch); else automatisch();
})();
