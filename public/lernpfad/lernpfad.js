/* ==========================================================================
   Lernpfad-Baukasten · lernpfad.js
   Vanilla-JS ohne Abhängigkeiten. Stellt das globale Objekt window.Lernpfad bereit.
   Einbinden am Ende von <body>, danach das seiteneigene Script.
   Doku: docs/lernpfad-baukasten.md
   ========================================================================== */
(function () {
  "use strict";

  if (window.Lernpfad && window.Lernpfad.version) return; // doppelt eingebunden

  /* ---------- Grundlagen ---------- */

  // Basis-URL aus dem eigenen <script src> ableiten (Standard: /lernpfad/)
  const BASIS = (function () {
    const s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*(\?.*)?$/, "") : "/lernpfad/";
  })();

  let zaehler = 0;
  const neueId = (p) => "lp-" + p + "-" + ++zaehler;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function erzeugen(tag, klasse, html) {
    const e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (html !== undefined && html !== null) e.innerHTML = html;
    return e;
  }

  function knopf(html, klasse, attribute) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn" + (klasse ? " " + klasse : "");
    b.innerHTML = html;
    if (attribute) Object.keys(attribute).forEach((k) => b.setAttribute(k, attribute[k]));
    return b;
  }

  function ansageRegion() {
    const p = erzeugen("p", "sr-only");
    p.setAttribute("aria-live", "polite");
    return p;
  }

  // Element aus Selektor oder Knoten holen; Fehler gut sichtbar melden
  function elementHolen(el, name) {
    const e = typeof el === "string" ? document.querySelector(el) : el;
    if (!e) console.error("[Lernpfad] " + name + ": Element nicht gefunden (" + el + ").");
    return e;
  }

  // Knopf (de)aktivieren, ohne dass der Tastaturfokus verloren geht
  function setzeAktiv(btn, aktiv, ersatz) {
    if (!aktiv && document.activeElement === btn && ersatz) {
      const ziel = Array.isArray(ersatz) ? ersatz.find((x) => x && !x.disabled && !x.hidden) : ersatz;
      if (ziel) ziel.focus();
    }
    btn.disabled = !aktiv;
  }

  const ohneTags = (html) => {
    const d = document.createElement("div");
    d.innerHTML = html || "";
    return (d.textContent || "").replace(/\s+/g, " ").trim();
  };

  function kontext() {
    const b = document.body;
    return {
      fach: ((b && b.dataset.fach) || "").trim(),
      thema: ((b && b.dataset.thema) || "").trim(),
    };
  }

  /* ---------- Zahlen lesen und schreiben ---------- */

  // Liest «0,25», «0.25», «1'234.5», «1/4», «25%» (ohne Umrechnung), «−3», «1e-3»
  function zahlLesen(text) {
    if (typeof text === "number") return text;
    if (typeof text !== "string") return NaN;
    let t = text.trim().replace(/[\s'’\u00a0\u202f]/g, "").replace(/[−–]/g, "-");
    if (t.endsWith("%")) t = t.slice(0, -1);
    if (!t) return NaN;
    const bruch = t.match(/^([+-]?[0-9.,]+)\/([+-]?[0-9.,]+)$/);
    if (bruch) {
      const z = zahlLesen(bruch[1]);
      const n = zahlLesen(bruch[2]);
      return n === 0 ? NaN : z / n;
    }
    if (t.includes(",") && t.includes(".")) {
      // Der hintere Trenner ist der Dezimaltrenner
      t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    } else {
      t = t.replace(",", ".");
    }
    if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
    return Number(t);
  }

  // Zahl als Text: höchstens «stellen» Nachkommastellen, Dezimalpunkt, ab 10 000 mit Hochkomma
  function zahlText(wert, stellen) {
    if (!Number.isFinite(wert)) return "–";
    const s = stellen === undefined ? 4 : stellen;
    const gerundet = Number(wert.toFixed(s));
    let [ganz, rest] = Math.abs(gerundet).toFixed(s).split(".");
    rest = (rest || "").replace(/0+$/, "");
    if (ganz.length > 4) ganz = ganz.replace(/\B(?=(\d{3})+(?!\d))/g, "’");
    return (gerundet < 0 ? "−" : "") + ganz + (rest ? "." + rest : "");
  }

  /* ---------- Farbschema hell / dunkel / automatisch ---------- */

  const THEME_SCHLUESSEL = "lernpfad-theme";
  function speicherLesen(k) {
    try { return window.localStorage.getItem(k); } catch (e) { return null; }
  }
  function speicherSchreiben(k, v) {
    try { window.localStorage.setItem(k, v); } catch (e) { /* gesperrter Speicher: egal */ }
  }
  function themeAnwenden(wahl) {
    const root = document.documentElement;
    if (wahl === "hell") root.setAttribute("data-theme", "light");
    else if (wahl === "dunkel") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
  }
  let themeWahl = speicherLesen(THEME_SCHLUESSEL);
  if (["hell", "dunkel", "auto"].indexOf(themeWahl) < 0) themeWahl = "auto";
  themeAnwenden(themeWahl); // sofort, damit die Seite nicht flackert

  /* ---------- Fortschritt (API /api/lernfortschritt) ---------- */

  let bekannterStatus = null; // "begonnen" | "erledigt" | null

  const fortschritt = {
    laden() {
      const { fach } = kontext();
      if (!fach || typeof fetch !== "function") return Promise.resolve([]);
      return fetch("/api/lernfortschritt?fach=" + encodeURIComponent(fach), {
        credentials: "same-origin",
        cache: "no-store",
        headers: { Accept: "application/json" },
      })
        // Antwort immer lesen, auch bei 401: sonst bleibt die Anfrage im Browser offen
        .then((r) => r.json().catch(() => null).then((d) => (r.ok && Array.isArray(d) ? d : [])))
        .catch(() => []);
    },
    // Eintrag des aktuellen Themas oder null
    stand() {
      const { thema } = kontext();
      return fortschritt.laden().then((liste) => {
        const e = liste.find((x) => x && x.thema === thema) || null;
        if (e && e.status === "erledigt") bekannterStatus = "erledigt";
        return e;
      });
    },
    melden(daten) {
      return fortschrittSenden(daten).then((antwort) => antwort.ok);
    },
  };

  // Wie fortschritt.melden, liefert aber { ok, httpStatus }. httpStatus 0 = keine Anfrage
  // (kein Kontext, offline). Die Abschluss-Box braucht den Status, um bei 401 «Neu anmelden» zu zeigen.
  function fortschrittSenden(daten) {
    daten = daten || {};
    const { fach, thema } = kontext();
    if (!fach || !thema || typeof fetch !== "function") return Promise.resolve({ ok: false, httpStatus: 0 });
    let status = daten.status === "erledigt" ? "erledigt" : "begonnen";
    if (bekannterStatus === "erledigt") status = "erledigt"; // nie zurückstufen
    const nutzlast = { fach: fach, thema: thema, status: status };
    const r = daten.quizRichtig, g = daten.quizGesamt;
    if (Number.isInteger(r) && Number.isInteger(g) && g > 0 && r >= 0 && r <= g) {
      nutzlast.quizRichtig = r;
      nutzlast.quizGesamt = g;
    }
    return fetch("/api/lernfortschritt", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(nutzlast),
    })
      .then((res) => {
        if (res.ok) bekannterStatus = status === "erledigt" ? "erledigt" : bekannterStatus || "begonnen";
        // Antwort lesen, sonst bleibt die Anfrage im Browser offen (Verbindung, networkidle)
        return res.text().catch(() => "").then(() => ({ ok: res.ok, httpStatus: res.status }));
      })
      .catch(() => ({ ok: false, httpStatus: 0 }));
  }

  // Beim Laden einmal: Stand holen und «begonnen» melden (ausser schon erledigt).
  // Ergebnis: { eintrag, gespeichert } — gespeichert=false heisst: nicht eingeloggt, offline oder Vorschau ohne API.
  let startVersprechen = null;
  function fortschrittStarten() {
    if (startVersprechen) return startVersprechen;
    const { fach, thema } = kontext();
    if (!fach || !thema) {
      startVersprechen = Promise.resolve({ eintrag: null, gespeichert: false });
      return startVersprechen;
    }
    startVersprechen = fortschritt
      .stand()
      .then((eintrag) => {
        if (eintrag && eintrag.status === "erledigt") return { eintrag: eintrag, gespeichert: true };
        return fortschritt.melden({ status: "begonnen" }).then((ok) => ({ eintrag: eintrag, gespeichert: ok }));
      })
      .catch(() => ({ eintrag: null, gespeichert: false }));
    return startVersprechen;
  }

  /* ---------- Verknüpfungen (data-link) ---------- */

  const gebunden = new WeakSet();
  const cssWert = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, "\\$&"));
  function bereichVon(el) {
    return el.closest("[data-link-bereich]") || el.closest("section") || document.body;
  }
  function partnerVon(el) {
    return $$('[data-link="' + cssWert(el.getAttribute("data-link")) + '"]', bereichVon(el));
  }
  function linkAus(bereich) {
    $$(".lit", bereich).forEach((e) => e.classList.remove("lit"));
  }
  function linkAn(el) {
    linkAus(bereichVon(el));
    partnerVon(el).forEach((e) => e.classList.add("lit"));
  }

  function verknuepfen(root) {
    root = root || document.body;
    if (!root || !root.querySelectorAll) return;
    const liste = $$("[data-link]", root);
    if (root.matches && root.matches("[data-link]")) liste.unshift(root);
    liste.forEach((el) => {
      if (!gebunden.has(el)) {
        gebunden.add(el);
        el.addEventListener("mouseenter", () => linkAn(el));
        el.addEventListener("mouseleave", () => linkAus(bereichVon(el)));
        el.addEventListener("focus", () => linkAn(el));
        el.addEventListener("blur", () => linkAus(bereichVon(el)));
        el.addEventListener("click", () => linkAn(el));
      }
      // Tabindex nur, wenn es tatsächlich ein Gegenstück gibt und Screenreader das Element sehen.
      // KaTeX legt \htmlData{link=…} in .katex-html mit aria-hidden="true" ab: ein Tabstopp dort
      // wäre stumm. Hover und Antippen bleiben, per Tastatur leuchtet das Gegenstück im Text auf.
      if (!el.matches("a[href],button,input,select,textarea")) {
        if (partnerVon(el).length > 1 && !el.closest('[aria-hidden="true"]')) el.tabIndex = 0;
        else el.removeAttribute("tabindex");
      }
    });
  }

  /* ---------- Formeln (KaTeX, bei Bedarf nachgeladen) ---------- */

  const makros = {
    "\\N": "\\mathbb{N}",
    "\\Z": "\\mathbb{Z}",
    "\\Q": "\\mathbb{Q}",
    "\\R": "\\mathbb{R}",
    "\\E": "\\operatorname{E}",
    "\\Var": "\\operatorname{Var}",
    "\\Cov": "\\operatorname{Cov}",
  };

  const KATEX_OPTIONEN = {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
      { left: "$", right: "$", display: false },
    ],
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option", "select"],
    ignoredClasses: ["keine-formel", "katex"],
    throwOnError: false,
    errorColor: "var(--bad)",
    // \htmlClass{v}{x} und \htmlData{link=…}{x} für Farbcode und Verknüpfungen
    trust: (k) => k.command === "\\htmlClass" || k.command === "\\htmlData",
    strict: (code) => (code === "htmlExtension" || code === "unicodeTextInMathMode" ? "ignore" : "warn"),
    macros: makros,
  };

  const FORMEL_MUSTER = /\$|\\\(|\\\[/;
  const OHNE_FORMEL = "script,style,noscript,textarea,pre,code,option,select,.katex,.keine-formel";
  let katexVersprechen = null;

  // Enthält der Bereich Formeltext? Scripts und bereits gesetzte Formeln zählen nicht.
  function hatFormel(root) {
    if (!FORMEL_MUSTER.test(root.textContent || "")) return false;
    const gaenger = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (gaenger.nextNode()) {
      const n = gaenger.currentNode;
      if (FORMEL_MUSTER.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest(OHNE_FORMEL))) return true;
    }
    return false;
  }

  function dateiLaden(tag, url) {
    return new Promise((ok, fehler) => {
      const e = document.createElement(tag);
      if (tag === "link") {
        e.rel = "stylesheet";
        e.href = url;
      } else {
        e.src = url;
        e.async = false;
      }
      e.onload = () => ok();
      e.onerror = () => fehler(new Error("Laden fehlgeschlagen: " + url));
      document.head.appendChild(e);
    });
  }

  function katexLaden() {
    if (window.katex && window.renderMathInElement) return Promise.resolve(true);
    if (katexVersprechen) return katexVersprechen;
    const css = dateiLaden("link", BASIS + "katex/katex.min.css").catch(() => null);
    const js = (window.katex ? Promise.resolve() : dateiLaden("script", BASIS + "katex/katex.min.js")).then(() =>
      window.renderMathInElement ? null : dateiLaden("script", BASIS + "katex/contrib/auto-render.min.js")
    );
    katexVersprechen = Promise.all([css, js])
      .then(() => !!window.renderMathInElement)
      .catch((e) => {
        console.warn("[Lernpfad] KaTeX nicht verfügbar:", e.message);
        return false;
      });
    return katexVersprechen;
  }

  // Zu breite Inline-Formeln scrollen in sich, statt die Seite zu verbreitern (wichtig ab 320 px).
  // In Tafeln, Filmformeln, Tabellen und Rechner-Ergebnissen scrollt schon der Behälter.
  const SCROLLT_SCHON = ".katex-display, .board, .fstage, .tablebox, .rechner-ergebnis";
  function blockVon(e) {
    let p = e.parentElement;
    while (p && p !== document.body && getComputedStyle(p).display.indexOf("inline") === 0) p = p.parentElement;
    return p;
  }
  function breiteFormelnPruefen(root) {
    root = root || document.body;
    if (!root || !root.querySelectorAll) return;
    const liste = $$(".katex", root).filter((k) => !k.closest(SCROLLT_SCHON));
    if (!liste.length) return;
    liste.forEach((k) => k.classList.remove("katex-breit")); // erst alles schreiben …
    const breit = liste.filter((k) => {                         // … dann messen
      const block = blockVon(k);
      if (!block) return false;
      const br = block.getBoundingClientRect();
      if (!br.width) return false; // unsichtbar (zugeklappt, hidden)
      const stil = getComputedStyle(block);
      const rechts = br.right - (parseFloat(stil.paddingRight) || 0) - (parseFloat(stil.borderRightWidth) || 0);
      return $$(".base", k).some((b) => b.getBoundingClientRect().right > rechts + 1);
    });
    breit.forEach((k) => k.classList.add("katex-breit"));
  }

  function formeln(root) {
    root = root || document.body;
    if (!root) return Promise.resolve(false);
    if (!hatFormel(root)) {
      verknuepfen(root);
      breiteFormelnPruefen(root);
      return Promise.resolve(false);
    }
    return katexLaden().then((ok) => {
      if (ok) {
        try {
          window.renderMathInElement(root, KATEX_OPTIONEN);
        } catch (e) {
          console.error("[Lernpfad] Formel konnte nicht gesetzt werden:", e);
        }
      }
      verknuepfen(root);
      breiteFormelnPruefen(root);
      return ok;
    });
  }

  // Breite neu prüfen: nach dem Laden der Schriften, beim Aufklappen, bei Grössenänderung
  function breiteBeobachten() {
    let geplant = null;
    window.addEventListener("resize", () => {
      clearTimeout(geplant);
      geplant = setTimeout(() => breiteFormelnPruefen(document.body), 150);
    });
    document.addEventListener("toggle", (e) => {
      if (e.target && e.target.open) breiteFormelnPruefen(e.target);
    }, true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => breiteFormelnPruefen(document.body));
  }

  /* ---------- Baustein: Sortierer ---------- */

  function sortierer(el, cfg) {
    el = elementHolen(el, "sortierer");
    if (!el) return null;
    cfg = cfg || {};
    const kategorien = (cfg.kategorien || []).map(String);
    const elemente = cfg.elemente || [];
    if (!kategorien.length || !elemente.length) {
      console.error("[Lernpfad] sortierer: «kategorien» und «elemente» sind Pflicht.");
      return null;
    }
    const sollIndex = (k) => (typeof k === "number" ? k : kategorien.indexOf(String(k)));

    el.innerHTML = "";
    el.classList.add("stack", "sortierer");
    if (cfg.frage) el.appendChild(erzeugen("h3", null, cfg.frage));
    const gitter = erzeugen("div", "sort");
    const fb = erzeugen("p", "fb");
    fb.setAttribute("aria-live", "polite");
    const stand = erzeugen("p", "sort-stand");
    el.append(gitter, fb, stand);
    const ergebnis = new Array(elemente.length).fill(null);

    function standZeigen() {
      const beantwortet = ergebnis.filter((x) => x !== null).length;
      const richtig = ergebnis.filter((x) => x === true).length;
      stand.textContent = beantwortet
        ? "Richtig zugeordnet: " + richtig + " von " + elemente.length + (richtig === elemente.length ? " · alles richtig" : "")
        : "";
    }

    elemente.forEach((it, i) => {
      const soll = sollIndex(it.kategorie);
      if (soll < 0 || soll >= kategorien.length) {
        console.error("[Lernpfad] sortierer: Kategorie «" + it.kategorie + "» bei Element " + (i + 1) + " unbekannt.");
      }
      const karte = erzeugen("div", "sort-item");
      const inhalt = erzeugen("span", "sort-inhalt");
      inhalt.id = neueId("sort");
      const marke = erzeugen("span", "marke");
      marke.setAttribute("aria-hidden", "true");
      const text = erzeugen("span", null, it.html);
      inhalt.append(marke, text);
      const reihe = erzeugen("span", "row");
      kategorien.forEach((k, j) => {
        const b = knopf("", "", { "aria-pressed": "false", "aria-describedby": inhalt.id });
        b.textContent = k;
        b.addEventListener("click", () => {
          const ok = j === soll;
          ergebnis[i] = ok;
          karte.classList.toggle("right", ok);
          karte.classList.toggle("wrong", !ok);
          marke.textContent = ok ? "✓ " : "✗ ";
          $$("button", reihe).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          fb.innerHTML = (ok ? "✓ Richtig. " : "✗ Nicht ganz. ") + (it.erklaerung || "");
          standZeigen();
          formeln(fb);
        });
        reihe.appendChild(b);
      });
      karte.append(inhalt, reihe);
      gitter.appendChild(karte);
    });
    formeln(el);

    return {
      zuruecksetzen() {
        ergebnis.fill(null);
        $$(".sort-item", gitter).forEach((k) => {
          k.classList.remove("right", "wrong");
          $(".marke", k).textContent = "";
          $$("button", k).forEach((b) => b.setAttribute("aria-pressed", "false"));
        });
        fb.textContent = "";
        standZeigen();
      },
    };
  }

  /* ---------- Baustein: Stepper (Satz ↔ Formel) ---------- */

  function stepper(el, cfg) {
    el = elementHolen(el, "stepper");
    if (!el) return null;
    cfg = cfg || {};
    const schritte = cfg.schritte || [];
    if (!schritte.length) {
      console.error("[Lernpfad] stepper: «schritte» fehlt.");
      return null;
    }
    el.innerHTML = "";
    el.classList.add("card", "stack", "stepper");
    el.setAttribute("data-link-bereich", "");
    const leiste = erzeugen("div", "stepbar");
    const titel = erzeugen("h3", null, cfg.titel || "");
    const zahl = erzeugen("span", "stepcount");
    leiste.append(titel, zahl);
    el.appendChild(leiste);
    if (cfg.text) el.appendChild(erzeugen("p", "sentence", cfg.text));
    const tafel = erzeugen("div", "board");
    const formel = erzeugen("div", "m formula");
    tafel.appendChild(formel);
    const warum = erzeugen("p", "explain");
    warum.setAttribute("aria-live", "polite");
    const reihe = erzeugen("div", "row");
    const bZurueck = knopf("Zurück");
    const bWeiter = knopf("Weiter", "primary");
    const bAlles = knopf("Ganze Lösung");
    reihe.append(bZurueck, bWeiter, bAlles);
    el.append(tafel, warum, reihe);

    let k = 0;
    function zeigen() {
      const s = schritte[k];
      formel.innerHTML = s.html || "";
      warum.innerHTML = s.warum || "";
      zahl.textContent = "Schritt " + (k + 1) + " von " + schritte.length;
      setzeAktiv(bZurueck, k > 0, [bWeiter, bAlles]);
      setzeAktiv(bWeiter, k < schritte.length - 1, [bZurueck, bAlles]);
      formeln(el);
    }
    bZurueck.addEventListener("click", () => { k = Math.max(0, k - 1); zeigen(); });
    bWeiter.addEventListener("click", () => { k = Math.min(schritte.length - 1, k + 1); zeigen(); });
    bAlles.addEventListener("click", () => { k = schritte.length - 1; zeigen(); });
    zeigen();
    return { gehe(n) { k = Math.max(0, Math.min(schritte.length - 1, n | 0)); zeigen(); } };
  }

  /* ---------- Baustein: Lösungsfilm ---------- */

  function film(el, cfg) {
    el = elementHolen(el, "film");
    if (!el) return null;
    cfg = cfg || {};
    const phasen = cfg.phasen || [];
    const texte = cfg.texte || [];
    const woerterbuch = cfg.woerterbuch || [];
    const beschr = Object.assign(
      { texte: "Die Sätze", text: "Satz", woerterbuch: "Wörterbuch", formel: "Formel", ende: "Weiter zum Selbsttest" },
      cfg.beschriftung || {}
    );
    const ziel = cfg.selbsttest === undefined ? "#test" : cfg.selbsttest;

    // Szenen kopieren; fehlende Werte erben vom Vorgänger (wie im Vorbild)
    let vorher = { ph: -1, sent: "all", dict: 0, f: "" };
    const S = (cfg.szenen || []).map((roh) => {
      const s = Object.assign({}, roh);
      ["ph", "sent", "dict", "f"].forEach((k) => { if (s[k] === undefined) s[k] = vorher[k]; });
      s.hl = s.hl || [];
      s.dh = s.dh || [];
      s.say = s.say || "";
      vorher = s;
      return s;
    });
    if (!S.length) {
      console.error("[Lernpfad] film: «szenen» fehlt.");
      return null;
    }

    el.innerHTML = "";
    el.classList.add("film");
    const oben = erzeugen("div", "film-top");
    phasen.forEach((t) => oben.appendChild(erzeugen("span", "phase", t)));
    if (!phasen.length) oben.hidden = true;

    const buehne = erzeugen("div", "stage");
    const boxTexte = erzeugen("div", "film-texte");
    const lblTexte = erzeugen("div", "slabel");
    const saetze = erzeugen("div", "sents");
    boxTexte.append(lblTexte, saetze);
    const boxWb = erzeugen("div", "film-wb");
    const dict = erzeugen("div", "dict");
    boxWb.append(erzeugen("div", "slabel", beschr.woerterbuch), dict);
    const boxF = erzeugen("div", "film-f");
    const fstage = erzeugen("div", "fstage");
    const fm = erzeugen("div", "m film-formel");
    fstage.appendChild(fm);
    boxF.append(erzeugen("div", "slabel", beschr.formel), fstage);
    const say = erzeugen("p", "say");
    say.setAttribute("aria-live", "polite");
    const ende = erzeugen("div", "film-ende");
    ende.hidden = true;
    if (ziel) {
      const a = erzeugen("a", "btn primary");
      a.href = ziel;
      a.textContent = beschr.ende;
      ende.appendChild(a);
    }
    buehne.append(boxTexte, boxWb, boxF, say, ende);
    if (!texte.length) boxTexte.hidden = true;
    if (!woerterbuch.length) boxWb.hidden = true;

    const tbar = erzeugen("div", "tbar");
    tbar.setAttribute("aria-hidden", "true");
    const balken = document.createElement("i");
    tbar.appendChild(balken);

    const ctl = erzeugen("div", "film-ctl");
    const bZur = knopf('<span aria-hidden="true">◀</span>', "", { "aria-label": "Schritt zurück" });
    const bPlay = knopf("", "primary film-play");
    const bVor = knopf('<span aria-hidden="true">▶▶</span>', "", { "aria-label": "Schritt vor" });
    const prog = erzeugen("div", "prog");
    const regler = document.createElement("input");
    regler.type = "range";
    regler.min = "0";
    regler.max = String(S.length - 1);
    regler.value = "0";
    regler.setAttribute("aria-label", "Fortschritt im Film");
    const zahl = erzeugen("span");
    prog.append(regler, zahl);
    const tempo = document.createElement("select");
    tempo.className = "btn";
    tempo.setAttribute("aria-label", "Tempo");
    tempo.innerHTML = '<option value="0.7">langsam</option><option value="1" selected>normal</option><option value="1.5">schnell</option>';
    ctl.append(bZur, bPlay, bVor, prog, tempo);
    el.append(oben, buehne, tbar, ctl);

    let i = 0, spielt = false, timer = null, prevDict = 0;

    function zielVorhanden() {
      if (!ziel) return false;
      if (ziel.charAt(0) !== "#") return true;
      try { return !!document.querySelector(ziel); } catch (e) { return false; }
    }

    function zeigen() {
      const s = S[i];
      $$(".phase", oben).forEach((p, k) => {
        p.classList.toggle("cur", k === s.ph);
        p.classList.toggle("past", k < s.ph);
      });
      if (texte.length) {
        if (s.sent === null) boxTexte.hidden = true;
        else {
          boxTexte.hidden = false;
          const alle = s.sent === "all";
          const liste = alle ? texte : [texte[s.sent]].filter((t) => t !== undefined);
          saetze.className = "sents" + (alle ? "" : " single");
          lblTexte.innerHTML = alle ? beschr.texte : beschr.text + " " + (s.sent + 1);
          saetze.innerHTML = liste.map((t) => "<p>" + t + "</p>").join("");
          $$("[data-ph]", saetze).forEach((e) => e.classList.toggle("ph-on", s.hl.indexOf(e.dataset.ph) >= 0));
        }
      }
      if (woerterbuch.length) {
        if (!s.dict) dict.innerHTML = '<span class="dict-empty">noch leer</span>';
        else
          dict.innerHTML = woerterbuch
            .slice(0, s.dict)
            .map((t, k) => '<span class="chip' + (k >= prevDict ? " new" : "") + (s.dh.indexOf(k) >= 0 ? " use" : "") + '">' + t + "</span>")
            .join("");
      }
      prevDict = s.dict;
      fm.innerHTML = s.f || '<span class="platzhalter">wird gleich aufgebaut</span>';
      say.innerHTML = s.say;
      const zeigeEnde = s.end || (i === S.length - 1 && !S.some((x) => x.end));
      ende.hidden = !(zeigeEnde && zielVorhanden());
      regler.value = String(i);
      zahl.textContent = i + 1 + " / " + S.length;
      setzeAktiv(bZur, i > 0, bPlay);
      setzeAktiv(bVor, i < S.length - 1, bPlay);
      formeln(buehne);
    }

    const tempoWert = () => parseFloat(tempo.value) || 1;
    const dauer = (s) => Math.max(3500, ohneTags(s.say).length * 45) / tempoWert();

    function balkenSetzen(ms) {
      balken.classList.remove("run");
      void balken.offsetWidth; // Animation neu starten
      balken.style.width = "";
      if (ms) {
        balken.style.animationDuration = ms + "ms";
        balken.classList.add("run");
      }
    }
    function planen() {
      clearTimeout(timer);
      if (!spielt) { balkenSetzen(0); return; }
      const d = dauer(S[i]);
      balkenSetzen(d);
      timer = setTimeout(() => {
        if (i < S.length - 1) { i++; zeigen(); planen(); }
        else setzeSpielt(false);
      }, d);
    }
    function setzeSpielt(p) {
      spielt = p;
      bPlay.innerHTML = p
        ? '<span aria-hidden="true">❚❚</span> Pause'
        : i === S.length - 1
          ? '<span aria-hidden="true">↺</span> Nochmals'
          : '<span aria-hidden="true">▶</span> Abspielen';
      planen();
    }

    bPlay.addEventListener("click", () => {
      if (spielt) { setzeSpielt(false); return; }
      if (i === S.length - 1) { i = 0; prevDict = 0; }
      else if (i === 0) { i = 1; } // Abspielen startet sofort beim ersten Inhaltsschritt
      zeigen();
      setzeSpielt(true);
    });
    bZur.addEventListener("click", () => {
      if (i > 0) { i--; prevDict = S[i].dict; zeigen(); setzeSpielt(spielt); }
    });
    bVor.addEventListener("click", () => {
      if (i < S.length - 1) { i++; zeigen(); setzeSpielt(spielt); }
    });
    regler.addEventListener("input", () => {
      i = +regler.value;
      prevDict = S[i].dict;
      zeigen();
      setzeSpielt(spielt);
    });
    tempo.addEventListener("change", () => planen());

    zeigen();
    setzeSpielt(false);

    return {
      abspielen() { if (!spielt) bPlay.click(); },
      pause() { setzeSpielt(false); },
      gehe(n) { i = Math.max(0, Math.min(S.length - 1, n | 0)); prevDict = S[i].dict; zeigen(); setzeSpielt(spielt); },
    };
  }

  /* ---------- Antwort-Optionen markieren (Selbsttest, Einzelfrage) ---------- */

  function optionMarkieren(b, ok, gewaehlt) {
    b.classList.add(ok ? "right" : "wrong");
    b.insertAdjacentHTML("afterbegin", '<span class="marke" aria-hidden="true">' + (ok ? "✓" : "✗") + " </span>");
    const zusatz = ok ? (gewaehlt ? "deine Antwort, richtig" : "richtige Antwort") : "deine Antwort, falsch";
    b.insertAdjacentHTML("beforeend", '<span class="sr-only"> (' + zusatz + ")</span>");
  }

  /* ---------- Baustein: Selbsttest ---------- */

  function selbsttest(el, cfg) {
    el = elementHolen(el, "selbsttest");
    if (!el) return null;
    cfg = cfg || {};
    const fragen = cfg.fragen || [];
    if (!fragen.length) {
      console.error("[Lernpfad] selbsttest: «fragen» fehlt.");
      return null;
    }
    fragen.forEach((f, i) => {
      if (!Array.isArray(f.o) || typeof f.a !== "number" || f.a < 0 || f.a >= f.o.length) {
        console.error("[Lernpfad] selbsttest: Frage " + (i + 1) + " hat ungültige «o» oder «a».");
      }
    });

    el.innerHTML = "";
    el.classList.add("stack", "selbsttest");
    const kopf = erzeugen("div", "row");
    const score = erzeugen("span", "score");
    const bNeu = knopf("Neu starten");
    kopf.append(score, bNeu);
    const liste = erzeugen("div", "stack");
    const ansage = ansageRegion();
    el.append(kopf, liste, ansage);

    let richtig = 0, fertig = 0;

    function scoreText() {
      let t = richtig + " / " + fragen.length;
      if (fertig === fragen.length) {
        t += richtig === fragen.length ? " · alles richtig" : " · schau dir die markierten nochmals an";
      }
      return t;
    }

    function aufbauen() {
      richtig = 0;
      fertig = 0;
      score.textContent = scoreText();
      liste.innerHTML = "";
      ansage.textContent = "";
      fragen.forEach((it, i) => {
        const karte = erzeugen("div", "qcard");
        const h = erzeugen("h3", null, i + 1 + ". " + it.q);
        h.id = neueId("frage");
        const ops = erzeugen("div", "qopts");
        ops.setAttribute("role", "group");
        ops.setAttribute("aria-labelledby", h.id);
        const ex = erzeugen("p", "qex");
        ex.hidden = true;
        (it.o || []).forEach((o, j) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "qopt";
          b.innerHTML = o;
          b.addEventListener("click", () => {
            if (karte.dataset.done) return;
            karte.dataset.done = "1";
            fertig++;
            const ok = j === it.a;
            if (ok) { richtig++; optionMarkieren(b, true, true); }
            else {
              optionMarkieren(b, false, true);
              if (ops.children[it.a]) optionMarkieren(ops.children[it.a], true, false);
            }
            $$(".qopt", ops).forEach((x) => x.setAttribute("aria-disabled", "true"));
            ex.hidden = false;
            ex.innerHTML = (ok ? "✓ Richtig. " : "✗ Nicht ganz. ") + (it.e || "");
            score.textContent = scoreText();
            ansage.textContent = "Frage " + (i + 1) + ": " + (ok ? "richtig. " : "nicht ganz. ") + "Stand " + richtig + " von " + fragen.length + ".";
            formeln(karte);
            if (fertig === fragen.length) {
              const ergebnis = { richtig: richtig, gesamt: fragen.length };
              // Ereignis erst nach dem Speichern: detail.gespeichert sagt der Abschluss-Box, ob es geklappt hat
              fortschrittSenden({ status: "begonnen", quizRichtig: ergebnis.richtig, quizGesamt: ergebnis.gesamt })
                .then((antwort) => {
                  el.dispatchEvent(new CustomEvent("lernpfad:selbsttest", {
                    bubbles: true,
                    detail: {
                      richtig: ergebnis.richtig,
                      gesamt: ergebnis.gesamt,
                      gespeichert: antwort.ok,
                      httpStatus: antwort.httpStatus,
                    },
                  }));
                });
            }
          });
          ops.appendChild(b);
        });
        karte.append(h, ops, ex);
        liste.appendChild(karte);
      });
      formeln(liste);
    }
    bNeu.addEventListener("click", aufbauen);
    aufbauen();
    return { neuStarten: aufbauen };
  }

  /* ---------- Baustein: Zahleneingabe ---------- */

  function vergleichen(x, soll, toleranz) {
    let grenze;
    if (toleranz && typeof toleranz === "object") {
      if (typeof toleranz.relativ === "number") grenze = Math.abs(soll) * toleranz.relativ;
      else if (typeof toleranz.absolut === "number") grenze = toleranz.absolut;
    } else if (typeof toleranz === "number") grenze = Math.abs(toleranz);
    if (grenze === undefined) grenze = 1e-9 * Math.max(1, Math.abs(soll));
    const abw = Math.abs(x - soll);
    const eps = 1e-12 * Math.max(1, Math.abs(soll));
    return { ok: abw <= grenze + eps, knapp: abw <= Math.max(grenze * 10, Math.abs(soll) * 0.01) + eps };
  }

  function zahlAufgabe(el, cfg) {
    el = elementHolen(el, "zahlAufgabe");
    if (!el) return null;
    cfg = cfg || {};
    const sollListe = (Array.isArray(cfg.antwort) ? cfg.antwort : [cfg.antwort]).filter((x) => typeof x === "number" && Number.isFinite(x));
    if (!sollListe.length) {
      console.error("[Lernpfad] zahlAufgabe: «antwort» muss eine Zahl sein.");
      return null;
    }
    const hinweise = cfg.hinweise || [];
    const weg = cfg.loesungsweg || [];
    const id = neueId("za");
    const einheit = cfg.einheit ? " " + cfg.einheit : "";

    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "zahl-aufgabe");
    el.innerHTML =
      '<div class="uebung-kopf"><span class="eyebrow">Übung · Rechnen</span>' + (cfg.titel ? "<h3>" + cfg.titel + "</h3>" : "") + "</div>" +
      (cfg.frage ? '<div class="za-frage">' + cfg.frage + "</div>" : "") +
      '<form class="za-form row" novalidate>' +
      '<label for="' + id + '">Deine Antwort</label>' +
      '<input id="' + id + '" class="zahl-feld" type="text" inputmode="' + (sollListe[0] < 0 ? "text" : "decimal") +
      '" autocomplete="off" spellcheck="false" aria-describedby="' + id + '-fb">' +
      (cfg.einheit ? '<span class="einheit">' + cfg.einheit + "</span>" : "") +
      '<button type="submit" class="btn primary">Prüfen</button></form>' +
      '<p class="rueckmeldung" id="' + id + '-fb" aria-live="polite"></p>' +
      '<div class="row za-hilfen"></div>' +
      '<ul class="tipps" aria-label="Tipps"></ul>' +
      '<ol class="loesungsweg" aria-label="Lösungsweg" tabindex="-1"></ol>';

    const form = $(".za-form", el);
    const feld = $(".zahl-feld", el);
    const rm = $(".rueckmeldung", el);
    const hilfen = $(".za-hilfen", el);
    const tipps = $(".tipps", el);
    const wegListe = $(".loesungsweg", el);
    const ansage = ansageRegion();
    el.appendChild(ansage);

    const bTipp = knopf("");
    const bWeg = knopf("Lösungsweg: nächster Schritt");
    const bAlles = knopf("Ganzer Lösungsweg");
    if (hinweise.length) hilfen.appendChild(bTipp);
    if (weg.length) hilfen.append(bWeg, bAlles);
    if (!hinweise.length && !weg.length) hilfen.hidden = true;

    let tippsGezeigt = 0, schritteGezeigt = 0;

    function rueckmeldung(art, html) {
      rm.className = "rueckmeldung " + art;
      rm.innerHTML = html;
      formeln(rm);
    }
    function tippKnopf() {
      bTipp.textContent = tippsGezeigt < hinweise.length
        ? "Tipp anzeigen (" + tippsGezeigt + " / " + hinweise.length + ")"
        : "Alle Tipps gezeigt";
      setzeAktiv(bTipp, tippsGezeigt < hinweise.length, [bWeg, feld]);
    }
    function wegKnoepfe() {
      const offen = schritteGezeigt < weg.length;
      if (!offen && (document.activeElement === bWeg || document.activeElement === bAlles)) wegListe.focus();
      bWeg.disabled = !offen;
      bAlles.disabled = !offen;
    }
    function schrittZeigen() {
      const li = erzeugen("li", null, weg[schritteGezeigt]);
      wegListe.appendChild(li);
      schritteGezeigt++;
      formeln(li);
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const x = zahlLesen(feld.value);
      feld.classList.remove("richtig");
      if (!Number.isFinite(x)) {
        feld.setAttribute("aria-invalid", "true");
        rueckmeldung("leer", "Gib eine Zahl ein. Komma oder Punkt sind beide erlaubt, Brüche wie 1/4 und Prozent wie 25% auch.");
        return;
      }
      // «25%» passt sowohl zu 25 als auch zu 0.25
      const kandidaten = /%\s*$/.test(feld.value) ? [x, x / 100] : [x];
      const tests = [];
      sollListe.forEach((soll) => kandidaten.forEach((k) => tests.push(vergleichen(k, soll, cfg.toleranz))));
      if (tests.some((t) => t.ok)) {
        feld.removeAttribute("aria-invalid");
        feld.classList.add("richtig");
        const genau = cfg.anzeige || zahlText(sollListe[0], 6) + einheit;
        rueckmeldung("ok", "✓ Richtig. Genauer Wert: " + genau);
        return;
      }
      feld.setAttribute("aria-invalid", "true");
      const faktor100 = sollListe.some((soll) => vergleichen(x / 100, soll, cfg.toleranz).ok || vergleichen(x * 100, soll, cfg.toleranz).ok);
      if (faktor100) rueckmeldung("bad", "✗ Die Ziffern stimmen, der Faktor 100 nicht. Prozent oder Dezimalzahl?");
      else if (tests.some((t) => t.knapp)) rueckmeldung("bad", "✗ Knapp daneben. Prüfe die Rundung und die Zwischenresultate.");
      else {
        const rat = tippsGezeigt < hinweise.length ? " Hol dir einen Tipp." : weg.length ? " Schau dir den Lösungsweg an." : "";
        rueckmeldung("bad", "✗ Das stimmt noch nicht." + rat);
      }
    });
    feld.addEventListener("input", () => {
      if (feld.getAttribute("aria-invalid")) feld.removeAttribute("aria-invalid");
    });
    bTipp.addEventListener("click", () => {
      if (tippsGezeigt >= hinweise.length) return;
      const li = erzeugen("li", null, hinweise[tippsGezeigt]);
      tipps.appendChild(li);
      tippsGezeigt++;
      formeln(li);
      ansage.textContent = "Tipp " + tippsGezeigt + " von " + hinweise.length + " angezeigt.";
      tippKnopf();
    });
    bWeg.addEventListener("click", () => {
      if (schritteGezeigt >= weg.length) return;
      schrittZeigen();
      ansage.textContent = "Schritt " + schritteGezeigt + " von " + weg.length + " des Lösungswegs aufgedeckt.";
      wegKnoepfe();
    });
    bAlles.addEventListener("click", () => {
      while (schritteGezeigt < weg.length) schrittZeigen();
      ansage.textContent = "Ganzer Lösungsweg aufgedeckt.";
      wegKnoepfe();
    });
    tippKnopf();
    formeln(el);

    return {
      zuruecksetzen() {
        feld.value = "";
        feld.removeAttribute("aria-invalid");
        feld.classList.remove("richtig");
        rm.className = "rueckmeldung";
        rm.textContent = "";
        tipps.innerHTML = "";
        wegListe.innerHTML = "";
        tippsGezeigt = 0;
        schritteGezeigt = 0;
        tippKnopf();
        wegKnoepfe();
      },
    };
  }

  /* ---------- Baustein: Wahr oder falsch ---------- */

  function wahrFalsch(el, cfg) {
    el = elementHolen(el, "wahrFalsch");
    if (!el) return null;
    cfg = cfg || {};
    const aussagen = cfg.aussagen || [];
    if (!aussagen.length) {
      console.error("[Lernpfad] wahrFalsch: «aussagen» fehlt.");
      return null;
    }
    const id = neueId("wf");
    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "wahr-falsch");
    el.innerHTML =
      '<div class="uebung-kopf"><span class="eyebrow">Übung · Wahr oder falsch</span>' + (cfg.titel ? "<h3>" + cfg.titel + "</h3>" : "") + "</div>" +
      '<p class="hint">Setz bei jeder Aussage ein Kreuz, wie in der Prüfung. Dann «Auswerten».</p>';
    const tab = erzeugen("div", "wf");
    tab.innerHTML = '<div class="wf-kopf" aria-hidden="true"><span>Aussage</span><span>wahr</span><span>falsch</span></div>';
    const zeilen = aussagen.map((a, i) => {
      const z = erzeugen("div", "wf-zeile");
      const aid = id + "-a" + i;
      z.setAttribute("role", "radiogroup");
      z.setAttribute("aria-labelledby", aid);
      z.innerHTML =
        '<div class="wf-aussage" id="' + aid + '">' + a.html + "</div>" +
        '<label class="wf-wahl"><input type="radio" name="' + id + "-r" + i + '" value="w"><span class="kreuz" aria-hidden="true"></span><span class="sr-only">wahr</span></label>' +
        '<label class="wf-wahl"><input type="radio" name="' + id + "-r" + i + '" value="f"><span class="kreuz" aria-hidden="true"></span><span class="sr-only">falsch</span></label>' +
        '<p class="wf-erkl" hidden></p>';
      // Antwort geändert: alte Auswertung dieser Zeile entfernen
      $$("input", z).forEach((inp) => inp.addEventListener("change", () => {
        z.classList.remove("right", "wrong");
        $(".wf-erkl", z).hidden = true;
      }));
      tab.appendChild(z);
      return z;
    });
    const reihe = erzeugen("div", "row");
    const bAus = knopf("Auswerten", "primary");
    const bReset = knopf("Zurücksetzen");
    reihe.append(bAus, bReset);
    const fb = erzeugen("p", "fb");
    fb.setAttribute("aria-live", "polite");
    el.append(tab, reihe, fb);

    bAus.addEventListener("click", () => {
      let richtig = 0, offen = 0;
      aussagen.forEach((a, i) => {
        const z = zeilen[i];
        const wahl = $("input:checked", z);
        const erkl = $(".wf-erkl", z);
        const soll = a.wahr ? "wahr" : "falsch";
        let text;
        z.classList.remove("right", "wrong");
        if (!wahl) {
          offen++;
          text = '<span class="marke" aria-hidden="true">–</span>Nicht angekreuzt. Die Aussage ist ' + soll + ".";
        } else if ((wahl.value === "w") === !!a.wahr) {
          richtig++;
          z.classList.add("right");
          text = '<span class="marke" aria-hidden="true">✓</span>Richtig: Die Aussage ist ' + soll + ".";
        } else {
          z.classList.add("wrong");
          text = '<span class="marke" aria-hidden="true">✗</span>Nicht richtig: Die Aussage ist ' + soll + ".";
        }
        erkl.innerHTML = text + (a.erklaerung ? " " + a.erklaerung : "");
        erkl.hidden = false;
      });
      fb.textContent = richtig + " von " + aussagen.length + " richtig" + (offen ? ", " + offen + " nicht angekreuzt." : ".");
      formeln(tab);
    });
    bReset.addEventListener("click", () => {
      zeilen.forEach((z) => {
        z.classList.remove("right", "wrong");
        $$("input", z).forEach((inp) => { inp.checked = false; });
        $(".wf-erkl", z).hidden = true;
      });
      fb.textContent = "";
    });
    formeln(el);
    return { auswerten: () => bAus.click(), zuruecksetzen: () => bReset.click() };
  }

  /* ---------- Baustein: Schritt-Aufgabe ---------- */

  function schrittAufgabe(el, cfg) {
    el = elementHolen(el, "schrittAufgabe");
    if (!el) return null;
    cfg = cfg || {};
    const schritte = cfg.schritte || [];
    if (!schritte.length) {
      console.error("[Lernpfad] schrittAufgabe: «schritte» fehlt.");
      return null;
    }
    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "schritt-aufgabe");
    el.innerHTML =
      '<div class="uebung-kopf"><span class="eyebrow">Übung · Schritt für Schritt</span>' + (cfg.titel ? "<h3>" + cfg.titel + "</h3>" : "") + "</div>" +
      (cfg.aufgabe ? '<div class="sa-aufgabe">' + cfg.aufgabe + "</div>" : "") +
      '<p class="hint">Versuch es zuerst selbst auf Papier. Deck dann Schritt für Schritt auf und vergleiche.</p>' +
      '<ol class="sa-schritte" aria-label="Lösungsschritte"></ol>';
    const ol = $(".sa-schritte", el);
    const leiste = erzeugen("div", "stepbar");
    const reihe = erzeugen("div", "row");
    const bNext = knopf("Ersten Schritt zeigen", "primary");
    const bAlle = knopf("Alle Schritte");
    const bReset = knopf("Zurücksetzen");
    reihe.append(bNext, bAlle, bReset);
    const zahl = erzeugen("span", "stepcount");
    leiste.append(reihe, zahl);
    const ansage = ansageRegion();
    el.append(leiste, ansage);

    let k = 0;
    function aufdecken() {
      const s = schritte[k];
      const li = erzeugen("li");
      li.appendChild(erzeugen("div", "board sa-inhalt", s.html || ""));
      if (s.warum) li.appendChild(erzeugen("p", "explain", s.warum));
      ol.appendChild(li);
      k++;
      formeln(li);
    }
    function knoepfe() {
      zahl.textContent = k + " von " + schritte.length + " aufgedeckt";
      bNext.textContent = k === 0 ? "Ersten Schritt zeigen" : "Nächster Schritt";
      setzeAktiv(bNext, k < schritte.length, [bReset]);
      setzeAktiv(bAlle, k < schritte.length, [bReset]);
      setzeAktiv(bReset, k > 0, [bNext]);
    }
    bNext.addEventListener("click", () => {
      if (k >= schritte.length) return;
      aufdecken();
      ansage.textContent = "Schritt " + k + " von " + schritte.length + " aufgedeckt.";
      knoepfe();
    });
    bAlle.addEventListener("click", () => {
      while (k < schritte.length) aufdecken();
      ansage.textContent = "Alle " + schritte.length + " Schritte aufgedeckt.";
      knoepfe();
    });
    bReset.addEventListener("click", () => {
      k = 0;
      ol.innerHTML = "";
      ansage.textContent = "Zurückgesetzt.";
      knoepfe();
    });
    knoepfe();
    formeln(el);
    return { alleZeigen: () => bAlle.click(), zuruecksetzen: () => bReset.click() };
  }

  /* ---------- Baustein: Einzelfrage ---------- */

  function auswahl(el, cfg) {
    el = elementHolen(el, "auswahl");
    if (!el) return null;
    cfg = cfg || {};
    const optionen = cfg.optionen || [];
    if (!optionen.length || typeof cfg.richtig !== "number" || cfg.richtig < 0 || cfg.richtig >= optionen.length) {
      console.error("[Lernpfad] auswahl: «optionen» und gültiges «richtig» (Index ab 0) sind Pflicht.");
      return null;
    }
    const hid = neueId("auswahl");
    el.innerHTML = "";
    el.classList.add("qcard", "uebung", "auswahl");
    el.innerHTML =
      '<span class="eyebrow">Kurzfrage</span>' +
      '<h3 id="' + hid + '">' + (cfg.frage || "") + "</h3>" +
      '<div class="qopts" role="group" aria-labelledby="' + hid + '"></div>' +
      '<p class="qex" hidden></p>';
    const ops = $(".qopts", el);
    const ex = $(".qex", el);
    const reihe = erzeugen("div", "row");
    reihe.hidden = true;
    const bNochmal = knopf("Nochmals");
    reihe.appendChild(bNochmal);
    const ansage = ansageRegion();
    el.append(reihe, ansage);

    function aufbauen() {
      ops.innerHTML = "";
      ex.hidden = true;
      ex.innerHTML = "";
      reihe.hidden = true;
      ansage.textContent = "";
      let erledigt = false;
      optionen.forEach((o, j) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "qopt";
        b.innerHTML = o;
        b.addEventListener("click", () => {
          if (erledigt) return;
          erledigt = true;
          const ok = j === cfg.richtig;
          optionMarkieren(b, ok, true);
          if (!ok) optionMarkieren(ops.children[cfg.richtig], true, false);
          $$(".qopt", ops).forEach((x) => x.setAttribute("aria-disabled", "true"));
          ex.hidden = false;
          ex.innerHTML = (ok ? "✓ Richtig. " : "✗ Nicht ganz. ") + (cfg.erklaerung || "");
          reihe.hidden = false;
          ansage.textContent = ok ? "Richtig." : "Nicht ganz.";
          formeln(el);
        });
        ops.appendChild(b);
      });
      formeln(el);
    }
    bNochmal.addEventListener("click", () => {
      aufbauen();
      const erste = $(".qopt", ops);
      if (erste) erste.focus();
    });
    aufbauen();
    return { zuruecksetzen: aufbauen };
  }

  /* ---------- Piktogramme (eigene Inline-SVG, keine Markenlogos) ---------- */

  // 24×24, nur currentColor: passt sich hell/dunkel und der Umgebung an.
  const PIKTO = {
    client: '<rect x="2.5" y="4" width="19" height="15" rx="2"/><path d="M2.5 8h19"/><circle cx="5.5" cy="6" r=".6" class="pk-f"/><circle cx="7.8" cy="6" r=".6" class="pk-f"/>',
    mobile: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M10.5 18.5h3"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20.5c.8-4 3.6-6 7-6s6.2 2 7 6"/>',
    gateway: '<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"/><path d="M8.5 12h7M13 9.5l2.5 2.5-2.5 2.5"/>',
    lb: '<circle cx="5" cy="12" r="2.2"/><circle cx="19" cy="5" r="2.2"/><circle cx="19" cy="12" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M7.2 12h9.6M7 11l10-5M7 13l10 5"/>',
    service: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M9 12h6M12 9v6"/>',
    function: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8.5 7.5c2 0 2.5 1 3 3l2 6.5M12.6 12.4L9 17"/>',
    db: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.8"/><path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
    cache: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M13 7.5l-4 5h4l-2 4.5"/>',
    queue: '<rect x="2.5" y="7" width="19" height="10" rx="2"/><path d="M7 7v10M11.5 7v10M16 7v10"/><path d="M19 4.5h2.5M2.5 19.5H5" />',
    topic: '<circle cx="5" cy="12" r="2.3"/><path d="M7.3 12H11M11 12l3-6h4.5M11 12h7.5M11 12l3 6h4.5"/><circle cx="20" cy="6" r="1.3"/><circle cx="20" cy="12" r="1.3"/><circle cx="20" cy="18" r="1.3"/>',
    storage: '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 17l8 4 8-4"/>',
    extern: '<path d="M7 18.5h10.5a4 4 0 0 0 .5-8 6 6 0 0 0-11.4-1.6A4.8 4.8 0 0 0 7 18.5z"/>',
    container: '<path d="M3 8l9-4.5L21 8v8l-9 4.5L3 16z"/><path d="M3 8l9 4.5L21 8M12 12.5v8"/>',
    pod: '<path d="M12 2.5l8.5 5v9l-8.5 5-8.5-5v-9z"/><rect x="8" y="8" width="3.4" height="3.4" rx=".5"/><rect x="12.6" y="8" width="3.4" height="3.4" rx=".5"/><rect x="8" y="12.6" width="3.4" height="3.4" rx=".5"/>',
    node: '<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><circle cx="7" cy="7.5" r=".8" class="pk-f"/><circle cx="7" cy="16.5" r=".8" class="pk-f"/><path d="M11 7.5h6M11 16.5h6"/>',
    cluster: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v7M12 14.5v7M2.5 12h7M14.5 12h7M5.3 5.3l5 5M13.7 13.7l5 5M18.7 5.3l-5 5M10.3 13.7l-5 5"/>',
    auth: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17.5 12v3.5M20.5 12v2.5"/>',
    cdn: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.7 2.6 4 5.8 4 9.5s-1.3 6.9-4 9.5c-2.7-2.6-4-5.8-4-9.5s1.3-6.9 4-9.5z"/>',
    monitor: '<rect x="2.5" y="4" width="19" height="14" rx="2"/><path d="M5.5 14l3.5-4 3 2.5 4.5-5.5 2 2"/><path d="M9 21h6"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
    code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15"/>',
  };
  function piktogramm(art, titel) {
    const inhalt = PIKTO[art];
    if (!inhalt) {
      console.error("[Lernpfad] piktogramm: Art «" + art + "» unbekannt. Bekannt: " + Object.keys(PIKTO).join(", "));
      return "";
    }
    const t = titel ? "<title>" + String(titel).replace(/[<&"]/g, "") + "</title>" : "";
    return '<svg class="pikto" viewBox="0 0 24 24" ' + (t ? 'role="img"' : 'aria-hidden="true"') + ' focusable="false">' + t + inhalt + "</svg>";
  }

  /* ---------- Baustein: Architektur modellieren ---------- */

  const MOD_ARTEN = [
    { id: "sync", name: "synchron (Request/Response)", stil: "voll" },
    { id: "async", name: "asynchron (Nachricht/Event)", stil: "gestrichelt" },
    { id: "daten", name: "liest/schreibt Daten", stil: "gepunktet" },
  ];

  function modellieren(el, cfg) {
    el = elementHolen(el, "modellieren");
    if (!el) return null;
    cfg = cfg || {};
    const bausteine = cfg.bausteine || [];
    const loesung = cfg.loesung || {};
    const arten = cfg.verbindungsarten && cfg.verbindungsarten.length ? cfg.verbindungsarten : MOD_ARTEN;
    const schichten = cfg.schichten && cfg.schichten.length ? cfg.schichten : [{ id: "_", name: "" }];
    const richtungEgal = cfg.richtungEgal === true;
    const fehler = (t) => { console.error("[Lernpfad] modellieren: " + t); return null; };

    if (!bausteine.length || !Array.isArray(loesung.bausteine) || !Array.isArray(loesung.verbindungen)) {
      return fehler("«bausteine» und «loesung» ({ bausteine, verbindungen }) sind Pflicht.");
    }
    const nachId = {};
    for (const b of bausteine) {
      if (!b || !b.id || !b.name) return fehler("jeder Baustein braucht «id» und «name».");
      if (nachId[b.id]) return fehler("Baustein-ID «" + b.id + "» doppelt.");
      if (b.art && !PIKTO[b.art]) return fehler("Art «" + b.art + "» bei «" + b.id + "» unbekannt.");
      if (b.schicht !== undefined && !schichten.some((s) => s.id === b.schicht)) return fehler("Schicht «" + b.schicht + "» bei «" + b.id + "» unbekannt.");
      nachId[b.id] = b;
    }
    const artIndex = (id) => arten.findIndex((a) => a.id === id);
    for (const id of loesung.bausteine) if (!nachId[id]) return fehler("Lösung nennt unbekannten Baustein «" + id + "».");
    for (const v of loesung.verbindungen) {
      if (!nachId[v.von] || !nachId[v.nach]) return fehler("Lösungs-Verbindung " + v.von + " → " + v.nach + " nennt unbekannten Baustein.");
      if (loesung.bausteine.indexOf(v.von) < 0 || loesung.bausteine.indexOf(v.nach) < 0) return fehler("Lösungs-Verbindung " + v.von + " → " + v.nach + ": beide Bausteine müssen in loesung.bausteine stehen.");
      if (artIndex(v.art) < 0) return fehler("Verbindungsart «" + v.art + "» unbekannt.");
    }
    const vorgegeben = cfg.vorgegeben === true;
    const uid = neueId("mod");
    const schichtVon = (b) => (b.schicht !== undefined ? b.schicht : schichten[0].id);
    const name = (id) => nachId[id].name;
    const artName = (id) => { const a = arten[artIndex(id)]; return a ? a.name : id; };

    // Zustand
    let platziert = [];
    let verb = [];
    let auswahl = null;
    let aktArt = arten[0].id;
    let geprueft = null; // Ergebnis der letzten Prüfung (für Markierungen)

    el.innerHTML = "";
    el.classList.add("card", "stack", "mod");
    el.setAttribute("data-link-bereich", "");
    if (cfg.titel) el.appendChild(erzeugen("h3", null, cfg.titel));
    if (cfg.aufgabe) {
      const a = erzeugen("div", "mod-aufgabe prose", cfg.aufgabe);
      $$("[data-baustein]", a).forEach((s) => {
        const id = s.getAttribute("data-baustein");
        if (!nachId[id]) console.error("[Lernpfad] modellieren: Text verweist auf unbekannten Baustein «" + id + "».");
        s.classList.add("mod-text");
        s.setAttribute("data-link", uid + "-" + id);
      });
      el.appendChild(a);
    }

    // Palette
    const palette = erzeugen("div", "mod-palette");
    const palTitel = erzeugen("p", "mod-label", "1 · Bausteine auf die Fläche legen <span class=\"hint\">(nochmals tippen entfernt)</span>");
    const palListe = erzeugen("div", "mod-pal");
    palListe.setAttribute("role", "group");
    palListe.setAttribute("aria-label", "Bausteine");
    const palKnoepfe = {};
    bausteine.forEach((b) => {
      const k = knopf(piktogramm(b.art || "service") + "<span>" + b.name + "</span>", "mod-palk", { "aria-pressed": "false" });
      if (b.info) k.title = ohneTags(b.info);
      k.addEventListener("click", () => {
        if (platziert.indexOf(b.id) >= 0) entfernen(b.id);
        else platzieren(b.id);
      });
      palKnoepfe[b.id] = k;
      palListe.appendChild(k);
    });
    palette.append(palTitel, palListe);
    if (vorgegeben) palette.hidden = true;

    // Werkzeug: Verbindungsart
    const werkzeug = erzeugen("div", "mod-werkzeug");
    werkzeug.appendChild(erzeugen("p", "mod-label", (vorgegeben ? "1" : "2") + " · " + (arten.length > 1 ? "Verbindungsart wählen, dann " : "") + "Start- und Zielbaustein antippen"));
    const artReihe = erzeugen("div", "row");
    artReihe.setAttribute("role", "group");
    artReihe.setAttribute("aria-label", "Verbindungsart");
    const artKnoepfe = arten.map((a, i) => {
      const k = knopf('<svg class="mod-muster" viewBox="0 0 34 10" aria-hidden="true"><line x1="2" y1="5" x2="32" y2="5" class="mod-l mod-l' + i + '"/></svg>' + a.name, "", { "aria-pressed": String(i === 0) });
      k.addEventListener("click", () => {
        aktArt = a.id;
        artKnoepfe.forEach((x, j) => { x.classList.toggle("on", j === i); x.setAttribute("aria-pressed", String(j === i)); });
      });
      if (i === 0) k.classList.add("on");
      artReihe.appendChild(k);
      return k;
    });
    werkzeug.appendChild(artReihe);
    if (arten.length < 2) werkzeug.querySelector(".row").hidden = true;

    // Fläche mit Schichten und Linien
    const flaeche = erzeugen("div", "mod-flaeche");
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "mod-linien");
    svg.setAttribute("aria-hidden", "true");
    const defs = document.createElementNS(NS, "defs");
    arten.forEach((a, i) => {
      const m = document.createElementNS(NS, "marker");
      m.setAttribute("id", uid + "-pf" + i);
      m.setAttribute("viewBox", "0 0 10 10");
      m.setAttribute("refX", "9");
      m.setAttribute("refY", "5");
      m.setAttribute("markerWidth", "7");
      m.setAttribute("markerHeight", "7");
      m.setAttribute("orient", "auto-start-reverse");
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", "M0 0L10 5L0 10z");
      p.setAttribute("class", "mod-pf" + i);
      m.appendChild(p);
      defs.appendChild(m);
    });
    svg.appendChild(defs);
    const linienG = document.createElementNS(NS, "g");
    svg.appendChild(linienG);
    flaeche.appendChild(svg);
    const schichtBoxen = {};
    schichten.forEach((s) => {
      const z = erzeugen("div", "mod-schicht");
      if (s.name) z.appendChild(erzeugen("span", "mod-sname", s.name));
      const boxen = erzeugen("div", "mod-boxen");
      z.appendChild(boxen);
      schichtBoxen[s.id] = boxen;
      flaeche.appendChild(z);
    });
    const leer = erzeugen("p", "mod-leer hint", vorgegeben ? "" : "Noch leer. Lies den Text und lege die Bausteine aus der Liste oben auf die Fläche.");

    const hilfe = erzeugen("p", "mod-hilfe");
    hilfe.setAttribute("aria-live", "polite");
    const listeTitel = erzeugen("p", "mod-label", "Verbindungen");
    const liste = erzeugen("ul", "mod-liste");
    const bPruefen = knopf("Prüfen", "primary");
    const bLoesung = knopf("Lösung zeigen");
    const bReset = knopf("Zurücksetzen");
    const reihe = erzeugen("div", "row");
    reihe.append(bPruefen, bLoesung, bReset);
    const fb = erzeugen("div", "mod-fb");
    fb.setAttribute("aria-live", "polite");
    el.append(palette, werkzeug, flaeche, leer, hilfe, listeTitel, liste, reihe, fb);

    const boxKnoepfe = {};

    function aenderung() {
      geprueft = null;
      fb.innerHTML = "";
      fb.className = "mod-fb";
      zeichnen();
    }
    function platzieren(id) {
      if (platziert.indexOf(id) < 0) platziert.push(id);
      hilfe.textContent = "«" + ohneTags(name(id)) + "» liegt auf der Fläche.";
      aenderung();
    }
    function entfernen(id) {
      platziert = platziert.filter((x) => x !== id);
      verb = verb.filter((v) => v.von !== id && v.nach !== id);
      if (auswahl === id) auswahl = null;
      hilfe.textContent = "«" + ohneTags(name(id)) + "» und seine Verbindungen sind entfernt.";
      aenderung();
      const k = palKnoepfe[id];
      if (k) k.focus();
    }
    const gleichesPaar = (v, von, nach) =>
      (v.von === von && v.nach === nach) || (richtungEgal && v.von === nach && v.nach === von);

    function boxGeklickt(id) {
      if (auswahl === null) {
        auswahl = id;
        hilfe.textContent = "Start: «" + ohneTags(name(id)) + "». Tippe jetzt das Ziel an (oder nochmals den Start zum Abbrechen).";
        zeichnen();
        return;
      }
      if (auswahl === id) {
        auswahl = null;
        hilfe.textContent = "Auswahl aufgehoben.";
        zeichnen();
        return;
      }
      const von = auswahl;
      auswahl = null;
      const da = verb.find((v) => gleichesPaar(v, von, id));
      if (da) da.art = aktArt;
      else verb.push({ von: von, nach: id, art: aktArt });
      hilfe.textContent = "Verbindung «" + ohneTags(name(von)) + " → " + ohneTags(name(id)) + "» (" + artName(aktArt) + ")" + (da ? " geändert." : " gezogen.");
      aenderung();
      const k = boxKnoepfe[id];
      if (k) k.focus();
    }

    // Soll-Abgleich
    function pruefen() {
      const soll = loesung.verbindungen;
      const sollB = loesung.bausteine;
      const bOk = platziert.filter((id) => sollB.indexOf(id) >= 0);
      const bExtra = platziert.filter((id) => sollB.indexOf(id) < 0);
      const bFehlt = sollB.filter((id) => platziert.indexOf(id) < 0);
      const gefunden = new Array(soll.length).fill(false);
      const vStatus = verb.map((v) => {
        const j = soll.findIndex((s, k) => !gefunden[k] && ((s.von === v.von && s.nach === v.nach) || ((richtungEgal || s.gerichtet === false) && s.von === v.nach && s.nach === v.von)));
        if (j < 0) {
          const umgekehrt = soll.some((s) => s.von === v.nach && s.nach === v.von);
          return { status: umgekehrt ? "richtung" : "falsch" };
        }
        gefunden[j] = true;
        return { status: soll[j].art === v.art ? "ok" : "art", soll: soll[j] };
      });
      const vOk = vStatus.filter((s) => s.status === "ok").length;
      const vFehlt = soll.filter((_, k) => !gefunden[k]);
      return {
        bOk: bOk, bExtra: bExtra, bFehlt: bFehlt, vStatus: vStatus, vFehlt: vFehlt,
        richtig: bOk.length + vOk,
        gesamt: sollB.length + soll.length,
        fehlerzahl: bExtra.length + vStatus.filter((s) => s.status !== "ok").length,
      };
    }

    function begruendungen() {
      const mit = loesung.verbindungen.filter((v) => v.warum);
      if (!mit.length && !cfg.erklaerung) return "";
      let h = "";
      if (mit.length) {
        h += '<ul class="mod-warum">' + mit.map((v) =>
          "<li><b>" + name(v.von) + " → " + name(v.nach) + "</b> <span class=\"hint\">(" + artName(v.art) + ")</span>: " + v.warum + "</li>").join("") + "</ul>";
      }
      if (cfg.erklaerung) h += '<div class="note tipp">' + cfg.erklaerung + "</div>";
      return h;
    }

    function rueckmeldung(e, loesungGezeigt) {
      geprueft = e;
      const vollstaendig = e.richtig === e.gesamt && e.fehlerzahl === 0;
      let h;
      if (vollstaendig) {
        h = "<p><b>" + (loesungGezeigt ? "Musterlösung." : "✓ Alles richtig modelliert.") + "</b> " + e.richtig + " von " + e.gesamt + " Punkten.</p>" + begruendungen();
      } else {
        const teile = [];
        if (e.bFehlt.length) teile.push((e.bFehlt.length > 1 ? "Es fehlen " + e.bFehlt.length + " Bausteine" : "Es fehlt 1 Baustein") + ". Lies den Text nochmals: Welche Teile werden genannt, liegen aber nicht auf der Fläche?");
        if (e.bExtra.length) teile.push("Überflüssig: " + e.bExtra.map((id) => "«" + name(id) + "»").join(", ") + (e.bExtra.length > 1 ? " kommen" : " kommt") + " im Text nicht vor oder wird nicht gebraucht.");
        const nFalsch = e.vStatus.filter((s) => s.status === "falsch").length;
        const nArt = e.vStatus.filter((s) => s.status === "art").length;
        const nRicht = e.vStatus.filter((s) => s.status === "richtung").length;
        if (nFalsch) teile.push(nFalsch + " Verbindung" + (nFalsch > 1 ? "en gibt" : " gibt") + " es so nicht (mit ✗ markiert).");
        if (nRicht) teile.push(nRicht + " Verbindung" + (nRicht > 1 ? "en zeigen" : " zeigt") + " in die falsche Richtung. Wer ruft wen auf, wer sendet an wen?");
        if (nArt) teile.push(nArt + " Verbindung" + (nArt > 1 ? "en haben" : " hat") + " die falsche Art (synchron, asynchron oder Datenzugriff?).");
        if (e.vFehlt.length) {
          const tipp = e.vFehlt[0];
          teile.push((e.vFehlt.length > 1 ? "Es fehlen " + e.vFehlt.length + " Verbindungen" : "Es fehlt 1 Verbindung") + ". Tipp: Schau dir «" + name(tipp.von) + "» nochmals an.");
        }
        h = "<p><b>" + e.richtig + " von " + e.gesamt + " Punkten.</b></p><ul>" + teile.map((t) => "<li>" + t + "</li>").join("") + "</ul>";
      }
      fb.className = "mod-fb " + (vollstaendig ? "ok" : "bad");
      fb.innerHTML = h;
      formeln(fb);
      zeichnen();
      el.dispatchEvent(new CustomEvent("lernpfad:modell", { bubbles: true, detail: { richtig: e.richtig, gesamt: e.gesamt, vollstaendig: vollstaendig, loesungGezeigt: !!loesungGezeigt } }));
    }

    function zeichnen() {
      // Palette
      bausteine.forEach((b) => {
        const an = platziert.indexOf(b.id) >= 0;
        palKnoepfe[b.id].setAttribute("aria-pressed", String(an));
        palKnoepfe[b.id].classList.toggle("on", an);
      });
      // Text
      $$(".mod-text", el).forEach((s) => s.classList.toggle("mod-text-an", platziert.indexOf(s.getAttribute("data-baustein")) >= 0));
      // Boxen
      const fokusId = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.modId : null;
      Object.keys(schichtBoxen).forEach((k) => (schichtBoxen[k].innerHTML = ""));
      Object.keys(boxKnoepfe).forEach((k) => delete boxKnoepfe[k]);
      platziert.forEach((id) => {
        const b = nachId[id];
        const k = knopf(piktogramm(b.art || "service") + '<span class="mod-bname">' + b.name + "</span>" + '<span class="marke" aria-hidden="true"></span>', "mod-box", { "aria-pressed": String(auswahl === id) });
        k.dataset.modId = id;
        k.setAttribute("data-link", uid + "-" + id);
        if (auswahl === id) k.classList.add("mod-sel");
        if (geprueft) {
          const ok = geprueft.bOk.indexOf(id) >= 0;
          k.classList.add(ok ? "mod-ok" : "mod-falsch");
          $(".marke", k).textContent = ok ? "✓" : "✗";
          k.setAttribute("aria-label", ohneTags(b.name) + (ok ? ", richtig" : ", überflüssig"));
        }
        k.addEventListener("click", () => boxGeklickt(id));
        schichtBoxen[schichtVon(b)].appendChild(k);
        boxKnoepfe[id] = k;
      });
      leer.hidden = platziert.length > 0 || vorgegeben;
      if (fokusId && boxKnoepfe[fokusId]) boxKnoepfe[fokusId].focus();
      // Liste
      liste.innerHTML = "";
      if (!verb.length) liste.appendChild(erzeugen("li", "hint", "Noch keine Verbindung."));
      verb.forEach((v, i) => {
        const li = erzeugen("li", "mod-v");
        let marke = "";
        let zusatz = "";
        if (geprueft) {
          const s = geprueft.vStatus[i].status;
          marke = s === "ok" ? "✓ " : "✗ ";
          li.classList.add(s === "ok" ? "mod-ok" : "mod-falsch");
          zusatz = s === "art" ? " · falsche Art" : s === "richtung" ? " · falsche Richtung" : s === "falsch" ? " · gibt es so nicht" : "";
        }
        const text = erzeugen("span", null,
          marke + name(v.von) + (richtungEgal ? " — " : " → ") + name(v.nach) + ' <span class="hint">· ' + artName(v.art) + zusatz + "</span>");
        const weg = knopf("Entfernen", "mod-weg", { "aria-label": "Verbindung " + ohneTags(name(v.von)) + " nach " + ohneTags(name(v.nach)) + " entfernen" });
        weg.addEventListener("click", () => {
          verb.splice(i, 1);
          hilfe.textContent = "Verbindung entfernt.";
          aenderung();
          const naechster = $(".mod-weg", liste) || bPruefen;
          naechster.focus();
        });
        li.append(text, weg);
        liste.appendChild(li);
      });
      verknuepfen(el);
      linienZeichnen();
    }

    function rand(r, zx, zy) {
      // Schnittpunkt der Strecke Mitte→Ziel mit dem Rechteckrand (plus 3 px Abstand)
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const dx = zx - cx, dy = zy - cy;
      if (!dx && !dy) return [cx, cy];
      const sx = dx ? (r.w / 2 + 3) / Math.abs(dx) : Infinity;
      const sy = dy ? (r.h / 2 + 3) / Math.abs(dy) : Infinity;
      const s = Math.min(sx, sy);
      return [cx + dx * s, cy + dy * s];
    }
    function linienZeichnen() {
      const fr = flaeche.getBoundingClientRect();
      svg.setAttribute("width", String(flaeche.clientWidth));
      svg.setAttribute("height", String(flaeche.clientHeight));
      linienG.innerHTML = "";
      const rect = {};
      Object.keys(boxKnoepfe).forEach((id) => {
        const r = boxKnoepfe[id].getBoundingClientRect();
        rect[id] = { x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height };
      });
      verb.forEach((v, i) => {
        const a = rect[v.von], b = rect[v.nach];
        if (!a || !b) return;
        const ai = artIndex(v.art);
        let [x1, y1] = rand(a, b.x + b.w / 2, b.y + b.h / 2);
        let [x2, y2] = rand(b, a.x + a.w / 2, a.y + a.h / 2);
        // Gegenläufige Verbindung zwischen denselben Bausteinen leicht versetzen
        if (verb.some((w) => w !== v && w.von === v.nach && w.nach === v.von)) {
          const l = Math.hypot(x2 - x1, y2 - y1) || 1;
          const ox = (-(y2 - y1) / l) * 4, oy = ((x2 - x1) / l) * 4;
          x1 += ox; y1 += oy; x2 += ox; y2 += oy;
        }
        const l = document.createElementNS(NS, "line");
        l.setAttribute("x1", x1.toFixed(1));
        l.setAttribute("y1", y1.toFixed(1));
        l.setAttribute("x2", x2.toFixed(1));
        l.setAttribute("y2", y2.toFixed(1));
        let k = "mod-l mod-l" + ai;
        if (geprueft) k += geprueft.vStatus[i].status === "ok" ? " mod-l-ok" : " mod-l-falsch";
        l.setAttribute("class", k);
        if (!richtungEgal) l.setAttribute("marker-end", "url(#" + uid + "-pf" + ai + ")");
        linienG.appendChild(l);
      });
    }

    function zuruecksetzen() {
      platziert = vorgegeben ? loesung.bausteine.slice() : [];
      verb = [];
      auswahl = null;
      hilfe.textContent = "";
      aenderung();
    }

    bPruefen.addEventListener("click", () => {
      auswahl = null;
      rueckmeldung(pruefen(), false);
    });
    bLoesung.addEventListener("click", () => {
      platziert = loesung.bausteine.slice();
      verb = loesung.verbindungen.map((v) => ({ von: v.von, nach: v.nach, art: v.art }));
      auswahl = null;
      hilfe.textContent = "Die Musterlösung ist eingezeichnet.";
      rueckmeldung(pruefen(), true);
    });
    bReset.addEventListener("click", () => {
      zuruecksetzen();
      bReset.focus();
    });

    if (window.ResizeObserver) new ResizeObserver(linienZeichnen).observe(flaeche);
    else window.addEventListener("resize", linienZeichnen);

    zuruecksetzen();
    formeln(el);
    return {
      zuruecksetzen: zuruecksetzen,
      loesungZeigen: () => bLoesung.click(),
      pruefen: () => { const e = pruefen(); rueckmeldung(e, false); return { richtig: e.richtig, gesamt: e.gesamt }; },
    };
  }

  /* ---------- Seitenrahmen: Kopfleiste, Navigation, Abschluss ---------- */

  function kopfleisteEinfuegen() {
    if (document.querySelector(".kopfleiste")) return;
    const { fach } = kontext();
    const leiste = erzeugen("div", "kopfleiste");
    const nav = erzeugen("nav");
    nav.setAttribute("aria-label", "Lernpfad");
    const a = erzeugen("a", "kopf-zurueck");
    a.href = fach ? "/lernseiten/" + encodeURIComponent(fach) : "/lernseiten";
    a.textContent = "← Lernpfad" + (fach ? " " + fach.toUpperCase() : "");
    nav.appendChild(a);
    const gruppe = erzeugen("div", "theme-wahl");
    gruppe.setAttribute("role", "group");
    gruppe.setAttribute("aria-label", "Farbschema");
    [["hell", "☀", "Hell"], ["dunkel", "☾", "Dunkel"], ["auto", "◐", "Auto"]].forEach(([wert, symbol, text]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.wert = wert;
      b.title = wert === "auto" ? "Automatisch, wie das System" : text;
      b.innerHTML = '<span aria-hidden="true">' + symbol + '</span><span class="kopf-txt">' + text + "</span>";
      b.addEventListener("click", () => {
        themeWahl = wert;
        speicherSchreiben(THEME_SCHLUESSEL, wert);
        themeAnwenden(wert);
        markieren();
      });
      gruppe.appendChild(b);
    });
    function markieren() {
      $$("button", gruppe).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.wert === themeWahl)));
    }
    markieren();
    leiste.append(nav, gruppe);
    document.body.insertBefore(leiste, document.body.firstChild);
  }

  function navMarkieren() {
    const nav = document.querySelector("nav.steps");
    if (!nav) return;
    const eintraege = $$('a[href^="#"]', nav)
      .map((a) => {
        let ziel = null;
        try { ziel = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1))); } catch (e) { ziel = null; }
        return { a: a, ziel: ziel };
      })
      .filter((x) => x.ziel);
    if (!eintraege.length) return;
    let aktiv = null, geplant = false;

    function setzen(eintrag) {
      if (eintrag === aktiv) return;
      aktiv = eintrag;
      eintraege.forEach((x) => {
        const an = x === eintrag;
        x.a.classList.toggle("aktiv", an);
        if (an) x.a.setAttribute("aria-current", "location");
        else x.a.removeAttribute("aria-current");
      });
      if (eintrag) {
        const nr = nav.getBoundingClientRect();
        const lr = eintrag.a.getBoundingClientRect();
        if (lr.left < nr.left || lr.right > nr.right) nav.scrollLeft += lr.left - nr.left - (nr.width - lr.width) / 2;
      } else {
        nav.scrollLeft = 0; // oben auf der Seite: Navigation wieder von vorne zeigen
      }
    }
    function pruefen() {
      geplant = false;
      const grenze = window.innerHeight * 0.35;
      let treffer = null;
      eintraege.forEach((x) => { if (x.ziel.getBoundingClientRect().top <= grenze) treffer = x; });
      const unten = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (unten && window.scrollY > 0) treffer = eintraege[eintraege.length - 1];
      setzen(treffer);
    }
    window.addEventListener("scroll", () => {
      if (!geplant) { geplant = true; requestAnimationFrame(pruefen); }
    }, { passive: true });
    window.addEventListener("resize", pruefen);
    pruefen();
  }

  function abschlussEinfuegen() {
    const { fach, thema } = kontext();
    if (!thema || document.body.dataset.abschluss === "aus" || document.querySelector("section.abschluss")) return;
    const ziel = document.querySelector(".wrap") || document.querySelector("main") || document.body;
    const naechste = document.querySelector('link[rel="next"][href]');

    const sec = erzeugen("section", "abschluss");
    sec.id = "abschluss";
    sec.setAttribute("aria-labelledby", "lp-abschluss-titel");
    sec.innerHTML =
      '<div class="card stack">' +
      '<span class="eyebrow">Abschluss</span>' +
      '<h2 id="lp-abschluss-titel">Thema abschliessen</h2>' +
      '<p class="abschluss-stand"><span>Stand:</span><span class="status offen">wird geladen …</span><span class="abschluss-quiz hint"></span></p>' +
      '<p class="hint">Markier das Thema als erledigt, wenn du den Selbsttest gemacht hast und die Beispiele ohne Hilfe lösen kannst.</p>' +
      '<div class="row"><button type="button" class="btn primary abschluss-knopf"><span aria-hidden="true">✓</span> Thema als erledigt markieren</button>' +
      '<button type="button" class="btn abschluss-erneut" hidden><span aria-hidden="true">↻</span> Erneut speichern</button>' +
      // Neuer Tab: das ungespeicherte Ergebnis bleibt hier stehen und lässt sich danach speichern
      '<a class="btn abschluss-login" href="/login" target="_blank" rel="noopener" hidden>Neu anmelden (neuer Tab)</a></div>' +
      '<p class="fb abschluss-fb" aria-live="polite"></p>' +
      '<div class="row abschluss-links"></div>' +
      "</div>";
    const links = $(".abschluss-links", sec);
    const zurueck = erzeugen("a", "btn");
    zurueck.href = fach ? "/lernseiten/" + encodeURIComponent(fach) : "/lernseiten";
    zurueck.textContent = "← Zurück zum Lernpfad";
    links.appendChild(zurueck);
    if (naechste) {
      const weiter = erzeugen("a", "btn primary");
      weiter.href = naechste.getAttribute("href");
      weiter.textContent = "Nächste Station" + (naechste.title ? ": " + naechste.title : "") + " →";
      links.appendChild(weiter);
    }
    ziel.appendChild(sec);

    const statusEl = $(".status", sec);
    const quizEl = $(".abschluss-quiz", sec);
    const bErledigt = $(".abschluss-knopf", sec);
    const bErneut = $(".abschluss-erneut", sec);
    const loginLink = $(".abschluss-login", sec);
    const fb = $(".abschluss-fb", sec);
    // quizGespeichert: false, solange das letzte Selbsttest-Ergebnis nicht bei der API angekommen ist.
    // anmelden: die letzte Meldung scheiterte mit 401 (Sitzung abgelaufen).
    const zustand = { status: null, quizRichtig: null, quizGesamt: null, gespeichert: true, quizGespeichert: true, anmelden: false };

    function zeigen() {
      const s = zustand.status;
      statusEl.className = "status " + (s || "offen");
      statusEl.textContent = s === "erledigt" ? "✓ Erledigt" : s === "begonnen" ? "◐ Begonnen" : zustand.gespeichert ? "○ Noch nicht begonnen" : "○ Nicht gespeichert";
      const quizDa = Number.isInteger(zustand.quizGesamt) && zustand.quizGesamt > 0;
      quizEl.textContent = quizDa
        ? "Selbsttest: " + zustand.quizRichtig + " / " + zustand.quizGesamt + " richtig" + (zustand.quizGespeichert ? "" : " · nicht gespeichert")
        : "";
      if (s === "erledigt") {
        bErledigt.innerHTML = '<span aria-hidden="true">✓</span> Thema erledigt';
        setzeAktiv(bErledigt, false, [$("a.btn.primary", links), zurueck]);
      }
      const erneutZeigen = quizDa && !zustand.quizGespeichert;
      // Fokus nicht verlieren, wenn «Erneut speichern» nach Erfolg verschwindet
      if (!erneutZeigen && document.activeElement === bErneut) (bErledigt.disabled ? zurueck : bErledigt).focus();
      bErneut.hidden = !erneutZeigen;
      loginLink.hidden = !zustand.anmelden;
    }

    // Antwort auf eine Meldung des Selbsttest-Ergebnisses verarbeiten (Selbsttest und «Erneut speichern»)
    function quizGemeldet(antwort) {
      const warFehler = !zustand.quizGespeichert;
      zustand.quizGespeichert = antwort.ok;
      zustand.anmelden = antwort.httpStatus === 401;
      if (antwort.ok) {
        zustand.gespeichert = true;
        if (!zustand.status) zustand.status = "begonnen";
        if (warFehler) fb.textContent = "✓ Selbsttest-Ergebnis gespeichert.";
      } else if (zustand.anmelden) {
        fb.textContent = "✗ Selbsttest-Ergebnis nicht gespeichert: Deine Anmeldung ist abgelaufen. Melde dich im neuen Tab neu an und klick dann auf «Erneut speichern».";
      } else {
        fb.textContent = "✗ Selbsttest-Ergebnis nicht gespeichert. Prüf deine Verbindung und klick auf «Erneut speichern».";
      }
    }

    fortschrittStarten().then((r) => {
      const e = r.eintrag;
      if (e) {
        zustand.status = e.status === "erledigt" ? "erledigt" : "begonnen";
        if (zustand.quizGesamt === null && Number.isInteger(e.quizGesamt)) {
          zustand.quizRichtig = e.quizRichtig;
          zustand.quizGesamt = e.quizGesamt;
        }
      }
      if (r.gespeichert) {
        if (!zustand.status) zustand.status = "begonnen";
      } else {
        zustand.gespeichert = false;
        fb.textContent = "Dein Fortschritt wird nur gespeichert, wenn du eingeloggt und online bist.";
      }
      zeigen();
    });

    document.addEventListener("lernpfad:selbsttest", (ev) => {
      const d = ev.detail || {};
      zustand.quizRichtig = d.richtig;
      zustand.quizGesamt = d.gesamt;
      // Ohne Angabe (eigenes Ereignis einer Seite) gilt das Ergebnis als gespeichert
      quizGemeldet({ ok: d.gespeichert !== false, httpStatus: d.httpStatus || 0 });
      zeigen();
    });

    bErneut.addEventListener("click", () => {
      if (bErneut.getAttribute("aria-busy")) return;
      bErneut.setAttribute("aria-busy", "true");
      fortschrittSenden({ status: "begonnen", quizRichtig: zustand.quizRichtig, quizGesamt: zustand.quizGesamt })
        .then((antwort) => {
          bErneut.removeAttribute("aria-busy");
          quizGemeldet(antwort);
          zeigen();
        });
    });

    bErledigt.addEventListener("click", () => {
      if (zustand.status === "erledigt") return;
      bErledigt.setAttribute("aria-busy", "true");
      const mitQuiz = Number.isInteger(zustand.quizGesamt) && zustand.quizGesamt > 0;
      fortschrittSenden({ status: "erledigt", quizRichtig: zustand.quizRichtig, quizGesamt: zustand.quizGesamt })
        .then((antwort) => {
          bErledigt.removeAttribute("aria-busy");
          zustand.anmelden = antwort.httpStatus === 401;
          if (antwort.ok) {
            zustand.status = "erledigt";
            zustand.gespeichert = true;
            // Die Meldung enthielt die Selbsttest-Werte: ein offenes Ergebnis ist damit gespeichert
            if (mitQuiz) zustand.quizGespeichert = true;
            fb.textContent = "✓ Gespeichert. Das Thema ist erledigt.";
          } else if (zustand.anmelden) {
            fb.textContent = "✗ Konnte nicht gespeichert werden: Deine Anmeldung ist abgelaufen. Melde dich im neuen Tab neu an und versuch es dann nochmals.";
          } else {
            fb.textContent = "✗ Konnte nicht gespeichert werden. Bist du eingeloggt? Versuch es später nochmals.";
          }
          zeigen();
        });
    });
  }

  /* ---------- Start ---------- */

  let gestartet = false;
  function start() {
    if (gestartet) return;
    gestartet = true;
    [kopfleisteEinfuegen, navMarkieren, () => formeln(document.body), breiteBeobachten, fortschrittStarten, abschlussEinfuegen].forEach((f) => {
      try { f(); } catch (e) { console.error("[Lernpfad] Start fehlgeschlagen:", e); }
    });
  }

  window.Lernpfad = {
    version: "1.1.0",
    formeln: formeln,
    verknuepfen: verknuepfen,
    sortierer: sortierer,
    stepper: stepper,
    film: film,
    selbsttest: selbsttest,
    zahlAufgabe: zahlAufgabe,
    wahrFalsch: wahrFalsch,
    schrittAufgabe: schrittAufgabe,
    auswahl: auswahl,
    modellieren: modellieren,
    piktogramm: piktogramm,
    fortschritt: fortschritt,
    zahlLesen: zahlLesen,
    zahlText: zahlText,
    makros: makros,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
