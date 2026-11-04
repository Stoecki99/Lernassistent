/* ==========================================================================
   Lernpfad-Baukasten · lernpfad.js
   Vanilla-JS ohne Abhängigkeiten. Stellt das globale Objekt window.Lernpfad bereit.
   Einbinden am Ende von <body>, danach das seiteneigene Script.
   Doku: docs/lernpfad-baukasten.md
   ========================================================================== */
(function () {
  "use strict";

  /* ==========================================================================
     Reine Auswertung ohne DOM (Zahlen, Logikformeln, Mengen, Hypothesen, Text).
     Läuft auch unter Node: tests/lernpfad-auswertung.test.ts lädt diese Datei mit require().
     ========================================================================== */

  /* ---------- Zahlen lesen und schreiben ---------- */

  // Liest «0,25», «0.25», «1'234.5», «1/4», «25%» (ohne Umrechnung), «−3», «1e-3»
  function zahlLesen(text) {
    if (typeof text === "number") return text;
    if (typeof text !== "string") return NaN;
    let t = text.trim().replace(/[\s'’  ]/g, "").replace(/[−–]/g, "-");
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

  // Eingabe einer Zahlaufgabe bewerten (gemeinsame Logik von zahlAufgabe, tabellenAufgabe, lueckenRechnung).
  // art: "leer" (keine Zahl), "ok", "faktor100", "knapp", "falsch"; wert: gelesene Zahl
  function zahlBewerten(text, sollListe, toleranz) {
    const x = zahlLesen(text);
    if (!Number.isFinite(x)) return { art: "leer", wert: x };
    // «25%» passt sowohl zu 25 als auch zu 0.25
    const kandidaten = /%\s*$/.test(String(text)) ? [x, x / 100] : [x];
    const tests = [];
    sollListe.forEach((soll) => kandidaten.forEach((k) => tests.push(vergleichen(k, soll, toleranz))));
    if (tests.some((t) => t.ok)) return { art: "ok", wert: x };
    if (sollListe.some((soll) => vergleichen(x / 100, soll, toleranz).ok || vergleichen(x * 100, soll, toleranz).ok)) {
      return { art: "faktor100", wert: x };
    }
    return { art: tests.some((t) => t.knapp) ? "knapp" : "falsch", wert: x };
  }

  const ZAHL_TEXTE = {
    leer: "Gib eine Zahl ein. Komma oder Punkt sind beide erlaubt, Brüche wie 1/4 und Prozent wie 25% auch.",
    faktor100: "✗ Die Ziffern stimmen, der Faktor 100 nicht. Prozent oder Dezimalzahl?",
    knapp: "✗ Knapp daneben. Prüfe die Rundung und die Zwischenresultate.",
    falsch: "✗ Das stimmt noch nicht.",
  };

  /* ---------- Logikformeln: lesen, anzeigen, vergleichen ---------- */

  // Zeichen und ihre ASCII-Ersatzschreibweisen (längste zuerst)
  const LOGIK_ZEICHEN = [
    ["<->", "aeq"], ["<=>", "aeq"], ["->", "impl"], ["=>", "impl"], ["&&", "und"], ["||", "oder"],
    ["/\\", "und"], ["\\/", "oder"], ["!=", "ungleich"],
    ["↔", "aeq"], ["⇔", "aeq"], ["→", "impl"], ["⇒", "impl"], ["∧", "und"], ["&", "und"], ["∨", "oder"], ["|", "oder"],
    ["¬", "nicht"], ["!", "nicht"], ["~", "nicht"], ["∀", "alle"], ["∃", "ex"], ["⊤", "wahr"], ["⊥", "falsch"],
    ["≠", "ungleich"], ["=", "gleich"], ["(", "auf"], [")", "zu"], [",", "komma"], [".", "punkt"], [":", "punkt"],
  ];
  const SYMBOL = { aeq: "↔", impl: "→", und: "∧", oder: "∨", nicht: "¬", alle: "∀", ex: "∃", wahr: "⊤", falsch: "⊥" };

  function lesefehler(meldung, stelle) {
    const e = new Error(meldung);
    e.lesefehler = true;
    e.stelle = stelle;
    return e;
  }

  function formelZerlegen(text) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const c = text[i];
      if (/\s/.test(c)) { i++; continue; }
      const z = LOGIK_ZEICHEN.find(([s]) => text.startsWith(s, i));
      if (z) {
        tokens.push({ art: z[1], roh: z[0], pos: i });
        i += z[0].length;
        continue;
      }
      const name = text.slice(i).match(/^[\p{L}_][\p{L}\p{N}_']*/u);
      if (name) {
        const roh = name[0];
        const art = roh === "forall" ? "alle" : roh === "exists" ? "ex" : "name";
        tokens.push({ art: art, roh: roh, pos: i });
        i += roh.length;
        continue;
      }
      const zahl = text.slice(i).match(/^\d+(?:\.\d+)?/);
      if (zahl) {
        tokens.push({ art: "zahl", roh: zahl[0], pos: i });
        i += zahl[0].length;
        continue;
      }
      throw lesefehler("Das Zeichen «" + c + "» an Stelle " + (i + 1) + " kenne ich nicht.", i);
    }
    return tokens;
  }

  // Liest eine Formel der Aussagen- oder Prädikatenlogik.
  // Bindung: ¬ und Quantoren am stärksten, dann ∧, ∨, → (rechtsassoziativ), ↔.
  // Ergebnis: { ok: true, baum } oder { ok: false, fehler, stelle }
  function formelLesen(text) {
    text = String(text === undefined || text === null ? "" : text);
    try {
      const tokens = formelZerlegen(text);
      if (!tokens.length) throw lesefehler("Die Eingabe ist leer.", 0);
      let i = 0;
      const jetzt = () => tokens[i];
      const zeig = (t) => "«" + (SYMBOL[t.art] || t.roh) + "»";
      const istTermStart = (t) => t && (t.art === "name" || t.art === "zahl");
      function fehlt(nach) {
        const t = jetzt();
        if (!t) throw lesefehler("Nach " + zeig(nach) + " fehlt noch eine Teilformel.", text.length);
      }
      function aeq() {
        let a = impl();
        while (jetzt() && jetzt().art === "aeq") {
          const op = tokens[i++];
          fehlt(op);
          a = { t: "aeq", a: a, b: impl() };
        }
        return a;
      }
      function impl() {
        const a = oder();
        if (jetzt() && jetzt().art === "impl") {
          const op = tokens[i++];
          fehlt(op);
          return { t: "impl", a: a, b: impl() };
        }
        return a;
      }
      function oder() {
        let a = und();
        while (jetzt() && jetzt().art === "oder") {
          const op = tokens[i++];
          fehlt(op);
          a = { t: "oder", a: a, b: und() };
        }
        return a;
      }
      function und() {
        let a = unaer();
        while (jetzt() && jetzt().art === "und") {
          const op = tokens[i++];
          fehlt(op);
          a = { t: "und", a: a, b: unaer() };
        }
        return a;
      }
      function unaer() {
        const t = jetzt();
        if (t.art === "nicht") {
          i++;
          fehlt(t);
          return { t: "nicht", a: unaer() };
        }
        if (t.art === "alle" || t.art === "ex") {
          i++;
          const v = jetzt();
          if (!v || v.art !== "name") {
            throw lesefehler("Nach " + zeig(t) + " fehlt eine Variable, zum Beispiel " + SYMBOL[t.art] + "x.", v ? v.pos : text.length);
          }
          i++;
          // «∀P(x)»: direkt angehängte Klammer mit nur Termen = Prädikat statt Variable
          const auf = jetzt();
          if (auf && auf.art === "auf" && auf.pos === v.pos + v.roh.length) {
            let k = i + 1;
            while (tokens[k] && (tokens[k].art === "name" || tokens[k].art === "zahl" || tokens[k].art === "komma")) k++;
            if (k > i + 1 && tokens[k] && tokens[k].art === "zu") {
              throw lesefehler("Nach " + zeig(t) + " fehlt eine Variable: «" + v.roh + "(…)» ist ein Prädikat. Schreib zum Beispiel " +
                SYMBOL[t.art] + "x " + v.roh + "(x).", v.pos);
            }
          }
          const vars = [v.roh];
          while (jetzt() && jetzt().art === "komma" && tokens[i + 1] && tokens[i + 1].art === "name" &&
            !(tokens[i + 2] && tokens[i + 2].art === "auf")) {
            i++;
            vars.push(tokens[i++].roh);
          }
          if (jetzt() && jetzt().art === "punkt") i++;
          if (!jetzt()) throw lesefehler("Nach " + SYMBOL[t.art] + vars.join(", ") + " fehlt noch die Formel.", text.length);
          let rumpf = unaer();
          for (let k = vars.length - 1; k >= 0; k--) rumpf = { t: "quant", q: t.art === "alle" ? "A" : "E", v: vars[k], a: rumpf };
          return rumpf;
        }
        return atom();
      }
      function atom() {
        const t = jetzt();
        if (t.art === "auf") {
          i++;
          if (!jetzt()) throw lesefehler("Die Klammer «(» an Stelle " + (t.pos + 1) + " wird nicht geschlossen.", text.length);
          const f = aeq();
          const z = jetzt();
          if (!z) throw lesefehler("Die Klammer «(» an Stelle " + (t.pos + 1) + " wird nicht geschlossen.", text.length);
          if (z.art !== "zu") throw nachFormel(z);
          i++;
          return f;
        }
        if (t.art === "wahr" || t.art === "falsch") { i++; return { t: "k", w: t.art === "wahr" }; }
        if (istTermStart(t)) {
          const naechstes = tokens[i + 1];
          const vergleich = naechstes && (naechstes.art === "gleich" || naechstes.art === "ungleich");
          if (t.art === "zahl" && (t.roh === "0" || t.roh === "1") && !vergleich) { i++; return { t: "k", w: t.roh === "1" }; }
          const term = termLesen();
          if (jetzt() && (jetzt().art === "gleich" || jetzt().art === "ungleich")) {
            const op = tokens[i++];
            if (!istTermStart(jetzt())) {
              throw lesefehler("Nach «" + (op.art === "gleich" ? "=" : "≠") + "» fehlt ein Term.", jetzt() ? jetzt().pos : text.length);
            }
            const b = termLesen();
            const g = { t: "gleich", a: term, b: b };
            return op.art === "ungleich" ? { t: "nicht", a: g } : g;
          }
          if (term.t === "zahl") throw lesefehler("Die Zahl «" + term.n + "» allein ist keine Formel.", t.pos);
          return { t: "p", n: term.n, args: term.args };
        }
        if (t.art === "zu") throw lesefehler("Die Klammer «)» an Stelle " + (t.pos + 1) + " hat kein Gegenstück.", t.pos);
        throw lesefehler("An Stelle " + (t.pos + 1) + " erwarte ich eine Teilformel, nicht " + zeig(t) + ".", t.pos);
      }
      function termLesen() {
        const t = jetzt();
        if (!istTermStart(t)) {
          throw lesefehler("Hier erwarte ich einen Term (Variable, Konstante oder f(x)).", t ? t.pos : text.length);
        }
        i++;
        if (t.art === "zahl") return { t: "zahl", n: t.roh };
        if (jetzt() && jetzt().art === "auf") {
          const auf = tokens[i++];
          const args = [termLesen()];
          while (jetzt() && jetzt().art === "komma") { i++; args.push(termLesen()); }
          if (!jetzt() || jetzt().art !== "zu") {
            throw lesefehler("Nach den Argumenten von «" + t.roh + "(» an Stelle " + (auf.pos + 1) + " fehlt «)».",
              jetzt() ? jetzt().pos : text.length);
          }
          i++;
          return { t: "term", n: t.roh, args: args };
        }
        return { t: "term", n: t.roh, args: [] };
      }
      // Fehler für ein Token, das nach einer vollständigen Teilformel steht
      function nachFormel(z) {
        if (z.art === "zu") return lesefehler("Die Klammer «)» an Stelle " + (z.pos + 1) + " hat kein Gegenstück.", z.pos);
        if (istTermStart(z) || z.art === "auf" || z.art === "nicht" || z.art === "alle" || z.art === "ex" || z.art === "wahr" || z.art === "falsch") {
          return lesefehler("Vor " + zeig(z) + " an Stelle " + (z.pos + 1) + " fehlt ein Junktor (∧, ∨, →, ↔).", z.pos);
        }
        return lesefehler("Unerwartetes " + zeig(z) + " an Stelle " + (z.pos + 1) + ".", z.pos);
      }
      const baum = aeq();
      if (i < tokens.length) throw nachFormel(tokens[i]);
      return { ok: true, baum: baum };
    } catch (e) {
      if (e && e.lesefehler) return { ok: false, fehler: e.message, stelle: e.stelle };
      throw e;
    }
  }

  const BINAER = { und: "∧", oder: "∨", impl: "→", aeq: "↔" };

  // Formel als Liste von Teilen [text, art] mit klärenden Klammern.
  // art: "op", "q", "v" (Variable), "c" (Konstante), "fn", "p" (Prädikat), "a" (Aussagenvariable), "k" (⊤/⊥), ""
  // «folgt»: Nach diesem Teil steht noch etwas auf gleicher Klammerebene. Ein Quantor bekommt dann
  // Klammern, damit seine Reichweite sichtbar ist: (∀x P(x)) → Q(x).
  function formelTeile(baum) {
    const teile = [];
    const push = (text, art) => teile.push([text, art || ""]);
    function klammerNoetig(kind, eltern, seite, folgt) {
      if (kind.t === "quant") return folgt;
      if (!BINAER[kind.t]) return false;
      if (eltern.t === "nicht" || eltern.t === "quant") return true;
      if (kind.t === eltern.t) {
        if (kind.t === "und" || kind.t === "oder") return false;
        if (kind.t === "impl") return seite === "a";
        return true;
      }
      return true;
    }
    function teil(kind, eltern, seite, gebunden, folgt) {
      if (klammerNoetig(kind, eltern, seite, folgt)) { push("("); f(kind, gebunden, false); push(")"); }
      else f(kind, gebunden, folgt);
    }
    function term(t, gebunden) {
      if (t.t === "zahl") { push(t.n, "c"); return; }
      if (t.args.length) {
        push(t.n, "fn");
        push("(");
        t.args.forEach((a, k) => { if (k) push(", "); term(a, gebunden); });
        push(")");
        return;
      }
      push(t.n, gebunden.indexOf(t.n) >= 0 || /^[u-z]\d*'*$/.test(t.n) ? "v" : "c");
    }
    function f(b, gebunden, folgt) {
      switch (b.t) {
        case "k": push(b.w ? "⊤" : "⊥", "k"); break;
        case "p":
          if (!b.args.length) { push(b.n, "a"); break; }
          push(b.n, "p");
          push("(");
          b.args.forEach((a, k) => { if (k) push(", "); term(a, gebunden); });
          push(")");
          break;
        case "gleich": term(b.a, gebunden); push(" = ", "op"); term(b.b, gebunden); break;
        case "nicht":
          if (b.a.t === "gleich") { term(b.a.a, gebunden); push(" ≠ ", "op"); term(b.a.b, gebunden); break; }
          push("¬", "op");
          teil(b.a, b, "a", gebunden, folgt);
          break;
        case "quant": {
          push(b.q === "A" ? "∀" : "∃", "q");
          push(b.v, "v");
          const innen = gebunden.concat([b.v]);
          if (b.a.t !== "quant") push(" ");
          // Direkt verschachtelte Quantoren (∀x∀y) teilen sich die Klammer des äussersten
          teil(b.a, b, "a", innen, b.a.t === "quant" ? false : folgt);
          break;
        }
        default:
          teil(b.a, b, "a", gebunden, true);
          push(" " + BINAER[b.t] + " ", "op");
          teil(b.b, b, "b", gebunden, folgt);
      }
    }
    f(baum, [], false);
    return teile;
  }

  function formelText(baum) {
    return formelTeile(baum).map((t) => t[0]).join("");
  }

  // Kommt etwas aus der Prädikatenlogik vor (Quantor, Prädikat mit Argumenten, Gleichheit)?
  function istAussagenlogisch(baum) {
    switch (baum.t) {
      case "k": return true;
      case "p": return baum.args.length === 0;
      case "nicht": return istAussagenlogisch(baum.a);
      case "quant": case "gleich": return false;
      default: return istAussagenlogisch(baum.a) && istAussagenlogisch(baum.b);
    }
  }

  function aussagenVariablen(baum, menge) {
    menge = menge || new Set();
    if (baum.t === "p" && !baum.args.length) menge.add(baum.n);
    if (baum.a && baum.t !== "gleich") aussagenVariablen(baum.a, menge);
    if (baum.b && baum.t !== "gleich") aussagenVariablen(baum.b, menge);
    return menge;
  }

  function formelWert(baum, belegung) {
    switch (baum.t) {
      case "k": return baum.w;
      case "p": return !!belegung[baum.n];
      case "nicht": return !formelWert(baum.a, belegung);
      case "und": return formelWert(baum.a, belegung) && formelWert(baum.b, belegung);
      case "oder": return formelWert(baum.a, belegung) || formelWert(baum.b, belegung);
      case "impl": return !formelWert(baum.a, belegung) || formelWert(baum.b, belegung);
      case "aeq": return formelWert(baum.a, belegung) === formelWert(baum.b, belegung);
      default: throw new Error("Nur Aussagenlogik auswertbar.");
    }
  }

  const sortiertDeutsch = (a, b) => a.localeCompare(b, "de");

  // Wahrheitstafel über die Vereinigung der Variablen. Ergebnis:
  // { gleich, variablen, gegenbeispiel: { belegung, wertA, wertB } | null }
  function aequivalent(a, b) {
    const vars = Array.from(new Set([...aussagenVariablen(a), ...aussagenVariablen(b)])).sort(sortiertDeutsch);
    if (vars.length > 14) throw new Error("Zu viele Variablen für eine Wahrheitstafel.");
    for (let m = 0; m < 1 << vars.length; m++) {
      const bel = {};
      vars.forEach((v, k) => { bel[v] = !!(m & (1 << (vars.length - 1 - k))); });
      const wa = formelWert(a, bel), wb = formelWert(b, bel);
      if (wa !== wb) return { gleich: false, variablen: vars, gegenbeispiel: { belegung: bel, wertA: wa, wertB: wb } };
    }
    return { gleich: true, variablen: vars, gegenbeispiel: null };
  }

  // Glieder einer Kette gleicher Junktoren: A ∧ (B ∧ C) → [A, B, C]
  function glieder(b, op) {
    return b.t === op ? glieder(b.a, op).concat(glieder(b.b, op)) : [b];
  }
  const istAtom = (b) => b.t === "p" && !b.args.length;
  const istLiteral = (b) => istAtom(b) || b.t === "k" || (b.t === "nicht" && istAtom(b.a));
  function enthaelt(b, pruef) {
    if (pruef(b)) return true;
    return !!((b.a && b.t !== "gleich" && enthaelt(b.a, pruef)) || (b.b && b.t !== "gleich" && enthaelt(b.b, pruef)));
  }

  const FORM_NAMEN = { knf: "KNF", dnf: "DNF", nnf: "NNF", horn: "Hornform" };

  // Prüft eine aussagenlogische Formel auf KNF, DNF, NNF oder Hornform.
  // Ergebnis: { ok, grund } (grund: kurzer Satz, warum die Form noch nicht stimmt)
  function formPruefen(baum, form) {
    const knf = (b) => glieder(b, "und").every((k) => glieder(k, "oder").every(istLiteral));
    const dnf = (b) => glieder(b, "oder").every((k) => glieder(k, "und").every(istLiteral));
    const nnf = (b) => istLiteral(b) || ((b.t === "und" || b.t === "oder") && nnf(b.a) && nnf(b.b));
    const positiv = (l) => istAtom(l) || (l.t === "k" && l.w);
    const hornKlausel = (k) => {
      const l = glieder(k, "oder");
      return l.every(istLiteral) && l.filter(positiv).length <= 1;
    };
    // Implikationsform: A ∧ B → C, ⊤ → C, A ∧ B → ⊥
    const hornImpl = (k) => k.t === "impl" && (istAtom(k.b) || k.b.t === "k") &&
      glieder(k.a, "und").every((x) => istAtom(x) || x.t === "k");
    let ok;
    if (form === "knf") ok = knf(baum);
    else if (form === "dnf") ok = dnf(baum);
    else if (form === "nnf") ok = nnf(baum);
    else if (form === "horn") ok = glieder(baum, "und").every((k) => hornKlausel(k) || hornImpl(k));
    else throw new Error("Unbekannte Form «" + form + "».");
    if (ok) return { ok: true, grund: "" };

    const pfeil = form === "horn"
      ? glieder(baum, "und").some((k) => !hornImpl(k) && enthaelt(k, (x) => x.t === "impl" || x.t === "aeq"))
      : enthaelt(baum, (x) => x.t === "impl" || x.t === "aeq");
    let grund;
    if (pfeil) grund = "Es kommen noch → oder ↔ vor. Löse sie zuerst auf.";
    else if (enthaelt(baum, (x) => x.t === "nicht" && !istAtom(x.a))) grund = "Ein ¬ steht noch vor einer Klammer. Zieh es mit De Morgan nach innen.";
    else if (form === "knf") grund = "Aussen müssen ∧ stehen, innen nur ∨ zwischen Literalen.";
    else if (form === "dnf") grund = "Aussen müssen ∨ stehen, innen nur ∧ zwischen Literalen.";
    else if (form === "horn") {
      grund = knf(baum)
        ? "Mindestens eine Klausel hat mehr als ein positives Literal."
        : "Eine Hornformel ist eine KNF: aussen ∧, innen ∨ zwischen Literalen.";
    } else grund = "In der NNF stehen nur ∧, ∨ und ¬ direkt vor Variablen.";
    return { ok: false, grund: grund };
  }

  // Kanonische Form für den Mustervergleich: Klammern über den Baum, ∧/∨/↔/= ohne Reihenfolge,
  // gebundene Variablen nach Tiefe des Quantors (Umbenennung egal), gleiche Quantoren hintereinander ohne Reihenfolge.
  function permutationen(liste) {
    if (liste.length <= 1) return [liste];
    const aus = [];
    liste.forEach((x, k) => permutationen(liste.slice(0, k).concat(liste.slice(k + 1))).forEach((p) => aus.push([x].concat(p))));
    return aus;
  }
  function kanonisch(baum) {
    // Aufwandsgrenze: verschachtelte Quantorblöcke vervielfachen die Reihenfolgen (bis 24 je Block).
    // Ist das Budget aufgebraucht, gilt nur noch die geschriebene Reihenfolge, damit lange Eingaben den Tab nicht einfrieren.
    let budget = 5000;
    function term(t, bindung) {
      if (t.t === "zahl") return "z:" + Number(t.n);
      if (!t.args.length && bindung.has(t.n)) return "#" + bindung.get(t.n);
      return "c:" + t.n + (t.args.length ? "(" + t.args.map((a) => term(a, bindung)).join(",") + ")" : "");
    }
    function f(b, tiefe, bindung) {
      switch (b.t) {
        case "k": return b.w ? "⊤" : "⊥";
        case "p": return "p:" + b.n + "(" + b.args.map((a) => term(a, bindung)).join(",") + ")";
        case "gleich": return "=(" + [term(b.a, bindung), term(b.b, bindung)].sort().join(",") + ")";
        case "nicht": return "¬" + f(b.a, tiefe, bindung);
        case "und": case "oder":
          return "(" + glieder(b, b.t).map((x) => f(x, tiefe, bindung)).sort().join(b.t === "und" ? "∧" : "∨") + ")";
        case "impl": return "(" + f(b.a, tiefe, bindung) + "→" + f(b.b, tiefe, bindung) + ")";
        case "aeq": return "(" + [f(b.a, tiefe, bindung), f(b.b, tiefe, bindung)].sort().join("↔") + ")";
        case "quant": {
          const vars = [];
          let rumpf = b;
          while (rumpf.t === "quant" && rumpf.q === b.q && vars.length < 4) { vars.push(rumpf.v); rumpf = rumpf.a; }
          let best = null;
          const reihen = budget > 0 ? permutationen(vars.map((_, k) => k)) : [vars.map((_, k) => k)];
          budget -= reihen.length;
          reihen.forEach((p) => {
            const neu = new Map(bindung);
            vars.forEach((v, k) => neu.set(v, tiefe + p[k]));
            const s = f(rumpf, tiefe + vars.length, neu);
            if (best === null || s < best) best = s;
          });
          return b.q + vars.length + "[" + best + "]";
        }
      }
      return "?";
    }
    return f(baum, 0, new Map());
  }

  // Namen freier Terme ohne Argumente (Variablen ohne Quantor oder Konstanten)
  function freieNamen(baum) {
    const frei = new Set();
    function term(t, gebunden) {
      if (t.t !== "term") return;
      if (!t.args.length) { if (gebunden.indexOf(t.n) < 0) frei.add(t.n); }
      else t.args.forEach((a) => term(a, gebunden));
    }
    function f(b, gebunden) {
      if (b.t === "p") b.args.forEach((a) => term(a, gebunden));
      else if (b.t === "gleich") { term(b.a, gebunden); term(b.b, gebunden); }
      else if (b.t === "quant") f(b.a, gebunden.concat([b.v]));
      else { if (b.a) f(b.a, gebunden); if (b.b) f(b.b, gebunden); }
    }
    f(baum, []);
    return frei;
  }

  // Prädikate mit Stelligkeit: Map name → Anzahl Argumente
  function praedikate(baum, karte) {
    karte = karte || new Map();
    if (baum.t === "p") karte.set(baum.n, baum.args.length);
    else if (baum.t !== "gleich") { if (baum.a) praedikate(baum.a, karte); if (baum.b) praedikate(baum.b, karte); }
    return karte;
  }

  // Quantor mit Junktor direkt darunter: "A:und", "E:impl" …
  function quantorJunktoren(baum, menge) {
    menge = menge || new Set();
    if (baum.t === "quant") {
      let r = baum.a;
      while (r.t === "quant" && r.q === baum.q) r = r.a;
      menge.add(baum.q + ":" + r.t);
    }
    if (baum.a && baum.t !== "gleich") quantorJunktoren(baum.a, menge);
    if (baum.b && baum.t !== "gleich") quantorJunktoren(baum.b, menge);
    return menge;
  }

  // Eingabe gegen akzeptierte Formeln vergleichen (Modus «muster»). Ergebnis: { gleich, hinweis }
  function musterVergleichen(eingabe, loesungen) {
    const k = kanonisch(eingabe);
    if (loesungen.some((l) => kanonisch(l) === k)) return { gleich: true, hinweis: "" };
    const soll = praedikate(loesungen[0]);
    const ist = praedikate(eingabe);
    for (const [name, stellen] of ist) {
      if (!loesungen.some((l) => praedikate(l).has(name))) {
        return { gleich: false, hinweis: (stellen ? "Das Prädikat «" : "Das Symbol «") + name + "» kommt in der Lösung nicht vor. Prüfe die Namen aus dem Wörterbuch." };
      }
      if (soll.has(name) && soll.get(name) !== stellen) {
        return { gleich: false, hinweis: "«" + name + "» hat in der Lösung " + soll.get(name) + (soll.get(name) === 1 ? " Argument" : " Argumente") + ", bei dir " + stellen + "." };
      }
    }
    const freiSoll = new Set();
    loesungen.forEach((l) => freieNamen(l).forEach((n) => freiSoll.add(n)));
    const freiZuViel = Array.from(freieNamen(eingabe)).filter((n) => !freiSoll.has(n));
    if (freiZuViel.length) {
      return { gleich: false, hinweis: "«" + freiZuViel[0] + "» ist bei dir nicht durch einen Quantor gebunden. Fehlt ein Quantor oder eine Klammer?" };
    }
    const qIst = quantorJunktoren(eingabe);
    const qSoll = new Set();
    loesungen.forEach((l) => quantorJunktoren(l).forEach((x) => qSoll.add(x)));
    if (qIst.has("A:und") && !qSoll.has("A:und")) return { gleich: false, hinweis: "Typischer Fehler: Nach ∀ folgt meist →, nicht ∧." };
    if (qIst.has("E:impl") && !qSoll.has("E:impl")) return { gleich: false, hinweis: "Typischer Fehler: Nach ∃ folgt meist ∧, nicht →." };
    return { gleich: false, hinweis: "" };
  }

  /* ---------- Kurzantworten: Text, Mengen, Hypothesen ---------- */

  const ANFUEHRUNG = /["'«»„“”‚‘’`´]/g;

  function textNormal(text) {
    return String(text === undefined || text === null ? "" : text)
      .normalize("NFC").toLowerCase().replace(ANFUEHRUNG, "").replace(/\s+/g, "").replace(/\.+$/, "");
  }

  // Menge lesen: {1, 3, 5}, verschachtelt {{A, ¬B}, {C}}, Tupel (1, 2), leer {} ∅ □.
  // Ergebnis: { ok, wert (kanonischer Text), baum } oder { ok: false, fehler }
  function mengeLesen(text, optionen) {
    const grossKlein = !!(optionen && optionen.grossKlein);
    const s = String(text === undefined || text === null ? "" : text);
    let pos = 0;
    const leer = () => { while (pos < s.length && /\s/.test(s[pos])) pos++; };
    function atomNormal(roh) {
      let a = roh.replace(/\s+/g, "").replace(/^[!~]+/, (m) => "¬".repeat(m.length)).replace(ANFUEHRUNG, "");
      const z = zahlLesen(a);
      if (/\d/.test(a) && Number.isFinite(z) && !/^[¬]/.test(a)) return "z:" + z;
      if (!grossKlein) a = a.toLowerCase();
      return a;
    }
    function element() {
      leer();
      const c = s[pos];
      if (c === undefined) throw lesefehler("Hier fehlt noch ein Element oder eine schliessende Klammer.", pos);
      if (c === "{" || c === "(") {
        const zu = c === "{" ? "}" : ")";
        const start = pos++;
        const kinder = [];
        leer();
        if (s[pos] === zu) { pos++; return { art: c === "{" ? "menge" : "tupel", kinder: kinder }; }
        for (;;) {
          kinder.push(element());
          leer();
          if (s[pos] === ",") { pos++; continue; }
          if (s[pos] === zu) { pos++; break; }
          if (pos >= s.length) throw lesefehler("Die Klammer «" + c + "» an Stelle " + (start + 1) + " wird nicht geschlossen.", pos);
          throw lesefehler("An Stelle " + (pos + 1) + " erwarte ich ein Komma oder «" + zu + "», nicht «" + s[pos] + "».", pos);
        }
        return { art: c === "{" ? "menge" : "tupel", kinder: kinder };
      }
      if (c === "∅" || c === "□") { pos++; return { art: "menge", kinder: [] }; }
      if (c === "," || c === "}" || c === ")") throw lesefehler("An Stelle " + (pos + 1) + " fehlt ein Element.", pos);
      const start = pos;
      while (pos < s.length && ",{}()".indexOf(s[pos]) < 0) pos++;
      const roh = s.slice(start, pos).trim();
      if (!roh) throw lesefehler("An Stelle " + (start + 1) + " fehlt ein Element.", start);
      if (/[\p{L}\p{N}]\s+[\p{L}\p{N}]/u.test(roh.replace(/([¬!~])\s+/g, "$1"))) {
        throw lesefehler("In «" + roh + "» fehlt ein Komma zwischen zwei Elementen.", start);
      }
      return { art: "atom", wert: atomNormal(roh) };
    }
    function kanon(e) {
      if (e.art === "atom") return e.wert;
      const k = e.kinder.map(kanon);
      if (e.art === "tupel") return "(" + k.join(",") + ")";
      return "{" + Array.from(new Set(k)).sort().join(",") + "}";
    }
    try {
      leer();
      if (pos >= s.length) throw lesefehler("Die Eingabe ist leer.", 0);
      const baum = element();
      leer();
      if (pos < s.length) {
        if (s[pos] === ",") throw lesefehler("Schreib die Menge mit geschweiften Klammern, zum Beispiel {1, 3, 5}.", pos);
        throw lesefehler("Nach dem Ende an Stelle " + pos + " steht noch «" + s.slice(pos, pos + 8) + "».", pos);
      }
      return { ok: true, wert: kanon(baum), baum: baum, kinder: baum.art === "menge" ? Array.from(new Set(baum.kinder.map(kanon))) : null };
    } catch (e) {
      if (e && e.lesefehler) return { ok: false, fehler: e.message, stelle: e.stelle };
      throw e;
    }
  }

  // Hypothesen lesen: «H0: μ ≤ 50; H1: μ > 50». Zeichen auch als <=, >=, !=, <>; μ als mu, σ als sigma.
  // Ergebnis: { ok, liste: [{ h, links, op, rechts, text }] } oder { ok: false, fehler }
  const SPIEGEL = { "≤": "≥", "≥": "≤", "<": ">", ">": "<", "=": "=", "≠": "≠" };
  function hypotheseLesen(text) {
    let t = String(text === undefined || text === null ? "" : text).normalize("NFC").toLowerCase();
    t = t.replace(/µ/g, "μ").replace(/₀/g, "0").replace(/₁/g, "1").replace(/²/g, "^2").replace(/_/g, "")
      .replace(/sigma/g, "σ").replace(/mu/g, "μ")
      .replace(/<=|=<|≦|⩽/g, "≤").replace(/>=|=>|≧|⩾/g, "≥").replace(/!=|<>|=\/=|≠/g, "≠");
    const teile = t.split(/[;\n]|,(?!\d)|(?<!\d),|\bund\b/).map((x) => x.replace(/\s+/g, "")).filter(Boolean);
    if (!teile.length) return { ok: false, fehler: "Die Eingabe ist leer." };
    const liste = [];
    for (const teil of teile) {
      const m = teil.match(/^(?:h([01a]))?:?(.+?)(≤|≥|≠|<|>|=)(.+)$/);
      if (!m || /[≤≥≠<>=]/.test(m[4])) {
        return { ok: false, fehler: "«" + teil + "» kann ich nicht lesen. Schreib zum Beispiel H0: μ ≤ 50." };
      }
      const h = m[1] === undefined ? "" : m[1] === "a" ? "h1" : "h" + m[1];
      const zahl = (x) => {
        const z = zahlLesen(x);
        return /\d/.test(x) && Number.isFinite(z) ? String(z) : x;
      };
      let links = zahl(m[2]), op = m[3], rechts = zahl(m[4]);
      // «50 ≥ μ» wie «μ ≤ 50»
      if (/^-?[\d.]+$/.test(links) && !/^-?[\d.]+$/.test(rechts)) { const x = links; links = rechts; rechts = x; op = SPIEGEL[op]; }
      liste.push({ h: h, links: links, op: op, rechts: rechts, text: h + ":" + links + op + rechts });
    }
    return { ok: true, liste: liste };
  }

  // Vergleich zweier gelesener Hypothesen-Listen. Ergebnis: { gleich, hinweis }
  function hypothesenVergleichen(ist, soll) {
    const schluessel = (l, f) => l.map(f).sort().join("|");
    const voll = (x) => x.text;
    if (schluessel(ist, voll) === schluessel(soll, voll)) return { gleich: true, hinweis: "" };
    const tausch = (x) => (x.h === "h0" ? "h1" : x.h === "h1" ? "h0" : "") + ":" + x.links + x.op + x.rechts;
    if (schluessel(ist, tausch) === schluessel(soll, voll)) return { gleich: false, hinweis: "H0 und H1 sind vertauscht." };
    const ohneH = (x) => x.links + x.op + x.rechts;
    if (ist.some((x) => !x.h) && schluessel(ist, ohneH) === schluessel(soll, ohneH)) {
      return { gleich: false, hinweis: "Schreib dazu, welche Hypothese das ist: H0 oder H1." };
    }
    const ohneOp = (x) => x.h + ":" + x.links + "?" + x.rechts;
    if (schluessel(ist, ohneOp) === schluessel(soll, ohneOp)) return { gleich: false, hinweis: "Prüfe das Vergleichszeichen." };
    if (ist.length !== soll.length) {
      return { gleich: false, hinweis: "Gesucht " + (soll.length === 1 ? "ist eine Hypothese" : "sind " + soll.length + " Hypothesen") + ", du hast " + ist.length + " geschrieben." };
    }
    return { gleich: false, hinweis: "" };
  }

  const AUSWERTUNG = {
    zahlLesen: zahlLesen,
    zahlText: zahlText,
    zahlBewerten: zahlBewerten,
    formelLesen: formelLesen,
    formelText: formelText,
    formelTeile: formelTeile,
    istAussagenlogisch: istAussagenlogisch,
    aequivalent: aequivalent,
    formPruefen: formPruefen,
    kanonisch: kanonisch,
    musterVergleichen: musterVergleichen,
    textNormal: textNormal,
    mengeLesen: mengeLesen,
    hypotheseLesen: hypotheseLesen,
    hypothesenVergleichen: hypothesenVergleichen,
  };

  // Unter Node (Tests): nur die Auswertung bereitstellen, kein DOM anfassen
  if (typeof window === "undefined") {
    if (typeof module === "object" && module && module.exports) module.exports = AUSWERTUNG;
    return;
  }

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
      kopfHtml("Übung · Rechnen", cfg) +
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
      const urteil = zahlBewerten(feld.value, sollListe, cfg.toleranz);
      feld.classList.remove("richtig");
      if (urteil.art === "leer") {
        feld.setAttribute("aria-invalid", "true");
        rueckmeldung("leer", ZAHL_TEXTE.leer);
        return;
      }
      if (urteil.art === "ok") {
        feld.removeAttribute("aria-invalid");
        feld.classList.add("richtig");
        const genau = cfg.anzeige || zahlText(sollListe[0], 6) + einheit;
        rueckmeldung("ok", "✓ Richtig. Genauer Wert: " + genau);
        return;
      }
      feld.setAttribute("aria-invalid", "true");
      if (urteil.art !== "falsch") rueckmeldung("bad", ZAHL_TEXTE[urteil.art]);
      else {
        const rat = tippsGezeigt < hinweise.length ? " Hol dir einen Tipp." : weg.length ? " Schau dir den Lösungsweg an." : "";
        rueckmeldung("bad", ZAHL_TEXTE.falsch + rat);
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
      kopfHtml("Übung · Schritt für Schritt", cfg) +
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

  /* ---------- ICB-Kennzeichen (für Kopf von Bausteinen) ---------- */

  // «icb» darf Text oder Text-Liste sein: "ICB 4.5.4" oder ["ICB 3.04", "ICB 4.5.11"]
  function icbHtml(icb) {
    const liste = (Array.isArray(icb) ? icb : icb ? [icb] : []).map((x) => String(x).trim()).filter(Boolean);
    if (!liste.length) return "";
    const esc = (s) => s.replace(/[&<>"]/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[z]);
    return '<span class="icb-liste">' + liste.map((x) => '<span class="icb">' + esc(x) + "</span>").join("") + "</span>";
  }

  /* ---------- Baustein: Reflexion (offene Frage mit Musterlösung und Raster) ---------- */

  function reflexion(el, cfg) {
    el = elementHolen(el, "reflexion");
    if (!el) return null;
    cfg = cfg || {};
    if (!cfg.frage || !cfg.musterloesung) {
      console.error("[Lernpfad] reflexion: «frage» und «musterloesung» sind Pflicht.");
      return null;
    }
    const kriterien = (cfg.kriterien || []).map((k) => ({
      text: k && k.text ? k.text : "",
      punkte: k && Number.isFinite(Number(k.punkte)) && Number(k.punkte) >= 0 ? Number(k.punkte) : 1,
    }));
    const maximum = kriterien.reduce((s, k) => s + k.punkte, 0);
    const id = neueId("rf");
    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "reflexion");
    el.innerHTML =
      '<div class="uebung-kopf"><span class="eyebrow">Übung · Offene Frage</span>' + icbHtml(cfg.icb) +
      (cfg.titel ? "<h3>" + cfg.titel + "</h3>" : "") + "</div>" +
      '<div class="rf-frage">' + cfg.frage + "</div>" +
      '<p class="hint">' + (cfg.hinweis || "Schreib zuerst deine eigene Antwort, in Stichworten oder ganzen Sätzen. Vergleiche danach mit der Musterlösung und bewerte dich selbst.") + "</p>" +
      '<div class="rf-eingabe"><label for="' + id + '-feld">Deine Antwort</label>' +
      '<textarea id="' + id + '-feld" class="rf-feld" rows="5" spellcheck="true"></textarea>' +
      '<p class="hint">Bleibt auf dieser Seite. Nichts wird gespeichert oder übermittelt.</p></div>';
    const feld = $(".rf-feld", el);

    const reihe = erzeugen("div", "row");
    const bZeigen = knopf("Musterlösung zeigen", "primary", { "aria-controls": id + "-loesung" });
    const bReset = knopf("Zurücksetzen");
    bReset.hidden = true;
    reihe.append(bZeigen, bReset);

    // Rückfrage, wenn noch nichts geschrieben ist
    const rueckfrage = erzeugen("div", "note rf-rueckfrage");
    rueckfrage.hidden = true;
    rueckfrage.innerHTML = "<p><b>Noch keine Antwort.</b> Wer zuerst selbst formuliert, merkt sich mehr. Willst du die Musterlösung trotzdem ansehen?</p>";
    const rfReihe = erzeugen("div", "row");
    const bOhne = knopf("Ohne Antwort ansehen");
    const bSchreiben = knopf("Zuerst schreiben");
    rfReihe.append(bOhne, bSchreiben);
    rueckfrage.appendChild(rfReihe);

    const loesung = erzeugen("div", "stack rf-loesung");
    loesung.id = id + "-loesung";
    loesung.hidden = true;
    loesung.tabIndex = -1;
    loesung.setAttribute("aria-labelledby", id + "-ml");
    loesung.innerHTML =
      '<div class="rf-muster"><p class="slabel" id="' + id + '-ml">Musterlösung</p><div class="stack">' + cfg.musterloesung + "</div></div>";
    let summe = null;
    if (kriterien.length) {
      const raster = erzeugen("fieldset", "rf-raster");
      raster.innerHTML = "<legend>Selbstbewertung: Was steht in deiner Antwort?</legend>";
      const liste = erzeugen("ul", "rf-kriterien");
      kriterien.forEach((k, i) => {
        const li = erzeugen("li");
        const kid = id + "-k" + i;
        li.innerHTML =
          '<input type="checkbox" id="' + kid + '" value="' + k.punkte + '">' +
          '<label for="' + kid + '"><span class="rf-ktext">' + k.text + '</span> <span class="rf-punkte">' +
          k.punkte + (k.punkte === 1 ? " Punkt" : " Punkte") + "</span></label>";
        liste.appendChild(li);
      });
      raster.appendChild(liste);
      summe = erzeugen("p", "score rf-summe");
      summe.setAttribute("aria-live", "polite");
      raster.appendChild(summe);
      loesung.appendChild(raster);
      liste.addEventListener("change", summeZeigen);
    }
    const ohneHinweis = erzeugen("p", "hint rf-ohne");
    ohneHinweis.hidden = true;
    ohneHinweis.textContent = "Du hast ohne eigene Antwort nachgesehen. Nutze das Raster als Checkliste und versuch die Frage später nochmals.";
    loesung.appendChild(ohneHinweis);

    const ansage = ansageRegion();
    el.append(reihe, rueckfrage, loesung, ansage);

    function summeZeigen() {
      if (!summe) return;
      const p = $$('input[type="checkbox"]', loesung).reduce((s, c) => s + (c.checked ? Number(c.value) : 0), 0);
      summe.textContent = p + " von " + maximum + " Punkten";
    }

    function zeigen(ohneAntwort) {
      ohneHinweis.hidden = !ohneAntwort;
      loesung.hidden = false;
      bReset.hidden = false;
      // Erst den Fokus auf die Musterlösung setzen, dann Knopf und Rückfrage ausblenden
      loesung.focus();
      rueckfrage.hidden = true;
      bZeigen.hidden = true;
      summeZeigen();
      ansage.textContent = "Musterlösung eingeblendet." + (kriterien.length ? " Kreuze an, was deine Antwort enthält." : "");
      formeln(loesung);
    }

    bZeigen.addEventListener("click", () => {
      if (feld.value.trim()) return zeigen(false);
      rueckfrage.hidden = false;
      ansage.textContent = "Noch keine Antwort geschrieben. Ohne Antwort ansehen oder zuerst schreiben?";
      formeln(rueckfrage);
    });
    bOhne.addEventListener("click", () => zeigen(true));
    bSchreiben.addEventListener("click", () => {
      rueckfrage.hidden = true;
      feld.focus();
    });
    feld.addEventListener("input", () => {
      if (feld.value.trim() && !rueckfrage.hidden) {
        if (rueckfrage.contains(document.activeElement)) bZeigen.focus();
        rueckfrage.hidden = true;
      }
    });
    bReset.addEventListener("click", () => {
      feld.value = "";
      $$('input[type="checkbox"]', loesung).forEach((c) => { c.checked = false; });
      loesung.hidden = true;
      rueckfrage.hidden = true;
      bZeigen.hidden = false;
      feld.focus(); // vor dem Ausblenden: Fokus nicht verlieren
      bReset.hidden = true;
      ansage.textContent = "Zurückgesetzt.";
    });
    formeln(el);
    return {
      zeigen: () => zeigen(!feld.value.trim()),
      zuruecksetzen: () => bReset.click(),
    };
  }

  /* ---------- Baustein: Matrix (Karten Feldern zuordnen) ---------- */

  function matrix(el, cfg) {
    el = elementHolen(el, "matrix");
    if (!el) return null;
    cfg = cfg || {};
    const zeilen = (cfg.zeilen || []).map(String);
    const spalten = (cfg.spalten || []).map(String);
    const elemente = cfg.elemente || [];
    if (zeilen.length < 2 || zeilen.length > 5 || spalten.length < 2 || spalten.length > 5 || !elemente.length) {
      console.error("[Lernpfad] matrix: «zeilen» und «spalten» (je 2 bis 5) sowie «elemente» sind Pflicht.");
      return null;
    }
    const achseX = cfg.achseX ? String(cfg.achseX) : "";
    const achseY = cfg.achseY ? String(cfg.achseY) : "";
    const feldnamen = Array.isArray(cfg.feldnamen) ? cfg.feldnamen : [];
    const stufen = Array.isArray(cfg.stufen) ? cfg.stufen : [];
    const STUFEN = ["tief", "mittel", "hoch"];
    // Ziel: [zeile, spalte] als Index ab 0 oder als Beschriftung
    const zielLesen = (z) => {
      if (!Array.isArray(z) || z.length !== 2) return null;
      const r = typeof z[0] === "number" ? z[0] : zeilen.indexOf(String(z[0]));
      const c = typeof z[1] === "number" ? z[1] : spalten.indexOf(String(z[1]));
      return r >= 0 && r < zeilen.length && c >= 0 && c < spalten.length ? [r, c] : null;
    };
    const ziele = elemente.map((it, i) => {
      if (it.ziel === undefined) return null;
      const z = zielLesen(it.ziel);
      if (!z) console.error("[Lernpfad] matrix: Ziel von Element " + (i + 1) + " ist kein Feld der Matrix.");
      return z;
    });
    const mitPruefen = ziele.some(Boolean);
    const feldText = (r, c) =>
      (achseY ? achseY + " " : "") + zeilen[r] + ", " + (achseX ? achseX + " " : "") + spalten[c] +
      (feldnamen[r] && feldnamen[r][c] ? ": " + ohneTags(feldnamen[r][c]) : "") +
      (stufen[r] && STUFEN.indexOf(stufen[r][c]) >= 0 ? ", Stufe " + stufen[r][c] : "");
    const kurzOrt = (r, c) => zeilen[r] + " · " + spalten[c];

    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "matrix");
    el.innerHTML =
      '<div class="uebung-kopf"><span class="eyebrow">Übung · Matrix</span>' + icbHtml(cfg.icb) +
      (cfg.titel ? "<h3>" + cfg.titel + "</h3>" : "") + "</div>" +
      (cfg.frage ? '<div class="mx-frage">' + cfg.frage + "</div>" : "") +
      '<p class="hint">Wähle unten eine Karte, dann ein Feld im Raster. Nach der Wahl springt der Fokus ins Raster: Pfeiltasten bewegen, Enter legt ab, Escape hebt die Wahl auf.</p>';

    // Raster
    const rahmen = erzeugen("div", "mx-rahmen");
    rahmen.style.setProperty("--mx-spalten", String(spalten.length));
    if (achseY) rahmen.appendChild(erzeugen("div", "mx-achse-y", achseY + ' <span aria-hidden="true">↑</span>'));
    else rahmen.classList.add("ohne-achse-y");
    const raster = erzeugen("div", "mx-raster");
    raster.setAttribute("role", "group");
    raster.setAttribute("aria-label", "Raster" + (achseY || achseX ? ": " + [achseY, achseX].filter(Boolean).join(" × ") : ""));
    // Beschriftungen nur fürs Auge: jedes Feld nennt Zeile und Spalte selbst (aria-label)
    const kopfZelle = (klasse, text) => {
      const d = erzeugen("div", "mx-kopf " + klasse, text);
      d.setAttribute("aria-hidden", "true");
      return d;
    };
    const zellen = [];
    zeilen.forEach((zname, r) => {
      raster.appendChild(kopfZelle("mx-zk", zname));
      zellen[r] = [];
      spalten.forEach((_, c) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "mx-feld";
        const stufe = stufen[r] && STUFEN.indexOf(stufen[r][c]) >= 0 ? stufen[r][c] : "";
        if (stufe) b.classList.add("mx-" + stufe);
        b.tabIndex = r === 0 && c === 0 ? 0 : -1;
        b.dataset.r = String(r);
        b.dataset.c = String(c);
        b.innerHTML =
          (feldnamen[r] && feldnamen[r][c] ? '<span class="mx-name" aria-hidden="true">' + feldnamen[r][c] + "</span>" : "") +
          '<span class="mx-marken" aria-hidden="true"></span>';
        b.addEventListener("click", () => feldGewaehlt(r, c));
        b.addEventListener("keydown", (e) => pfeilTaste(e, r, c));
        b.addEventListener("focus", () => rovingSetzen(r, c));
        raster.appendChild(b);
        zellen[r][c] = b;
      });
    });
    raster.appendChild(kopfZelle("mx-ecke", ""));
    spalten.forEach((sname) => raster.appendChild(kopfZelle("mx-sk", sname)));
    rahmen.appendChild(raster);
    if (achseX) rahmen.appendChild(erzeugen("div", "mx-achse-x", achseX + ' <span aria-hidden="true">→</span>'));
    el.appendChild(rahmen);

    // Karten unter dem Raster
    const liste = erzeugen("ul", "mx-karten");
    liste.setAttribute("aria-label", "Karten");
    const karten = elemente.map((it, i) => {
      const li = erzeugen("li", "mx-eintrag");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mx-karte";
      b.setAttribute("aria-pressed", "false");
      b.innerHTML =
        '<span class="mx-nr" aria-hidden="true">' + (i + 1) + "</span>" +
        '<span class="mx-inhalt">' + (it.html || "") + "</span>" +
        '<span class="mx-ort">noch nicht zugeordnet</span>';
      const erkl = erzeugen("p", "mx-erkl");
      erkl.hidden = true;
      li.append(b, erkl);
      liste.appendChild(li);
      b.addEventListener("click", () => karteWaehlen(i));
      b.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && gewaehlt !== null) { e.preventDefault(); karteWaehlen(null); }
      });
      return { li: li, b: b, erkl: erkl };
    });
    el.appendChild(liste);

    const reihe = erzeugen("div", "row");
    const bPruefen = mitPruefen ? knopf("Prüfen", "primary") : null;
    const bReset = knopf("Zurücksetzen");
    if (bPruefen) reihe.appendChild(bPruefen);
    reihe.appendChild(bReset);
    const fb = erzeugen("p", "fb");
    fb.setAttribute("aria-live", "polite");
    el.append(reihe, fb);

    const ort = elemente.map(() => null); // [r, c] oder null
    let gewaehlt = null;
    let roving = [0, 0];

    function rovingSetzen(r, c) {
      zellen[roving[0]][roving[1]].tabIndex = -1;
      roving = [r, c];
      zellen[r][c].tabIndex = 0;
    }
    function pfeilTaste(e, r, c) {
      let nr = r, nc = c;
      if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
      else if (e.key === "ArrowDown") nr = Math.min(zeilen.length - 1, r + 1);
      else if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
      else if (e.key === "ArrowRight") nc = Math.min(spalten.length - 1, c + 1);
      else if (e.key === "Home") nc = 0;
      else if (e.key === "End") nc = spalten.length - 1;
      else if (e.key === "Escape") {
        if (gewaehlt !== null) { e.preventDefault(); karteWaehlen(null); }
        return;
      } else return;
      e.preventDefault();
      rovingSetzen(nr, nc);
      zellen[nr][nc].focus();
    }

    function kartenText(i) {
      return ohneTags(elemente[i].html || "Karte " + (i + 1));
    }

    function feldAnzeigen() {
      zellen.forEach((reiheZ, r) => reiheZ.forEach((b, c) => {
        const drin = ort.map((o, i) => (o && o[0] === r && o[1] === c ? i : -1)).filter((i) => i >= 0);
        $(".mx-marken", b).innerHTML = drin
          .map((i) => {
            const k = karten[i].li;
            const zustand = k.classList.contains("right") ? " right" : k.classList.contains("wrong") ? " wrong" : "";
            const zeichen = zustand === " right" ? "✓" : zustand === " wrong" ? "✗" : "";
            return '<span class="mx-marke' + zustand + '">' + zeichen + (i + 1) + "</span>";
          })
          .join("");
        b.classList.toggle("belegt", drin.length > 0);
        b.setAttribute("aria-label",
          feldText(r, c) + (drin.length ? ". Karten: " + drin.map((i) => i + 1 + " " + kartenText(i)).join("; ") : ". leer"));
      }));
    }

    function karteAnzeigen(i) {
      const k = karten[i];
      const o = ort[i];
      $(".mx-ort", k.b).textContent =
        gewaehlt === i ? "gewählt: jetzt ein Feld wählen" : o ? "Feld: " + kurzOrt(o[0], o[1]) : "noch nicht zugeordnet";
      k.b.setAttribute("aria-pressed", String(gewaehlt === i));
    }

    function karteWaehlen(i) {
      const vorher = gewaehlt;
      gewaehlt = i === vorher ? null : i;
      if (vorher !== null) karteAnzeigen(vorher);
      if (gewaehlt !== null) {
        karteAnzeigen(gewaehlt);
        fb.textContent = "Karte " + (gewaehlt + 1) + " gewählt. Wähle jetzt ein Feld im Raster.";
      } else {
        fb.textContent = "Wahl aufgehoben.";
      }
      el.classList.toggle("mx-waehlt", gewaehlt !== null);
      // Gewählt: Fokus ins Raster (aktuelles Feld), damit Tastatur und Screenreader direkt weitermachen.
      // Aufgehoben aus dem Raster heraus: zurück zur Karte.
      if (gewaehlt !== null) zellen[roving[0]][roving[1]].focus();
      else if (vorher !== null && raster.contains(document.activeElement)) karten[vorher].b.focus();
    }

    function ergebnisLoeschen(i) {
      karten[i].li.classList.remove("right", "wrong");
      karten[i].erkl.hidden = true;
    }

    function feldGewaehlt(r, c) {
      rovingSetzen(r, c);
      if (gewaehlt === null) {
        fb.textContent = "Wähle zuerst unten eine Karte, dann dieses Feld.";
        return;
      }
      const i = gewaehlt;
      ort[i] = [r, c];
      gewaehlt = null;
      el.classList.remove("mx-waehlt");
      ergebnisLoeschen(i);
      karteAnzeigen(i);
      feldAnzeigen();
      const naechste = ort.findIndex((o, j) => o === null && j !== i);
      fb.textContent = "Karte " + (i + 1) + " liegt im Feld " + kurzOrt(r, c) + "." +
        (naechste >= 0 ? " Weiter mit Karte " + (naechste + 1) + "." : " Alle Karten liegen im Raster.");
      if (naechste >= 0) karten[naechste].b.focus();
    }

    function pruefen() {
      let richtig = 0;
      elemente.forEach((it, i) => {
        const z = ziele[i];
        const k = karten[i];
        k.li.classList.remove("right", "wrong");
        if (!z) { k.erkl.hidden = true; return; }
        const o = ort[i];
        let text;
        if (!o) {
          text = '<span class="marke" aria-hidden="true">–</span>Noch nicht zugeordnet. Richtig: ' + kurzOrt(z[0], z[1]) + ".";
        } else if (o[0] === z[0] && o[1] === z[1]) {
          richtig++;
          k.li.classList.add("right");
          text = '<span class="marke" aria-hidden="true">✓</span>Richtig.';
        } else {
          k.li.classList.add("wrong");
          text = '<span class="marke" aria-hidden="true">✗</span>Nicht richtig. Richtig: ' + kurzOrt(z[0], z[1]) + ".";
        }
        k.erkl.innerHTML = text + (it.erklaerung ? " " + it.erklaerung : "");
        k.erkl.hidden = false;
      });
      const anzahl = ziele.filter(Boolean).length;
      feldAnzeigen();
      fb.textContent = richtig + " von " + anzahl + " richtig zugeordnet" + (richtig === anzahl ? " · alles richtig." : ".");
      formeln(liste);
    }

    function zuruecksetzen() {
      ort.fill(null);
      gewaehlt = null;
      el.classList.remove("mx-waehlt");
      elemente.forEach((_, i) => { ergebnisLoeschen(i); karteAnzeigen(i); });
      feldAnzeigen();
      fb.textContent = "Zurückgesetzt.";
    }

    if (bPruefen) bPruefen.addEventListener("click", pruefen);
    bReset.addEventListener("click", zuruecksetzen);
    feldAnzeigen();
    formeln(el);
    return {
      pruefen: pruefen,
      zuruecksetzen: zuruecksetzen,
      stand: () => ort.map((o) => (o ? o.slice() : null)),
    };
  }

  /* ==========================================================================
     Eingabe-Bausteine 1.2.0: formelAufgabe, tabellenAufgabe, lueckenRechnung, kurzAntwort
     Benutzereingaben kommen nur als textContent ins DOM, nie als HTML.
     ========================================================================== */

  const STUFEN = { 1: "Aufwärmen", 2: "Prüfungsniveau", 3: "Knacknuss" };

  // Kopf eines Übungsbausteins; ohne «stufe» genau wie bisher
  function kopfHtml(ueberzeile, cfg) {
    const titel = cfg.titel ? "<h3>" + cfg.titel + "</h3>" : "";
    const stufe = STUFEN[cfg.stufe] ? '<span class="stufe stufe-' + cfg.stufe + '">' + STUFEN[cfg.stufe] + "</span>" : "";
    if (!stufe) return '<div class="uebung-kopf"><span class="eyebrow">' + ueberzeile + "</span>" + titel + "</div>";
    return '<div class="uebung-kopf"><span class="uebung-marken"><span class="eyebrow">' + ueberzeile + "</span>" + stufe + "</span>" + titel + "</div>";
  }

  // Tipps und Lösungsweg wie bei zahlAufgabe. Gibt { rat(), zuruecksetzen() } zurück.
  function hilfenEinbauen(el, hinweise, weg, feld) {
    const hilfen = erzeugen("div", "row za-hilfen");
    const tipps = erzeugen("ul", "tipps");
    tipps.setAttribute("aria-label", "Tipps");
    const wegListe = erzeugen("ol", "loesungsweg");
    wegListe.setAttribute("aria-label", "Lösungsweg");
    wegListe.tabIndex = -1;
    const ansage = ansageRegion();
    el.append(hilfen, tipps, wegListe, ansage);

    const bTipp = knopf("");
    const bWeg = knopf("Lösungsweg: nächster Schritt");
    const bAlles = knopf("Ganzer Lösungsweg");
    if (hinweise.length) hilfen.appendChild(bTipp);
    if (weg.length) hilfen.append(bWeg, bAlles);
    if (!hinweise.length && !weg.length) hilfen.hidden = true;
    let tippsGezeigt = 0, schritteGezeigt = 0;

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
    return {
      rat() {
        return tippsGezeigt < hinweise.length ? " Hol dir einen Tipp." : weg.length ? " Schau dir den Lösungsweg an." : "";
      },
      zuruecksetzen() {
        tipps.innerHTML = "";
        wegListe.innerHTML = "";
        tippsGezeigt = 0;
        schritteGezeigt = 0;
        tippKnopf();
        wegKnoepfe();
      },
    };
  }

  // Rückmeldung nur als Text (enthält Benutzereingaben)
  function textMelden(p, art, text) {
    p.className = "rueckmeldung " + art;
    p.textContent = text;
  }

  /* ---------- Symbolleiste (Einfügen an der Cursorposition) ---------- */

  const SYMBOL_NAMEN = {
    "¬": "nicht", "∧": "und", "∨": "oder", "→": "wenn, dann", "↔": "genau dann, wenn", "∀": "für alle", "∃": "es gibt",
    "(": "Klammer auf", ")": "Klammer zu", "⊤": "wahr", "⊥": "falsch", "{": "Mengenklammer auf", "}": "Mengenklammer zu",
    ",": "Komma", "∅": "leere Menge", "□": "leere Klausel", "μ": "my", "σ": "sigma", "≤": "kleiner gleich", "≥": "grösser gleich",
    "≠": "ungleich", "<": "kleiner", ">": "grösser", "=": "gleich",
  };

  function symbolLeiste(feld, symbole) {
    const leiste = erzeugen("div", "symbolleiste");
    leiste.setAttribute("role", "toolbar");
    leiste.setAttribute("aria-label", "Symbole einfügen");
    leiste.setAttribute("aria-controls", feld.id);
    const knoepfe = symbole.map((s, k) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sym";
      b.textContent = s;
      b.tabIndex = k === 0 ? 0 : -1;
      b.setAttribute("aria-label", (SYMBOL_NAMEN[s] || s) + " (" + s + ") einfügen");
      // Maus und Finger: Fokus und Markierung im Feld lassen
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => {
        const start = typeof feld.selectionStart === "number" ? feld.selectionStart : feld.value.length;
        const ende = typeof feld.selectionEnd === "number" ? feld.selectionEnd : start;
        feld.focus();
        feld.setRangeText(s, start, ende, "end");
        feld.dispatchEvent(new Event("input", { bubbles: true }));
      });
      b.addEventListener("keydown", (e) => {
        let ziel = -1;
        if (e.key === "ArrowRight") ziel = (k + 1) % symbole.length;
        else if (e.key === "ArrowLeft") ziel = (k - 1 + symbole.length) % symbole.length;
        else if (e.key === "Home") ziel = 0;
        else if (e.key === "End") ziel = symbole.length - 1;
        if (ziel < 0) return;
        e.preventDefault();
        knoepfe.forEach((x, j) => { x.tabIndex = j === ziel ? 0 : -1; });
        knoepfe[ziel].focus();
      });
      leiste.appendChild(b);
      return b;
    });
    return leiste;
  }

  /* ---------- Baustein: Formel eintippen ---------- */

  const FORMEL_ERSATZ = [
    [/<->|<=>|<→/g, "↔"], [/->|=>/g, "→"], [/[!~]/g, "¬"], [/¬=/g, "≠"], [/&&?|\/\\/g, "∧"], [/\|\|?|\\\//g, "∨"],
    [/∧∧/g, "∧"], [/∨∨/g, "∨"],
  ];
  const asciiErsetzen = (t) => FORMEL_ERSATZ.reduce((s, [m, z]) => s.replace(m, z), t);

  // Formel als Spans mit Farbcode (nur textContent)
  function formelDom(baum) {
    const box = erzeugen("span", "m fa-formel");
    const KLASSE = { op: "op", q: "q", v: "v", c: "c", fn: "fn", p: "p", a: "fa-atom", k: "q" };
    formelTeile(baum).forEach(([text, art]) => {
      if (!art) { box.appendChild(document.createTextNode(text)); return; }
      const s = document.createElement("span");
      s.className = KLASSE[art] || "";
      s.textContent = art === "op" ? text.trim() : text;
      box.appendChild(s);
    });
    return box;
  }

  function formelAufgabe(el, cfg) {
    el = elementHolen(el, "formelAufgabe");
    if (!el) return null;
    cfg = cfg || {};
    const modus = cfg.modus === "muster" ? "muster" : "aequivalent";
    const roh = [].concat(cfg.loesungen || [], cfg.loesung !== undefined ? [cfg.loesung] : []).filter((x) => typeof x === "string");
    if (!roh.length) {
      console.error("[Lernpfad] formelAufgabe: «loesung» oder «loesungen» (Formel als Text) ist Pflicht.");
      return null;
    }
    const loesungen = [];
    for (const r of roh) {
      const g = formelLesen(r);
      if (!g.ok) {
        console.error("[Lernpfad] formelAufgabe: Lösung «" + r + "» ist nicht lesbar: " + g.fehler);
        return null;
      }
      loesungen.push(g.baum);
    }
    const form = cfg.form ? String(cfg.form).toLowerCase() : "";
    if (form && !FORM_NAMEN[form]) {
      console.error("[Lernpfad] formelAufgabe: «form» muss knf, dnf, nnf oder horn sein.");
      return null;
    }
    if (modus === "aequivalent" && !istAussagenlogisch(loesungen[0])) {
      console.error("[Lernpfad] formelAufgabe: Modus «aequivalent» nur für Aussagenlogik. Für Quantoren modus: \"muster\".");
      return null;
    }
    const symbole = Array.isArray(cfg.symbole) ? cfg.symbole
      : modus === "muster" ? ["¬", "∧", "∨", "→", "↔", "∀", "∃", "(", ")", ","] : ["¬", "∧", "∨", "→", "↔", "(", ")", "⊤", "⊥"];
    const hinweise = cfg.hinweise || [];
    const weg = cfg.loesungsweg || [];
    const id = neueId("fa");

    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "eingabe", "formel-aufgabe");
    el.innerHTML =
      kopfHtml("Übung · Formel", cfg) +
      (cfg.frage ? '<div class="za-frage">' + cfg.frage + "</div>" : "") +
      '<form class="fa-form" novalidate>' +
      '<label for="' + id + '">Deine Formel</label>' +
      '<div class="fa-zeile"><input id="' + id + '" class="formel-feld" type="text" maxlength="300" autocomplete="off" autocapitalize="off" spellcheck="false"' +
      ' aria-describedby="' + id + '-hilfe ' + id + '-fb">' +
      '<button type="submit" class="btn primary">Prüfen</button></div></form>' +
      '<p class="hint" id="' + id + '-hilfe">Tastatur: ! oder ~ für ¬, &amp; für ∧, | für ∨, -&gt; für →, &lt;-&gt; für ↔' +
      (modus === "muster" ? ". ∀ und ∃ über die Knöpfe, Prädikate wie P(x, y)." : ".") + "</p>" +
      '<div class="fa-vorschau"><span class="slabel">So lese ich deine Formel</span><div class="fa-anzeige"></div></div>' +
      '<p class="rueckmeldung" id="' + id + '-fb" aria-live="polite"></p>';

    const form_ = $(".fa-form", el);
    const feld = $(".formel-feld", el);
    const anzeige = $(".fa-anzeige", el);
    const rm = $(".rueckmeldung", el);
    if (symbole.length) form_.after(symbolLeiste(feld, symbole));
    const hilfe = hilfenEinbauen(el, hinweise, weg, feld);

    function vorschau() {
      anzeige.textContent = "";
      const t = feld.value.trim();
      if (!t) { anzeige.appendChild(erzeugen("span", "platzhalter", "noch leer")); return null; }
      const g = formelLesen(t);
      if (!g.ok) { anzeige.appendChild(erzeugen("span", "platzhalter", "noch keine vollständige Formel")); return g; }
      anzeige.appendChild(formelDom(g.baum));
      return g;
    }

    function ersetzenAmCursor() {
      if (cfg.ersetzen === false) return;
      const pos = feld.selectionStart;
      const vorne = asciiErsetzen(feld.value.slice(0, pos));
      const neu = vorne + asciiErsetzen(feld.value.slice(pos));
      if (neu !== feld.value) {
        feld.value = neu;
        feld.setSelectionRange(vorne.length, vorne.length);
      }
    }

    feld.addEventListener("input", (e) => {
      if (feld.getAttribute("aria-invalid")) feld.removeAttribute("aria-invalid");
      feld.classList.remove("richtig");
      // Während einer Komposition (Bildschirmtastatur, IME) nicht eingreifen, sonst doppelte Zeichen; ersetzt wird bei compositionend
      if (!e.isComposing && (!e.inputType || e.inputType.indexOf("insert") === 0)) ersetzenAmCursor();
      vorschau();
    });
    feld.addEventListener("compositionend", () => {
      ersetzenAmCursor();
      vorschau();
    });

    function gegenbeispielText(gb) {
      const bel = Object.keys(gb.belegung).sort(sortiertDeutsch).map((v) => v + " = " + (gb.belegung[v] ? 1 : 0)).join(", ");
      return " Gegenbeispiel: Bei " + (bel || "jeder Belegung") + " ergibt deine Formel " + (gb.wertA ? 1 : 0) + ", die gesuchte " + (gb.wertB ? 1 : 0) + ".";
    }

    form_.addEventListener("submit", (e) => {
      e.preventDefault();
      const g = vorschau();
      feld.classList.remove("richtig");
      if (!g) {
        feld.setAttribute("aria-invalid", "true");
        textMelden(rm, "leer", "Tipp zuerst eine Formel ein.");
        return;
      }
      if (!g.ok) {
        feld.setAttribute("aria-invalid", "true");
        textMelden(rm, "leer", "Die Formel ist noch nicht lesbar: " + g.fehler);
        if (typeof g.stelle === "number") {
          // «stelle» zählt im getrimmten Text: führende Leerzeichen dazuzählen
          const pos = Math.min(feld.value.length, g.stelle + feld.value.length - feld.value.trimStart().length);
          feld.focus();
          feld.setSelectionRange(pos, pos);
        }
        return;
      }
      let ok = false, text;
      if (modus === "aequivalent") {
        if (!istAussagenlogisch(g.baum)) {
          feld.setAttribute("aria-invalid", "true");
          textMelden(rm, "leer", "Hier sind nur Aussagenvariablen, Junktoren, ⊤ und ⊥ gefragt, keine Quantoren oder Prädikate mit Argumenten.");
          return;
        }
        let v;
        try { v = aequivalent(g.baum, loesungen[0]); } catch (fehler) {
          textMelden(rm, "leer", "Deine Formel hat zu viele verschiedene Variablen.");
          return;
        }
        const f = form ? formPruefen(g.baum, form) : { ok: true };
        if (v.gleich && f.ok) {
          ok = true;
          text = "✓ Richtig. Deine Formel ist gleichwertig zur gesuchten" + (form ? " und in " + FORM_NAMEN[form] + "." : ".");
        } else if (v.gleich) {
          text = "✗ Gleichwertig, aber noch nicht in " + FORM_NAMEN[form] + ". " + f.grund;
        } else {
          text = "✗ Das stimmt noch nicht." + (cfg.gegenbeispiel === false ? "" : gegenbeispielText(v.gegenbeispiel)) + hilfe.rat();
        }
      } else {
        const v = musterVergleichen(g.baum, loesungen);
        if (v.gleich) { ok = true; text = "✓ Richtig."; }
        else text = "✗ Das stimmt noch nicht." + (v.hinweis ? " " + v.hinweis : "") + hilfe.rat();
      }
      if (ok) { feld.removeAttribute("aria-invalid"); feld.classList.add("richtig"); }
      else feld.setAttribute("aria-invalid", "true");
      textMelden(rm, ok ? "ok" : "bad", text);
    });

    vorschau();
    formeln(el);
    return {
      pruefen: () => form_.requestSubmit ? form_.requestSubmit() : form_.dispatchEvent(new Event("submit", { cancelable: true })),
      zuruecksetzen() {
        feld.value = "";
        feld.removeAttribute("aria-invalid");
        feld.classList.remove("richtig");
        textMelden(rm, "", "");
        hilfe.zuruecksetzen();
        vorschau();
      },
    };
  }

  /* ---------- Baustein: Tabelle ausfüllen ---------- */

  // Zelle lesen: Text/Zahl = vorgegeben (HTML), Objekt mit «antwort» = Eingabe
  function zellePlan(z) {
    if (z && typeof z === "object" && !Array.isArray(z) && z.antwort !== undefined) {
      const liste = Array.isArray(z.antwort) ? z.antwort : [z.antwort];
      const typ = z.typ === "text" || z.typ === "zahl" ? z.typ : liste.every((x) => typeof x === "number") ? "zahl" : "text";
      const soll = typ === "zahl" ? liste.filter((x) => typeof x === "number" && Number.isFinite(x)) : liste.map(String);
      if (!soll.length) return null;
      return { eingabe: true, typ: typ, soll: soll, toleranz: z.toleranz, anzeige: z.anzeige };
    }
    if (z && typeof z === "object" && !Array.isArray(z)) return { eingabe: false, html: String(z.html === undefined ? "" : z.html), kopf: !!z.kopf };
    return { eingabe: false, html: z === undefined || z === null ? "" : String(z) };
  }

  /* Formel als vorlesbarer Klartext für aria-label: «A \land \lnot B» → «A und nicht B».
     Kein vollständiger TeX-Leser, nur die in Lernseiten üblichen Befehle; Unbekanntes bleibt als Name stehen. */
  const TEX_WORTE = {
    land: " und ", wedge: " und ", lor: " oder ", vee: " oder ", lnot: " nicht ", neg: " nicht ",
    Rightarrow: " impliziert ", rightarrow: " impliziert ", to: " impliziert ", implies: " impliziert ", longrightarrow: " impliziert ",
    Leftrightarrow: " genau dann, wenn ", leftrightarrow: " genau dann, wenn ", Longleftrightarrow: " genau dann, wenn ", iff: " genau dann, wenn ",
    equiv: " äquivalent ", models: " folgt ", le: " ≤ ", leq: " ≤ ", ge: " ≥ ", geq: " ≥ ", lt: " < ", gt: " > ",
    ne: " ≠ ", neq: " ≠ ", approx: " ungefähr ", sim: " verteilt nach ", mid: " gegeben ", cdot: " mal ", times: " mal ",
    pm: " plus minus ", cap: " geschnitten ", cup: " vereinigt ", setminus: " ohne ", in: " Element von ", notin: " nicht Element von ",
    subseteq: " Teilmenge von ", subset: " Teilmenge von ", emptyset: " leere Menge ", varnothing: " leere Menge ",
    forall: " für alle ", exists: " es gibt ", top: " wahr ", bot: " falsch ", infty: " unendlich ",
    sum: " Summe ", Sigma: " Summe ", Delta: " Delta ", Omega: " Omega ", Phi: " Phi ",
    alpha: " alpha ", beta: " beta ", chi: " chi ", delta: " delta ", lambda: " lambda ", mu: " my ", omega: " omega ",
    pi: " pi ", sigma: " sigma ", dots: " … ", cdots: " … ", ldots: " … ", checkmark: " ✓ ",
  };
  const TEX_RAHMEN = /\\(?:text|mathrm|mathbf|mathit|mathbb|mathcal|operatorname|textstyle|displaystyle)\s*\{([^{}]*)\}/g;

  // Makros (auch seiteneigene aus Lernpfad.makros) einsetzen, höchstens ein Argument #1
  function texMakros(t) {
    for (let runde = 0; runde < 4; runde++) {
      let neu = t;
      Object.keys(makros).forEach((name) => {
        const wert = makros[name];
        const muster = name.replace(/\\/g, "\\\\") + "(?![A-Za-z])";
        if (wert.indexOf("#1") >= 0) neu = neu.replace(new RegExp(muster + "\\s*\\{([^{}]*)\\}", "g"), (_, a) => wert.replace(/#1/g, a));
        else neu = neu.replace(new RegExp(muster, "g"), () => wert);
      });
      if (neu === t) break;
      t = neu;
    }
    return t;
  }

  function texLesbar(t) {
    t = texMakros(t)
      .replace(/\\(?:left|right|bigl|bigr|Bigl|Bigr|big|Big)(?![A-Za-z])\s*/g, "")
      .replace(/\\[,;:! ]|\\q?quad(?![A-Za-z])/g, " ")
      .replace(/\\\{/g, "⦃").replace(/\\\}/g, "⦄");
    // Befehle mit Argumenten von innen nach aussen auflösen
    for (let runde = 0; runde < 8; runde++) {
      const vorher = t;
      t = t
        .replace(TEX_RAHMEN, "$1")
        .replace(/\\(?:htmlClass|htmlData)\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, "$1")
        .replace(/\\overset\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, "$1")
        .replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, " $1 durch $2 ")
        .replace(/\\d?binom\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, " $1 über $2 ")
        .replace(/\\sqrt\s*\{([^{}]*)\}/g, " Wurzel aus $1 ")
        .replace(/\\overline\s*\{([^{}]*)\}/g, " nicht $1 ")
        .replace(/\\bar\s*\{([^{}]*)\}/g, " $1 quer ")
        .replace(/\\hat\s*\{([^{}]*)\}/g, " $1 Dach ")
        .replace(/_\s*\{([^{}]*)\}/g, (_, a) => " Index " + a.replace(/\\cdot(?![A-Za-z])/g, " Punkt ") + " ")
        .replace(/\^\s*\{([^{}]*)\}/g, " hoch $1 ");
      if (t === vorher) break;
    }
    return t
      .replace(/_\s*\\cdot(?![A-Za-z])/g, " Index Punkt ")
      .replace(/_\s*(\\?[A-Za-z0-9])/g, " Index $1")
      .replace(/\^\s*(\\?[A-Za-z0-9])/g, " hoch $1")
      .replace(/\\([A-Za-z]+)/g, (_, n) => (TEX_WORTE[n] !== undefined ? TEX_WORTE[n] : " " + n + " "))
      .replace(/[{}]/g, "")
      .replace(/⦃/g, "{").replace(/⦄/g, "}")
      .replace(/\s+/g, " ")
      .replace(/ ([,;)])/g, "$1").replace(/\( /g, "(")
      .trim();
  }

  // Zelleninhalt (HTML mit $…$-Formeln) als Klartext fürs aria-label
  const formelLos = (html) => {
    const text = ohneTags(html);
    return FORMEL_MUSTER.test(text) ? texLesbar(text.replace(/\$\$?|\\[()[\]]/g, "")) : text;
  };

  function tabellenAufgabe(el, cfg) {
    el = elementHolen(el, "tabellenAufgabe");
    if (!el) return null;
    cfg = cfg || {};
    const kopfZeilen = !cfg.kopf ? [] : Array.isArray(cfg.kopf[0]) ? cfg.kopf : [cfg.kopf];
    const zeilen = cfg.zeilen || [];
    if (!zeilen.length) {
      console.error("[Lernpfad] tabellenAufgabe: «zeilen» fehlt.");
      return null;
    }
    const plaene = zeilen.map((z, r) => (Array.isArray(z) ? z : []).map((c, k) => {
      const p = zellePlan(c);
      if (!p) console.error("[Lernpfad] tabellenAufgabe: Zelle " + (r + 1) + "/" + (k + 1) + " hat keine gültige «antwort».");
      return p || { eingabe: false, html: "" };
    }));
    const anzahl = plaene.reduce((s, z) => s + z.filter((p) => p.eingabe).length, 0);
    if (!anzahl) {
      console.error("[Lernpfad] tabellenAufgabe: keine Eingabezelle ({ antwort: … }).");
      return null;
    }
    const spaltenName = (k) => {
      const letzte = kopfZeilen[kopfZeilen.length - 1];
      return letzte && letzte[k] !== undefined ? formelLos(String(letzte[k])) : "Spalte " + (k + 1);
    };
    const hinweise = cfg.hinweise || [];
    const weg = cfg.loesungsweg || [];
    const id = neueId("tb");

    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "eingabe", "tabellen-aufgabe");
    el.innerHTML =
      kopfHtml("Übung · Tabelle", cfg) +
      (cfg.frage ? '<div class="za-frage">' + cfg.frage + "</div>" : "") +
      '<p class="hint">Füll die leeren Felder aus und drück «Prüfen». ' +
      (plaene.some((z) => z.some((p) => p.eingabe && p.typ === "zahl")) ? "Zahlen mit Punkt oder Komma, Brüche wie 1/4 gehen auch." : "") + "</p>";

    const box = erzeugen("div", "tablebox tb-box");
    const tab = erzeugen("table", "tabelle tb-tabelle");
    if (cfg.beschriftung) tab.appendChild(erzeugen("caption", null, cfg.beschriftung));
    if (kopfZeilen.length) {
      const thead = document.createElement("thead");
      kopfZeilen.forEach((reihe) => {
        const tr = document.createElement("tr");
        reihe.forEach((h) => {
          const th = erzeugen("th", null, String(h));
          th.scope = "col";
          tr.appendChild(th);
        });
        thead.appendChild(tr);
      });
      tab.appendChild(thead);
    }
    const tbody = document.createElement("tbody");
    const felder = [];
    plaene.forEach((reihe, r) => {
      const tr = document.createElement("tr");
      // Ohne Zeilenkopf: vorgegebene Zellen vor dem ersten Feld nennen, z. B. «A = 1, B = 0» bei Wahrheitstafeln
      const ersteEingabe = reihe.findIndex((p) => p.eingabe);
      const belegung = reihe.slice(0, Math.min(ersteEingabe, 4))
        .map((p, k) => (p.eingabe || !p.html.trim() ? "" : spaltenName(k) + " = " + formelLos(p.html)))
        .filter((x) => x && !/^Spalte \d+ = $/.test(x));
      const zeilenName = cfg.zeilenKopf && reihe[0] && !reihe[0].eingabe ? formelLos(reihe[0].html)
        : belegung.length ? belegung.join(", ") : "";
      reihe.forEach((p, k) => {
        if (!p.eingabe) {
          const kopfZelle = (cfg.zeilenKopf && k === 0) || p.kopf;
          const c = erzeugen(kopfZelle ? "th" : "td", null, p.html);
          if (kopfZelle) c.scope = "row";
          tr.appendChild(c);
          return;
        }
        const td = erzeugen("td", "tb-zelle");
        const fid = id + "-" + r + "-" + k;
        const inp = document.createElement("input");
        inp.type = "text";
        inp.id = fid;
        inp.className = "tb-feld";
        inp.autocomplete = "off";
        inp.spellcheck = false;
        if (p.typ === "zahl") inp.inputMode = p.soll.some((x) => x < 0) ? "text" : "decimal";
        inp.setAttribute("aria-label", (zeilenName ? zeilenName : "Zeile " + (r + 1)) + ", " + spaltenName(k));
        const marke = erzeugen("span", "marke");
        marke.setAttribute("aria-hidden", "true");
        const status = erzeugen("span", "sr-only");
        status.id = fid + "-status";
        inp.setAttribute("aria-describedby", status.id);
        td.append(inp, marke, status);
        tr.appendChild(td);
        const eintrag = { p: p, td: td, inp: inp, marke: marke, status: status };
        inp.addEventListener("input", () => zelleLeeren(eintrag));
        felder.push(eintrag);
      });
      tbody.appendChild(tr);
    });
    tab.appendChild(tbody);
    box.appendChild(tab);
    const reihe = erzeugen("div", "row");
    const bPruefen = knopf("Prüfen", "primary");
    const bLoesung = knopf("Lösung zeigen");
    const bReset = knopf("Zurücksetzen");
    reihe.append(bPruefen, bLoesung, bReset);
    const stand = erzeugen("p", "score tb-stand");
    stand.setAttribute("aria-live", "polite");
    el.append(box, reihe, stand);
    const hilfe = hilfenEinbauen(el, hinweise, weg, bPruefen);

    function zelleLeeren(f) {
      f.td.classList.remove("richtig", "falsch", "gezeigt");
      f.inp.removeAttribute("aria-invalid");
      f.marke.textContent = "";
      f.status.textContent = "";
    }
    function zelleRichtig(f) {
      const wert = f.inp.value;
      if (!wert.trim()) return null;
      if (f.p.typ === "zahl") return zahlBewerten(wert, f.p.soll, f.p.toleranz).art === "ok";
      const n = textNormal(wert);
      return f.p.soll.some((s) => textNormal(s) === n);
    }
    function loesungText(p) {
      if (p.anzeige !== undefined) return String(p.anzeige);
      return p.typ === "zahl" ? zahlText(p.soll[0], 6) : p.soll[0];
    }

    bPruefen.addEventListener("click", () => {
      let richtig = 0, leer = 0;
      felder.forEach((f) => {
        zelleLeeren(f);
        const ok = f.inp.readOnly ? null : zelleRichtig(f);
        if (f.inp.readOnly) { f.td.classList.add("gezeigt"); f.status.textContent = "Lösung eingetragen"; return; }
        if (ok === null) { leer++; f.marke.textContent = "–"; f.status.textContent = "leer"; return; }
        if (ok) { richtig++; f.td.classList.add("richtig"); f.marke.textContent = "✓"; f.status.textContent = "richtig"; }
        else { f.td.classList.add("falsch"); f.inp.setAttribute("aria-invalid", "true"); f.marke.textContent = "✗"; f.status.textContent = "falsch"; }
      });
      stand.textContent = richtig + " von " + anzahl + " richtig" + (leer ? ", " + leer + " leer" : "") +
        (richtig === anzahl ? " · alles richtig" : richtig + leer < anzahl ? "." + hilfe.rat() : ".");
    });
    bLoesung.addEventListener("click", () => {
      let vorher = 0;
      felder.forEach((f) => {
        const ok = f.inp.readOnly ? false : zelleRichtig(f);
        if (ok) { vorher++; return; }
        zelleLeeren(f);
        f.inp.value = loesungText(f.p);
        f.inp.readOnly = true;
        f.td.classList.add("gezeigt");
        f.status.textContent = "Lösung eingetragen";
      });
      stand.textContent = "Lösung eingetragen. Selbst richtig: " + vorher + " von " + anzahl + ".";
    });
    bReset.addEventListener("click", () => {
      felder.forEach((f) => { zelleLeeren(f); f.inp.value = ""; f.inp.readOnly = false; });
      stand.textContent = "Zurückgesetzt.";
      hilfe.zuruecksetzen();
    });
    formeln(el);
    return { pruefen: () => bPruefen.click(), loesungZeigen: () => bLoesung.click(), zuruecksetzen: () => bReset.click() };
  }

  /* ---------- Baustein: Rechenweg mit Lücken ---------- */

  function lueckenRechnung(el, cfg) {
    el = elementHolen(el, "lueckenRechnung");
    if (!el) return null;
    cfg = cfg || {};
    const schritte = (cfg.schritte || []).map((s, k) => {
      const soll = (Array.isArray(s.antwort) ? s.antwort : [s.antwort]).filter((x) => typeof x === "number" && Number.isFinite(x));
      if (!soll.length) console.error("[Lernpfad] lueckenRechnung: Schritt " + (k + 1) + " braucht eine Zahl als «antwort».");
      return Object.assign({}, s, { soll: soll });
    });
    if (!schritte.length || schritte.some((s) => !s.soll.length)) {
      if (!schritte.length) console.error("[Lernpfad] lueckenRechnung: «schritte» fehlt.");
      return null;
    }
    const id = neueId("lr");
    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "eingabe", "luecken-rechnung");
    el.innerHTML =
      kopfHtml("Übung · Rechenweg", cfg) +
      (cfg.aufgabe ? '<div class="za-frage">' + cfg.aufgabe + "</div>" : "") +
      '<p class="hint">Rechne Schritt für Schritt. Der nächste Schritt öffnet sich, sobald der vorherige stimmt oder aufgedeckt ist.</p>';
    const ol = erzeugen("ol", "lr-schritte");
    const fuss = erzeugen("div", "stepbar");
    const bReset = knopf("Zurücksetzen");
    const zahl = erzeugen("span", "stepcount");
    fuss.append(bReset, zahl);
    const fazit = erzeugen("p", "score lr-fazit");
    fazit.tabIndex = -1;
    fazit.hidden = true;
    const ansage = ansageRegion();
    el.append(ol, fazit, fuss, ansage);

    // Zustand je Schritt: "offen" | "richtig" | "folgerichtig" | "aufgedeckt" | "weiter" (falsch, mit eigenem Wert weiter)
    const zustand = schritte.map(() => "offen");
    const werte = schritte.map(() => NaN);
    let sichtbar = 1;

    const teile = schritte.map((s, k) => {
      const fid = id + "-" + k;
      const li = erzeugen("li", "lr-schritt");
      li.innerHTML =
        '<label class="lr-label" for="' + fid + '">' + (s.label || "Schritt " + (k + 1)) + "</label>" +
        '<form class="za-form row lr-form" novalidate>' +
        '<input id="' + fid + '" class="zahl-feld" type="text" inputmode="' + (s.soll[0] < 0 ? "text" : "decimal") +
        '" autocomplete="off" spellcheck="false" aria-describedby="' + fid + '-fb">' +
        (s.einheit ? '<span class="einheit">' + s.einheit + "</span>" : "") +
        '<button type="submit" class="btn primary">Prüfen</button></form>' +
        '<div class="row lr-knoepfe"></div>' +
        '<p class="rueckmeldung" id="' + fid + '-fb" aria-live="polite"></p>' +
        '<div class="note tipp lr-tipp" hidden></div>' +
        '<div class="explain lr-erkl" hidden></div>';
      const t = {
        li: li,
        form: $("form", li),
        feld: $("input", li),
        pruefen: $('button[type="submit"]', li),
        knoepfe: $(".lr-knoepfe", li),
        rm: $(".rueckmeldung", li),
        tipp: $(".lr-tipp", li),
        erkl: $(".lr-erkl", li),
        bTipp: s.hinweis ? knopf("Tipp") : null,
        bAuf: knopf("Aufdecken"),
        bWeiter: knopf("Mit meinem Wert weiterrechnen"),
      };
      if (t.bTipp) t.knoepfe.appendChild(t.bTipp);
      t.knoepfe.append(t.bAuf, t.bWeiter);
      t.bWeiter.hidden = true;
      li.hidden = k > 0;
      ol.appendChild(li);
      return t;
    });

    function zaehlen() {
      zahl.textContent = "Schritt " + Math.min(sichtbar, schritte.length) + " von " + schritte.length;
    }
    function falscherVorgaenger(k) {
      for (let j = 0; j < k; j++) if (zustand[j] === "weiter") return j;
      return -1;
    }
    // Schritt k abschliessen und den nächsten öffnen; Fokus wandert mit
    function abschliessen(k, neuerZustand, wert) {
      const t = teile[k];
      zustand[k] = neuerZustand;
      werte[k] = wert;
      t.li.classList.add("lr-" + neuerZustand);
      t.feld.readOnly = true;
      const hatteFokus = t.li.contains(document.activeElement);
      if (schritte[k].erklaerung) {
        t.erkl.innerHTML = schritte[k].erklaerung;
        t.erkl.hidden = false;
        formeln(t.erkl);
      }
      if (k + 1 < schritte.length) {
        sichtbar = Math.max(sichtbar, k + 2);
        teile[k + 1].li.hidden = false;
        formeln(teile[k + 1].li);
        if (hatteFokus) teile[k + 1].feld.focus();
        ansage.textContent = "Schritt " + (k + 2) + " von " + schritte.length + " ist offen.";
      } else {
        const z = (x) => zustand.filter((y) => y === x).length;
        fazit.textContent = "Fertig: " + z("richtig") + " von " + schritte.length + " selbst richtig" +
          (z("folgerichtig") ? ", " + z("folgerichtig") + " folgerichtig" : "") +
          (z("weiter") ? ", " + z("weiter") + " falsch" : "") +
          (z("aufgedeckt") ? ", " + z("aufgedeckt") + " aufgedeckt" : "") + ".";
        fazit.hidden = false;
        if (hatteFokus) fazit.focus();
        ansage.textContent = fazit.textContent;
      }
      t.pruefen.disabled = true;
      t.knoepfe.hidden = true;
      zaehlen();
    }

    schritte.forEach((s, k) => {
      const t = teile[k];
      t.form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (zustand[k] !== "offen") return;
        t.bWeiter.hidden = true;
        const urteil = zahlBewerten(t.feld.value, s.soll, s.toleranz);
        if (urteil.art === "leer") {
          t.feld.setAttribute("aria-invalid", "true");
          textMelden(t.rm, "leer", ZAHL_TEXTE.leer);
          return;
        }
        if (urteil.art === "ok") {
          t.feld.removeAttribute("aria-invalid");
          t.feld.classList.add("richtig");
          textMelden(t.rm, "ok", "✓ Richtig.");
          abschliessen(k, "richtig", urteil.wert);
          return;
        }
        // Folgefehler: mit dem eigenen falschen Vorwert richtig weitergerechnet?
        const vorher = falscherVorgaenger(k);
        if (vorher >= 0 && typeof s.folgefehler === "function") {
          let erwartet = NaN;
          try { erwartet = Number(s.folgefehler(werte.slice(0, k))); } catch (fehler) {
            console.error("[Lernpfad] lueckenRechnung: folgefehler von Schritt " + (k + 1) + " ist fehlerhaft:", fehler);
          }
          if (Number.isFinite(erwartet) && zahlBewerten(t.feld.value, [erwartet], s.toleranz).art === "ok") {
            t.feld.removeAttribute("aria-invalid");
            textMelden(t.rm, "ok", "✓ Folgerichtig gerechnet, aber Schritt " + (vorher + 1) + " war falsch. Richtig wäre hier " +
              (s.anzeige || zahlText(s.soll[0], 6)) + ".");
            abschliessen(k, "folgerichtig", urteil.wert);
            return;
          }
        }
        t.feld.setAttribute("aria-invalid", "true");
        const naechster = schritte[k + 1];
        const weiterGeht = !!(naechster && typeof naechster.folgefehler === "function");
        const rat = t.bTipp && t.tipp.hidden ? " Hol dir den Tipp." : " Du kannst den Schritt auch aufdecken.";
        textMelden(t.rm, "bad", ZAHL_TEXTE[urteil.art] + (urteil.art === "falsch" ? rat : "") +
          (weiterGeht ? " Oder rechne mit deinem Wert weiter." : ""));
        if (weiterGeht) {
          t.bWeiter.hidden = false;
          t.wertFalsch = urteil.wert;
        }
      });
      t.feld.addEventListener("input", () => {
        if (t.feld.getAttribute("aria-invalid")) t.feld.removeAttribute("aria-invalid");
        // Wert geändert: «weiterrechnen» gilt erst wieder nach dem nächsten Prüfen
        t.bWeiter.hidden = true;
        t.wertFalsch = undefined;
      });
      if (t.bTipp) {
        t.bTipp.addEventListener("click", () => {
          t.tipp.innerHTML = "<p><b>Tipp:</b> " + s.hinweis + "</p>";
          t.tipp.hidden = false;
          formeln(t.tipp);
          setzeAktiv(t.bTipp, false, [t.bAuf, t.feld]);
          ansage.textContent = "Tipp zu Schritt " + (k + 1) + " angezeigt.";
        });
      }
      t.bAuf.addEventListener("click", () => {
        if (zustand[k] !== "offen") return;
        t.feld.value = s.anzeige ? String(s.anzeige) : zahlText(s.soll[0], 6);
        t.feld.removeAttribute("aria-invalid");
        textMelden(t.rm, "leer", "Aufgedeckt: " + (s.anzeige || zahlText(s.soll[0], 6)) + (s.einheit ? " " + ohneTags(s.einheit) : "") + ".");
        abschliessen(k, "aufgedeckt", s.soll[0]);
      });
      t.bWeiter.addEventListener("click", () => {
        if (zustand[k] !== "offen" || !Number.isFinite(t.wertFalsch)) return;
        textMelden(t.rm, "bad", "✗ Schritt " + (k + 1) + " bleibt falsch. Du rechnest mit deinem Wert " + zahlText(t.wertFalsch, 6) + " weiter.");
        abschliessen(k, "weiter", t.wertFalsch);
      });
    });

    bReset.addEventListener("click", () => {
      zustand.fill("offen");
      werte.fill(NaN);
      sichtbar = 1;
      teile.forEach((t, k) => {
        t.li.className = "lr-schritt";
        t.li.hidden = k > 0;
        t.feld.value = "";
        t.feld.readOnly = false;
        t.feld.removeAttribute("aria-invalid");
        t.feld.classList.remove("richtig");
        t.pruefen.disabled = false;
        t.knoepfe.hidden = false;
        t.bWeiter.hidden = true;
        if (t.bTipp) t.bTipp.disabled = false;
        t.tipp.hidden = true;
        t.erkl.hidden = true;
        textMelden(t.rm, "", "");
      });
      fazit.hidden = true;
      ansage.textContent = "Zurückgesetzt.";
      zaehlen();
    });
    zaehlen();
    formeln(el);
    return { zuruecksetzen: () => bReset.click(), stand: () => zustand.slice() };
  }

  /* ---------- Baustein: Kurzantwort (Text, Menge, Hypothese) ---------- */

  const KURZ = {
    text: { ueberzeile: "Übung · Kurzantwort", symbole: [], format: "" },
    menge: {
      ueberzeile: "Übung · Menge",
      symbole: ["{", "}", ",", "¬", "∅", "□"],
      format: "Schreib die Menge mit geschweiften Klammern, zum Beispiel {1, 3, 5}. Reihenfolge egal. Dezimalzahlen mit Punkt (0.5), denn das Komma trennt Elemente. Für ¬ geht auch ! oder ~, die leere Menge als {} oder ∅.",
    },
    hypothese: {
      ueberzeile: "Übung · Hypothesen",
      symbole: ["μ", "σ", "≤", "≥", "≠", "<", ">", "="],
      format: "Zum Beispiel H0: μ ≤ 50; H1: μ > 50. Statt ≤ geht auch &lt;=, statt ≠ auch !=, statt μ auch mu.",
    },
  };

  function kurzAntwort(el, cfg) {
    el = elementHolen(el, "kurzAntwort");
    if (!el) return null;
    cfg = cfg || {};
    const typ = KURZ[cfg.typ] ? cfg.typ : "text";
    const roh = (Array.isArray(cfg.antwort) ? cfg.antwort : [cfg.antwort]).filter((x) => typeof x === "string" || typeof x === "number").map(String);
    if (!roh.length) {
      console.error("[Lernpfad] kurzAntwort: «antwort» ist Pflicht.");
      return null;
    }
    const opt = { grossKlein: !!cfg.grossKlein };
    let soll;
    if (typ === "menge") soll = roh.map((r) => mengeLesen(r, opt));
    else if (typ === "hypothese") soll = roh.map(hypotheseLesen);
    else soll = roh.map((r) => ({ ok: true, wert: textNormal(r) }));
    const kaputt = soll.findIndex((x) => !x.ok);
    if (kaputt >= 0) {
      console.error("[Lernpfad] kurzAntwort: Antwort «" + roh[kaputt] + "» ist nicht lesbar: " + soll[kaputt].fehler);
      return null;
    }
    const art = KURZ[typ];
    const symbole = Array.isArray(cfg.symbole) ? cfg.symbole : art.symbole;
    const format = cfg.format !== undefined ? cfg.format : art.format;
    const hinweise = cfg.hinweise || [];
    const weg = cfg.loesungsweg || [];
    const id = neueId("ka");

    el.innerHTML = "";
    el.classList.add("card", "stack", "uebung", "eingabe", "kurz-antwort");
    el.innerHTML =
      kopfHtml(art.ueberzeile, cfg) +
      (cfg.frage ? '<div class="za-frage">' + cfg.frage + "</div>" : "") +
      '<form class="fa-form" novalidate>' +
      '<label for="' + id + '">Deine Antwort</label>' +
      '<div class="fa-zeile"><input id="' + id + '" class="kurz-feld" type="text" maxlength="300" autocomplete="off" autocapitalize="off" spellcheck="false"' +
      ' aria-describedby="' + (format ? id + "-hilfe " : "") + id + '-fb">' +
      '<button type="submit" class="btn primary">Prüfen</button></div></form>' +
      (format ? '<p class="hint" id="' + id + '-hilfe">' + format + "</p>" : "") +
      '<p class="rueckmeldung" id="' + id + '-fb" aria-live="polite"></p>';
    const form_ = $(".fa-form", el);
    const feld = $(".kurz-feld", el);
    const rm = $(".rueckmeldung", el);
    if (symbole.length) form_.after(symbolLeiste(feld, symbole));
    const hilfe = hilfenEinbauen(el, hinweise, weg, feld);

    function bewerten(text) {
      if (!text.trim()) return { art: "leer", text: "Gib zuerst eine Antwort ein." };
      if (typ === "text") {
        return soll.some((s) => s.wert === textNormal(text)) ? { art: "ok" } : { art: "bad", text: "" };
      }
      if (typ === "menge") {
        const ist = mengeLesen(text, opt);
        if (!ist.ok) return { art: "leer", text: ist.fehler };
        if (soll.some((s) => s.wert === ist.wert)) return { art: "ok" };
        // «{0,5}» liest sich als {0, 5}: auf den Dezimalpunkt hinweisen
        const kommaHinweis = /\d,\d/.test(text) ? " Ein Komma ohne Leerzeichen zwischen Ziffern trennt zwei Elemente. Für Dezimalzahlen schreib einen Punkt, zum Beispiel 0.5." : "";
        const s0 = soll[0];
        if (s0.kinder && !ist.kinder) return { art: "bad", text: "Gesucht ist eine Menge. Schreib sie mit geschweiften Klammern." };
        if (s0.kinder && ist.kinder) {
          const fehlen = s0.kinder.filter((x) => ist.kinder.indexOf(x) < 0).length;
          const zuViel = ist.kinder.filter((x) => s0.kinder.indexOf(x) < 0).length;
          const teile_ = [];
          if (fehlen) teile_.push(fehlen === 1 ? "Ein Element fehlt" : fehlen + " Elemente fehlen");
          if (zuViel) teile_.push(zuViel === 1 ? "eines ist zu viel" : zuViel + " sind zu viel");
          if (teile_.length) {
            let satz = teile_.join(", ") + ".";
            satz = satz.charAt(0).toUpperCase() + satz.slice(1);
            return { art: "bad", text: satz + kommaHinweis };
          }
        }
        return { art: "bad", text: kommaHinweis.trim() };
      }
      const ist = hypotheseLesen(text);
      if (!ist.ok) return { art: "leer", text: ist.fehler };
      for (const s of soll) {
        const v = hypothesenVergleichen(ist.liste, s.liste);
        if (v.gleich) return { art: "ok" };
      }
      return { art: "bad", text: hypothesenVergleichen(ist.liste, soll[0].liste).hinweis };
    }

    form_.addEventListener("submit", (e) => {
      e.preventDefault();
      const u = bewerten(feld.value);
      feld.classList.toggle("richtig", u.art === "ok");
      if (u.art === "ok") {
        feld.removeAttribute("aria-invalid");
        textMelden(rm, "ok", "✓ Richtig.");
        return;
      }
      feld.setAttribute("aria-invalid", "true");
      if (u.art === "leer") textMelden(rm, "leer", u.text);
      else textMelden(rm, "bad", "✗ Das stimmt noch nicht." + (u.text ? " " + u.text : "") + hilfe.rat());
    });
    feld.addEventListener("input", () => {
      if (feld.getAttribute("aria-invalid")) feld.removeAttribute("aria-invalid");
      feld.classList.remove("richtig");
    });
    formeln(el);
    return {
      zuruecksetzen() {
        feld.value = "";
        feld.removeAttribute("aria-invalid");
        feld.classList.remove("richtig");
        textMelden(rm, "", "");
        hilfe.zuruecksetzen();
      },
    };
  }

  /* ---------- Hilfsfunktion: Netzplan-Knoten ---------- */

  // Baut einen Knoten mit FA, Vorgang, FE / SA, Dauer, SE und Puffer. Rechnen tut die Station selbst.
  function netzplanKnoten(d) {
    d = d || {};
    const wert = (x) => (x === undefined || x === null || x === "" ? "–" : String(x));
    const k = erzeugen("div", "np-knoten" + (d.kritisch ? " kritisch" : ""));
    const zelle = (klasse, kurz, x, inhaltHtml) => {
      const s = erzeugen("span", klasse);
      s.setAttribute("data-kurz", kurz);
      if (inhaltHtml !== undefined) s.innerHTML = inhaltHtml;
      else s.textContent = wert(x);
      return s;
    };
    k.append(
      zelle("np-fa", "FA", d.fa),
      zelle("np-vorgang", "Vorgang", null, d.vorgang || ""),
      zelle("np-fe", "FE", d.fe),
      zelle("np-sa", "SA", d.sa),
      zelle("np-dauer", "Dauer", d.dauer),
      zelle("np-se", "SE", d.se)
    );
    const hatPuffer = d.gp !== undefined || d.fp !== undefined;
    if (hatPuffer) {
      const p = erzeugen("span", "np-puffer");
      p.textContent = "GP " + wert(d.gp) + (d.fp !== undefined ? " · FP " + wert(d.fp) : "");
      k.appendChild(p);
    }
    k.setAttribute("role", "group");
    k.setAttribute("aria-label",
      "Vorgang " + ohneTags(d.vorgang || "") + ": Dauer " + wert(d.dauer) +
      ", FA " + wert(d.fa) + ", FE " + wert(d.fe) + ", SA " + wert(d.sa) + ", SE " + wert(d.se) +
      (hatPuffer ? ", Gesamtpuffer " + wert(d.gp) + (d.fp !== undefined ? ", freier Puffer " + wert(d.fp) : "") : "") +
      (d.kritisch ? ", kritisch" : ""));
    return k;
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
    version: "1.2.0",
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
    reflexion: reflexion,
    matrix: matrix,
    formelAufgabe: formelAufgabe,
    tabellenAufgabe: tabellenAufgabe,
    lueckenRechnung: lueckenRechnung,
    kurzAntwort: kurzAntwort,
    netzplanKnoten: netzplanKnoten,
    fortschritt: fortschritt,
    zahlLesen: zahlLesen,
    zahlText: zahlText,
    makros: makros,
    auswertung: AUSWERTUNG,
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
