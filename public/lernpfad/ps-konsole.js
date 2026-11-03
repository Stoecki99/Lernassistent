/* ==========================================================================
   Lernpfad-Baukasten · ps-konsole.js
   PowerShell-Simulator für den Lernpfad PS: Syntaxfärbung, Konsole, Skript-Modus.

   Einbinden NACH lernpfad.js und nur auf Seiten des Fachs ps:
     <script src="/lernpfad/lernpfad.js"></script>
     <script src="/lernpfad/ps-konsole.js"></script>

   Läuft auch ohne DOM (Node, Tests): require("public/lernpfad/ps-konsole.js").

   Aufbau (jeder Teil baut nur auf den vorherigen auf):
     1. Hilfen: Text, Platzhalter, Zahlen und Datum in der Kultur de-CH
     2. Objektmodell: Werte, Typen, Objekte mit Eigenschaften
     3. Spiel-Rechner «Lea»: Dateisystem, Prozesse, Dienste, Umgebung
     4. Tokenizer: Text → Tokens (Ausdrucks- und Befehlsmodus)
     5. Parser: Tokens → Syntaxbaum
     6. Auswertung: Syntaxbaum ausführen (Variablen, Operatoren, Pipeline, Fehler)
     7. Formatierer: Objekte → Textzeilen wie pwsh 7 (Out-Default, Format-*)
     8. Cmdlet-Tabelle: alle nachgebauten Befehle
     9. Hilfe-Texte (Get-Help)
    10. Sitzung: öffentliche API ohne Oberfläche
    11. Syntaxfärbung im DOM (.ps-code, code.ps)
    12. Oberfläche Lernpfad.konsole (Konsole, Skript-Modus, Aufgaben)

   Sicherheit: Eingaben werden nur interpretiert, nie als JavaScript ausgeführt
   (kein eval, kein new Function). Ausgaben gelangen nur per textContent ins DOM.
   Doku: docs/lernpfad-powershell.md
   ========================================================================== */
(function (wurzel, fabrik) {
  "use strict";
  const PS = fabrik();
  if (typeof module === "object" && module && module.exports) module.exports = PS;
  if (typeof window !== "undefined" && typeof document !== "undefined") PS._browserStarten(window, document);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /* ======================================================================
     1. Hilfen
     ====================================================================== */

  const BREITE = 120; // Zeichen pro Zeile wie pwsh 7 in einem 120 Zeichen breiten Fenster
  const AUSLASSUNG = "…";
  const GRUPPE = "’"; // Tausendertrenner de-CH (.NET mit ICU)

  const klein = (s) => String(s).toLowerCase();
  const gleichCI = (a, b) => klein(a) === klein(b);
  const leer = (n) => (n > 0 ? " ".repeat(n) : "");
  const links = (t, b) => (t.length >= b ? t : t + leer(b - t.length));
  const rechts = (t, b) => (t.length >= b ? t : leer(b - t.length) + t);
  const kuerzen = (t, b) => (b <= 0 ? "" : t.length > b ? t.slice(0, Math.max(0, b - 1)) + AUSLASSUNG : t);
  const enthaelt = (menge, c) => !!c && menge.indexOf(c) >= 0; // "abc".includes("") wäre true
  const escRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Platzhalter * ? [abc] → regulärer Ausdruck (ohne Gross/Klein)
  function platzhalterRegex(muster) {
    let r = "^";
    for (let i = 0; i < muster.length; i++) {
      const c = muster[i];
      if (c === "*") r += "[\\s\\S]*";
      else if (c === "?") r += "[\\s\\S]";
      else if (c === "[") {
        const ende = muster.indexOf("]", i + 1);
        if (ende > i + 1) {
          r += "[" + muster.slice(i + 1, ende).replace(/[\\\]^]/g, "\\$&") + "]";
          i = ende;
        } else r += "\\[";
      } else if (c === "`" && i + 1 < muster.length) r += escRegex(muster[++i]);
      else r += escRegex(c);
    }
    return new RegExp(r + "$", "i");
  }
  const hatPlatzhalter = (s) => /[*?[]/.test(String(s));
  const passt = (text, muster) => platzhalterRegex(String(muster)).test(String(text));

  // Vergleich wie NTFS (Grossbuchstaben, ordinal) und wie Sort-Object (Kultur, ohne Gross/Klein)
  const ordinalCI = (a, b) => {
    const x = String(a).toUpperCase(), y = String(b).toUpperCase();
    return x < y ? -1 : x > y ? 1 : 0;
  };
  const KOLLATOR = typeof Intl !== "undefined" ? new Intl.Collator("de-CH", { sensitivity: "accent" }) : null;
  const kulturVergleich = (a, b) => (KOLLATOR ? KOLLATOR.compare(String(a), String(b)) : ordinalCI(a, b));

  /* ---------- Zahlen ---------- */

  // Gleitkommazahl mit ganzzahligem Wert (6.0). Nicht ganzzahlige Doubles sind gewöhnliche JS-Zahlen.
  class PSDouble {
    constructor(w) { this.w = w; }
    valueOf() { return this.w; }
  }
  const istZahl = (v) => typeof v === "number" || v instanceof PSDouble;
  const zahlWert = (v) => (v instanceof PSDouble ? v.w : v);
  const istDouble = (v) => v instanceof PSDouble || (typeof v === "number" && !Number.isInteger(v));
  const alsDouble = (w) => (Number.isInteger(w) ? new PSDouble(w) : w);
  const INT32_MAX = 2147483647, INT32_MIN = -2147483648;

  // Ganzzahl-Ergebnis; Überlauf über Int64 hinaus wird zum Double wie in PowerShell
  function ganzOderDouble(w, double) {
    if (double || !Number.isInteger(w) || Math.abs(w) > Number.MAX_SAFE_INTEGER) return alsDouble(w);
    return w;
  }

  // Double als Text wie .NET «G15» (so zeigt PowerShell Zahlen an)
  function g15(w) {
    if (Number.isNaN(w)) return "NaN";
    if (w === Infinity) return "∞";
    if (w === -Infinity) return "-∞";
    if (w === 0) return "0";
    const exp = Number(w.toExponential(14).split("e")[1]);
    if (exp >= 15 || exp < -5) {
      let [m] = w.toExponential(14).split("e");
      if (m.includes(".")) m = m.replace(/0+$/, "").replace(/\.$/, "");
      return m + "E" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
    }
    return String(Number(w.toPrecision(15)));
  }

  function zahlText(v) {
    const w = zahlWert(v);
    if (!istDouble(v)) return String(w);
    return g15(w);
  }

  // Feste Nachkommastellen, optional mit Tausendertrenner (Formate N und F)
  function festText(w, stellen, gruppieren) {
    if (!Number.isFinite(w)) return g15(w);
    const f = Math.pow(10, stellen), v = Math.abs(w) * f;
    let s = v - Math.floor(v) === 0.5 && Math.floor(v) % 2 === 0 && v < 1e15 ? (Math.floor(v) / f).toFixed(stellen) : Math.abs(w).toFixed(stellen);
    let [ganz, rest] = s.split(".");
    if (gruppieren) ganz = ganz.replace(/\B(?=(\d{3})+(?!\d))/g, GRUPPE);
    const negativ = w < 0 && Number(s) !== 0;
    return (negativ ? "-" : "") + ganz + (rest ? "." + rest : "");
  }

  // .NET-Zahlenformat wie in "{0:N2}" oder (5).ToString("F1"), Kultur de-CH
  function zahlFormat(v, format) {
    const w = zahlWert(v);
    const m = /^([NnFfDdPpXxCcEeGg])(\d*)$/.exec(format || "");
    if (m) {
      const art = m[1].toUpperCase();
      const n = m[2] === "" ? null : Number(m[2]);
      switch (art) {
        case "N": return festText(w, n === null ? 2 : n, true);
        case "F": return festText(w, n === null ? 2 : n, false);
        case "D": {
          const s = String(Math.abs(Math.trunc(w)));
          return (w < 0 ? "-" : "") + (n ? s.padStart(n, "0") : s);
        }
        case "P": return festText(w * 100, n === null ? 2 : n, true) + "%";
        case "C": return "CHF " + festText(w, n === null ? 2 : n, true);
        case "X": {
          const s = Math.trunc(w).toString(16);
          return (m[1] === "X" ? s.toUpperCase() : s).padStart(n || 0, "0");
        }
        case "E": return w.toExponential(n === null ? 6 : n).replace(/e([+-])(\d)$/, "e$10$2").replace(/e([+-])(\d\d)$/, "e$100$2").toUpperCase();
        case "G": return n ? String(Number(w.toPrecision(n))) : zahlText(v);
      }
    }
    if (format && /^[0#.,%\s'’-]+$/.test(format)) return eigenesZahlFormat(w, format);
    return zahlText(v);
  }

  // Eigene Muster wie "0.00" oder "#,##0"
  function eigenesZahlFormat(w, format) {
    const prozent = format.includes("%");
    if (prozent) w *= 100;
    const [vorne, hinten = ""] = format.replace(/%/g, "").split(".");
    const stellen = (hinten.match(/[0#]/g) || []).length;
    const mindest = (hinten.match(/0/g) || []).length;
    const gruppieren = vorne.includes(",");
    let s = festText(w, stellen, gruppieren);
    if (stellen > mindest && s.includes(".")) {
      let [g, r] = s.split(".");
      while (r.length > mindest && r.endsWith("0")) r = r.slice(0, -1);
      s = r ? g + "." + r : g;
    }
    const ganzMindest = (vorne.replace(/,/g, "").match(/0/g) || []).length;
    if (ganzMindest === 0 && /^-?0(\.|$)/.test(s) && stellen > 0) s = s.replace(/^(-?)0\./, "$1.");
    return s + (prozent ? "%" : "");
  }

  /* ---------- Datum und Zeitspanne (Kultur de-CH, keine Zeitzonen) ---------- */

  const TAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const TAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const TAGE_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const MONATE_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const MONATE_KURZ_GENITIV = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];
  const TICKS_1970 = 621355968000000000; // Ticks von 0001-01-01 bis 1970-01-01

  // Zeitpunkt ohne Zeitzone: Millisekunden wie Date.UTC, gelesen als lokale Zeit
  class PSDatum {
    constructor(ms) { this.ms = ms; }
  }
  class PSZeitspanne {
    constructor(ms) { this.ms = ms; }
  }
  // Aufzählungswert, z. B. Status «Running» eines Dienstes (Text und Zahl)
  class PSEnum {
    constructor(typ, name, wert) { this.typ = typ; this.name = name; this.wert = wert; }
    toString() { return this.name; }
  }

  function datumTeile(d) {
    const x = new Date(d.ms);
    return {
      j: x.getUTCFullYear(), m: x.getUTCMonth() + 1, t: x.getUTCDate(),
      h: x.getUTCHours(), min: x.getUTCMinutes(), s: x.getUTCSeconds(), ms: x.getUTCMilliseconds(), wt: x.getUTCDay(),
    };
  }
  const datumAus = (j, m, t, h, min, s) => new PSDatum(Date.UTC(j, m - 1, t, h || 0, min || 0, s || 0));

  // Zeitzone des Spiel-Rechners: Europe/Zurich (MEZ UTC+1, Sommerzeit MESZ UTC+2 nach EU-Regel:
  // vom letzten Sonntag im März 01:00 UTC bis zum letzten Sonntag im Oktober 01:00 UTC)
  const STUNDE_MS = 3600000;
  const letzterSonntag = (j, m) => { const d = new Date(Date.UTC(j, m, 0)); return d.getUTCDate() - d.getUTCDay(); }; // m = 1…12
  function sommerzeit(utcMs) {
    const j = new Date(utcMs).getUTCFullYear();
    return utcMs >= Date.UTC(j, 2, letzterSonntag(j, 3), 1) && utcMs < Date.UTC(j, 9, letzterSonntag(j, 10), 1);
  }
  // Lokale Zeit → UTC; die doppelte Stunde im Oktober gilt wie in .NET als Winterzeit
  const nachUtc = (lokalMs) => (sommerzeit(lokalMs - 2 * STUNDE_MS) && sommerzeit(lokalMs - STUNDE_MS) ? lokalMs - 2 * STUNDE_MS : lokalMs - STUNDE_MS);
  const ausUtc = (utcMs) => utcMs + (sommerzeit(utcMs) ? 2 : 1) * STUNDE_MS;
  const zwei = (n) => String(n).padStart(2, "0");

  const DATUM_STANDARD = {
    d: "dd.MM.yyyy", D: "dddd, d. MMMM yyyy", t: "HH:mm", T: "HH:mm:ss",
    f: "dddd, d. MMMM yyyy HH:mm", F: "dddd, d. MMMM yyyy HH:mm:ss",
    g: "dd.MM.yyyy HH:mm", G: "dd.MM.yyyy HH:mm:ss",
    s: "yyyy'-'MM'-'dd'T'HH':'mm':'ss", u: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'",
    o: "yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fffffff", O: "yyyy'-'MM'-'dd'T'HH':'mm':'ss'.'fffffff",
    m: "d. MMMM", M: "d. MMMM", y: "MMMM yyyy", Y: "MMMM yyyy",
  };

  // .NET-Datumsformat (Standard- und eigene Muster), Kultur de-CH
  function datumFormat(d, format) {
    if (!format) format = "G";
    if (format.length === 1 && DATUM_STANDARD[format]) format = DATUM_STANDARD[format];
    const p = datumTeile(d);
    // Mit Tageszahl im Muster nimmt .NET die Genitiv-Kürzel («2. Nov. 2026»), sonst «Nov»
    const mitTag = /(^|[^d])d{1,2}([^d]|$)/.test(format.replace(/'[^']*'|"[^"]*"/g, ""));
    let aus = "";
    for (let i = 0; i < format.length; ) {
      const c = format[i];
      if (c === "'" || c === '"') {
        const ende = format.indexOf(c, i + 1);
        aus += format.slice(i + 1, ende < 0 ? format.length : ende);
        i = ende < 0 ? format.length : ende + 1;
        continue;
      }
      if (c === "\\" && i + 1 < format.length) { aus += format[i + 1]; i += 2; continue; }
      let n = 1;
      while (format[i + n] === c) n++;
      switch (c) {
        case "y": aus += n === 2 ? zwei(p.j % 100) : n === 1 ? String(p.j % 100) : String(p.j).padStart(n, "0"); break;
        case "M": aus += n >= 4 ? MONATE[p.m - 1] : n === 3 ? (mitTag ? MONATE_KURZ_GENITIV : MONATE_KURZ)[p.m - 1] : n === 2 ? zwei(p.m) : String(p.m); break;
        case "d": aus += n >= 4 ? TAGE[p.wt] : n === 3 ? TAGE_KURZ[p.wt] : n === 2 ? zwei(p.t) : String(p.t); break;
        case "H": aus += n >= 2 ? zwei(p.h) : String(p.h); break;
        case "h": { const h12 = p.h % 12 || 12; aus += n >= 2 ? zwei(h12) : String(h12); break; }
        case "m": aus += n >= 2 ? zwei(p.min) : String(p.min); break;
        case "s": aus += n >= 2 ? zwei(p.s) : String(p.s); break;
        case "f": case "F": aus += String(p.ms).padStart(3, "0").padEnd(n, "0").slice(0, n); break;
        case "t": aus += p.h < 12 ? "AM".slice(0, n) : "PM".slice(0, n); break;
        case "/": aus += ".".repeat(n); break;
        default: aus += c.repeat(n);
      }
      i += n;
    }
    return aus;
  }

  const datumLang = (d) => datumFormat(d, "dddd, d. MMMM yyyy HH:mm:ss"); // Standardanzeige in der Konsole
  const datumKurz = (d) => datumFormat(d, "dd.MM.yyyy HH:mm:ss"); // ToString(), Tabellen, Listen
  const datumInvariant = (d) => datumFormat(d, "MM'/'dd'/'yyyy HH:mm:ss"); // "$datum" im String

  // Text → Datum. invariant: wie [datetime]'…' (Monat zuerst). Sonst Kultur de-CH (Tag zuerst) wie Get-Date -Date.
  function datumLesen(text, kultur) {
    const s = String(text).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?Z?$/.exec(s);
    if (m) return datumAus(+m[1], +m[2], +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s);
    if (m) {
      const [a, b] = kultur ? [+m[2], +m[1]] : [+m[1], +m[2]]; // [Monat, Tag]
      if (a < 1 || a > 12 || b < 1 || b > 31) return null;
      return datumAus(+m[3], a, b, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    }
    m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (m) {
      const heute = datumTeile(new PSDatum(JETZT.ms));
      return datumAus(heute.j, heute.m, heute.t, +m[1], +m[2], +(m[3] || 0));
    }
    return null;
  }

  // Monate und Jahre kalendergerecht addieren (31. Januar + 1 Monat = 28./29. Februar)
  function monateAddieren(d, n) {
    const p = datumTeile(d);
    let m = p.m - 1 + n;
    const j = p.j + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    const letzter = new Date(Date.UTC(j, m + 1, 0)).getUTCDate();
    return new PSDatum(Date.UTC(j, m, Math.min(p.t, letzter), p.h, p.min, p.s, p.ms));
  }

  function zeitspanneText(z) {
    const neg = z.ms < 0;
    let ms = Math.abs(z.ms);
    const tage = Math.floor(ms / 86400000);
    ms -= tage * 86400000;
    const h = Math.floor(ms / 3600000), min = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    const rest = Math.round(ms % 1000);
    return (neg ? "-" : "") + (tage ? tage + "." : "") + zwei(h) + ":" + zwei(min) + ":" + zwei(s) + (rest ? "." + String(rest * 10000).padStart(7, "0") : "");
  }

  // Uhr des Spiel-Rechners (wird pro Sitzung gesetzt)
  const JETZT = { ms: Date.UTC(2026, 10, 2, 9, 0, 0) };

  /* ---------- Daten aus pwsh 7.6 (Syntax, Verben, Member, Befehlsnamen) ---------- */
  const VERBEN = ["Add|a|Common|Adds a resource to a container, or attaches an item to another item","Clear|cl|Common|Removes all the resources from a container but does not delete the container","Close|cs|Common|Changes the state of a resource to make it inaccessible, unavailable, or unusable","Copy|cp|Common|Copies a resource to another name or to another container","Enter|et|Common|Specifies an action that allows the user to move into a resource","Exit|ex|Common|Sets the current environment or context to the most recently used context","Find|fd|Common|Looks for an object in a container that is unknown, implied, optional, or specified","Format|f|Common|Arranges objects in a specified form or layout","Get|g|Common|Specifies an action that retrieves a resource","Hide|h|Common|Makes a resource undetectable","Join|j|Common|Combines resources into one resource","Lock|lk|Common|Secures a resource","Move|m|Common|Moves a resource from one location to another","New|n|Common|Creates a resource","Open|op|Common|Changes the state of a resource to make it accessible, available, or usable","Optimize|om|Common|Increases the effectiveness of a resource","Push|pu|Common|Adds an item to the top of a stack","Pop|pop|Common|Removes an item from the top of a stack","Redo|re|Common|Resets a resource to the state that was undone","Remove|r|Common|Deletes a resource from a container","Rename|rn|Common|Changes the name of a resource","Reset|rs|Common|Sets a resource back to its original state","Resize|rz|Common|Changes the size of a resource","Search|sr|Common|Creates a reference to a resource in a container","Select|sc|Common|Locates a resource in a container","Set|s|Common|Replaces data on an existing resource or creates a resource that contains some data","Show|sh|Common|Makes a resource visible to the user","Skip|sk|Common|Bypasses one or more resources or points in a sequence","Split|sl|Common|Separates parts of a resource","Step|st|Common|Moves to the next point or resource in a sequence","Switch|sw|Common|Specifies an action that alternates between two resources, such as to change between two locations, responsibilities, or states","Undo|un|Common|Sets a resource to its previous state","Unlock|uk|Common|Releases a resource that was locked","Watch|wc|Common|Continually inspects or monitors a resource for changes","Connect|cc|Communications|Creates a link between a source and a destination","Disconnect|dc|Communications|Breaks the link between a source and a destination","Read|rd|Communications|Acquires information from a source","Receive|rc|Communications|Accepts information sent from a source","Send|sd|Communications|Delivers information to a destination","Write|wr|Communications|Adds information to a target","Backup|ba|Data|Stores data by replicating it","Checkpoint|ch|Data|Creates a snapshot of the current state of the data or of its configuration","Compare|cr|Data|Evaluates the data from one resource against the data from another resource","Compress|cm|Data|Compacts the data of a resource","Convert|cv|Data|Changes the data from one representation to another when the cmdlet supports bidirectional conversion or when the cmdlet supports conversion between multiple data types","ConvertFrom|cf|Data|Converts one primary type of input (the cmdlet noun indicates the input) to one or more supported output types","ConvertTo|ct|Data|Converts from one or more types of input to a primary output type (the cmdlet noun indicates the output type)","Dismount|dm|Data|Detaches a named entity from a location","Edit|ed|Data|Modifies existing data by adding or removing content","Expand|en|Data|Restores the data of a resource that has been compressed to its original state","Export|ep|Data|Encapsulates the primary input into a persistent data store, such as a file, or into an interchange format","Group|gp|Data|Arranges or associates one or more resources","Import|ip|Data|Creates a resource from data that is stored in a persistent data store (such as a file) or in an interchange format","Initialize|in|Data|Prepares a resource for use, and sets it to a default state","Limit|l|Data|Applies constraints to a resource","Merge|mg|Data|Creates a single resource from multiple resources","Mount|mt|Data|Attaches a named entity to a location","Out|o|Data|Sends data out of the environment","Publish|pb|Data|Makes a resource available to others","Restore|rr|Data|Sets a resource to a predefined state, such as a state set by Checkpoint","Save|sv|Data|Preserves data to avoid loss","Sync|sy|Data|Assures that two or more resources are in the same state","Unpublish|ub|Data|Makes a resource unavailable to others","Update|ud|Data|Brings a resource up-to-date to maintain its state, accuracy, conformance, or compliance","Debug|db|Diagnostic|Examines a resource to diagnose operational problems","Measure|ms|Diagnostic|Identifies resources that are consumed by a specified operation, or retrieves statistics about a resource","Ping|pi|Diagnostic|Use the Test verb","Repair|rp|Diagnostic|Restores a resource to a usable condition","Resolve|rv|Diagnostic|Maps a shorthand representation of a resource to a more complete representation","Test|t|Diagnostic|Verifies the operation or consistency of a resource","Trace|tr|Diagnostic|Tracks the activities of a resource","Approve|ap|Lifecycle|Confirms or agrees to the status of a resource or process","Assert|as|Lifecycle|Affirms the state of a resource","Build|bd|Lifecycle|Creates an artifact (usually a binary or document) out of some set of input files (usually source code or declarative documents)","Complete|cmp|Lifecycle|Concludes an operation","Confirm|cn|Lifecycle|Acknowledges, verifies, or validates the state of a resource or process","Deny|dn|Lifecycle|Refuses, objects, blocks, or opposes the state of a resource or process","Deploy|dp|Lifecycle|Sends an application, website, or solution to a remote target[s] in such a way that a consumer of that solution can access it after deployment is complete","Disable|d|Lifecycle|Configures a resource to an unavailable or inactive state","Enable|e|Lifecycle|Configures a resource to an available or active state","Install|is|Lifecycle|Places a resource in a location, and optionally initializes it","Invoke|i|Lifecycle|Performs an action, such as running a command or a method","Register|rg|Lifecycle|Creates an entry for a resource in a repository such as a database","Request|rq|Lifecycle|Asks for a resource or asks for permissions","Restart|rt|Lifecycle|Stops an operation and then starts it again","Resume|ru|Lifecycle|Starts an operation that has been suspended","Start|sa|Lifecycle|Initiates an operation","Stop|sp|Lifecycle|Discontinues an activity","Submit|sb|Lifecycle|Presents a resource for approval","Suspend|ss|Lifecycle|Pauses an activity","Uninstall|us|Lifecycle|Removes a resource from an indicated location","Unregister|ur|Lifecycle|Removes the entry for a resource from a repository","Wait|w|Lifecycle|Pauses an operation until a specified event occurs","Use|u|Other|Uses or includes a resource to do something","Block|bl|Security|Restricts access to a resource","Grant|gr|Security|Allows access to a resource","Protect|pt|Security|Safeguards a resource from attack or loss","Revoke|rk|Security|Specifies an action that does not allow access to a resource","Unblock|ul|Security|Removes restrictions to a resource","Unprotect|up|Security|Removes safeguards from a resource that were added to prevent it from attack or loss"];
  const SYNTAX = {
 "Get-Command": [
  "Get-Command [[-ArgumentList] <Object[]>] [-Verb <string[]>] [-Noun <string[]>] [-Module <string[]>] [-ExcludeModule <string[]>] [-FullyQualifiedModule <ModuleSpecification[]>] [-TotalCount <int>] [-Syntax] [-ShowCommandInfo] [-All] [-ListImported] [-ParameterName <string[]>] [-ParameterType <PSTypeName[]>] [<CommonParameters>]",
  "Get-Command [[-Name] <string[]>] [[-ArgumentList] <Object[]>] [-Module <string[]>] [-ExcludeModule <string[]>] [-FullyQualifiedModule <ModuleSpecification[]>] [-CommandType <CommandTypes>] [-TotalCount <int>] [-Syntax] [-ShowCommandInfo] [-All] [-ListImported] [-ParameterName <string[]>] [-ParameterType <PSTypeName[]>] [-UseFuzzyMatching] [-FuzzyMinimumDistance <uint>] [-UseAbbreviationExpansion] [<CommonParameters>]"
 ],
 "Get-Help": [
  "Get-Help [[-Name] <string>] [-Path <string>] [-Category <string[]>] [-Full] [-Component <string[]>] [-Functionality <string[]>] [-Role <string[]>] [<CommonParameters>]",
  "Get-Help [[-Name] <string>] -Detailed [-Path <string>] [-Category <string[]>] [-Component <string[]>] [-Functionality <string[]>] [-Role <string[]>] [<CommonParameters>]",
  "Get-Help [[-Name] <string>] -Examples [-Path <string>] [-Category <string[]>] [-Component <string[]>] [-Functionality <string[]>] [-Role <string[]>] [<CommonParameters>]",
  "Get-Help [[-Name] <string>] -Parameter <string[]> [-Path <string>] [-Category <string[]>] [-Component <string[]>] [-Functionality <string[]>] [-Role <string[]>] [<CommonParameters>]",
  "Get-Help [[-Name] <string>] -Online [-Path <string>] [-Category <string[]>] [-Component <string[]>] [-Functionality <string[]>] [-Role <string[]>] [<CommonParameters>]",
  "Get-Help [[-Name] <string>] -ShowWindow [-Path <string>] [-Category <string[]>] [-Component <string[]>] [-Functionality <string[]>] [-Role <string[]>] [<CommonParameters>]"
 ],
 "Get-Member": [
  "Get-Member [[-Name] <string[]>] [-InputObject <psobject>] [-MemberType <PSMemberTypes>] [-View <PSMemberViewTypes>] [-Static] [-Force] [<CommonParameters>]"
 ],
 "Get-Alias": [
  "Get-Alias [[-Name] <string[]>] [-Exclude <string[]>] [-Scope <string>] [<CommonParameters>]",
  "Get-Alias [-Exclude <string[]>] [-Scope <string>] [-Definition <string[]>] [<CommonParameters>]"
 ],
 "Get-Verb": [
  "Get-Verb [[-Verb] <string[]>] [[-Group] <string[]>] [<CommonParameters>]"
 ],
 "Get-History": [
  "Get-History [[-Id] <long[]>] [[-Count] <int>] [<CommonParameters>]"
 ],
 "Get-Location": [
  "Get-Location [-PSProvider <string[]>] [-PSDrive <string[]>] [<CommonParameters>]",
  "Get-Location [-Stack] [-StackName <string[]>] [<CommonParameters>]"
 ],
 "Set-Location": [
  "Set-Location [[-Path] <string>] [-PassThru] [<CommonParameters>]",
  "Set-Location -LiteralPath <string> [-PassThru] [<CommonParameters>]",
  "Set-Location [-PassThru] [-StackName <string>] [<CommonParameters>]"
 ],
 "Get-ChildItem": [
  "Get-ChildItem [[-Path] <string[]>] [[-Filter] <string>] [-Include <string[]>] [-Exclude <string[]>] [-Recurse] [-Depth <uint>] [-Force] [-Name] [-Attributes <FlagsExpression[FileAttributes]>] [-FollowSymlink] [-Directory] [-File] [-Hidden] [-ReadOnly] [-System] [<CommonParameters>]",
  "Get-ChildItem [[-Filter] <string>] -LiteralPath <string[]> [-Include <string[]>] [-Exclude <string[]>] [-Recurse] [-Depth <uint>] [-Force] [-Name] [-Attributes <FlagsExpression[FileAttributes]>] [-FollowSymlink] [-Directory] [-File] [-Hidden] [-ReadOnly] [-System] [<CommonParameters>]"
 ],
 "Get-Item": [
  "Get-Item [-Path] <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-Stream <string[]>] [<CommonParameters>]",
  "Get-Item -LiteralPath <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-Stream <string[]>] [<CommonParameters>]"
 ],
 "Test-Path": [
  "Test-Path [-Path] <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-PathType <TestPathType>] [-IsValid] [-Credential <pscredential>] [-OlderThan <datetime>] [-NewerThan <datetime>] [<CommonParameters>]",
  "Test-Path -LiteralPath <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-PathType <TestPathType>] [-IsValid] [-Credential <pscredential>] [-OlderThan <datetime>] [-NewerThan <datetime>] [<CommonParameters>]"
 ],
 "Join-Path": [
  "Join-Path [-Path] <string[]> [-ChildPath] <string[]> [[-AdditionalChildPath] <string[]>] [-Resolve] [-Credential <pscredential>] [<CommonParameters>]"
 ],
 "New-Item": [
  "New-Item [-Path] <string[]> [-ItemType <string>] [-Value <Object>] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "New-Item [[-Path] <string[]>] -Name <string> [-ItemType <string>] [-Value <Object>] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Copy-Item": [
  "Copy-Item [-Path] <string[]> [[-Destination] <string>] [-Container] [-Force] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Recurse] [-PassThru] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-FromSession <PSSession>] [-ToSession <PSSession>] [<CommonParameters>]",
  "Copy-Item [[-Destination] <string>] -LiteralPath <string[]> [-Container] [-Force] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Recurse] [-PassThru] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-FromSession <PSSession>] [-ToSession <PSSession>] [<CommonParameters>]"
 ],
 "Move-Item": [
  "Move-Item [-Path] <string[]> [[-Destination] <string>] [-Force] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-PassThru] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Move-Item [[-Destination] <string>] -LiteralPath <string[]> [-Force] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-PassThru] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Rename-Item": [
  "Rename-Item [-Path] <string> [-NewName] <string> [-Force] [-PassThru] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Rename-Item [-NewName] <string> -LiteralPath <string> [-Force] [-PassThru] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Remove-Item": [
  "Remove-Item [-Path] <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Recurse] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-Stream <string[]>] [<CommonParameters>]",
  "Remove-Item -LiteralPath <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Recurse] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-Stream <string[]>] [<CommonParameters>]"
 ],
 "Get-Content": [
  "Get-Content [-Path] <string[]> [-ReadCount <long>] [-TotalCount <long>] [-Tail <int>] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-Delimiter <string>] [-Wait] [-Raw] [-Encoding <Encoding>] [-AsByteStream] [-Stream <string>] [<CommonParameters>]",
  "Get-Content -LiteralPath <string[]> [-ReadCount <long>] [-TotalCount <long>] [-Tail <int>] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-Delimiter <string>] [-Wait] [-Raw] [-Encoding <Encoding>] [-AsByteStream] [-Stream <string>] [<CommonParameters>]"
 ],
 "Set-Content": [
  "Set-Content [-Path] <string[]> [-Value] <Object[]> [-PassThru] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-NoNewline] [-Encoding <Encoding>] [-AsByteStream] [-Stream <string>] [<CommonParameters>]",
  "Set-Content [-Value] <Object[]> -LiteralPath <string[]> [-PassThru] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-NoNewline] [-Encoding <Encoding>] [-AsByteStream] [-Stream <string>] [<CommonParameters>]"
 ],
 "Add-Content": [
  "Add-Content [-Path] <string[]> [-Value] <Object[]> [-PassThru] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-NoNewline] [-Encoding <Encoding>] [-AsByteStream] [-Stream <string>] [<CommonParameters>]",
  "Add-Content [-Value] <Object[]> -LiteralPath <string[]> [-PassThru] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-NoNewline] [-Encoding <Encoding>] [-AsByteStream] [-Stream <string>] [<CommonParameters>]"
 ],
 "Out-File": [
  "Out-File [-FilePath] <string> [[-Encoding] <Encoding>] [-Append] [-Force] [-NoClobber] [-Width <int>] [-NoNewline] [-InputObject <psobject>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Out-File [[-Encoding] <Encoding>] -LiteralPath <string> [-Append] [-Force] [-NoClobber] [-Width <int>] [-NoNewline] [-InputObject <psobject>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Where-Object": [
  "Where-Object [-Property] <string> [[-Value] <Object>] [-InputObject <psobject>] [-EQ] [<CommonParameters>]",
  "Where-Object [-FilterScript] <scriptblock> [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CEQ [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -NE [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CNE [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -GT [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CGT [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -LT [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CLT [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -GE [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CGE [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -LE [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CLE [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -Like [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CLike [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -NotLike [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CNotLike [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -Match [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CMatch [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -NotMatch [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CNotMatch [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -Contains [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CContains [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -NotContains [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CNotContains [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -In [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CIn [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -NotIn [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -CNotIn [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -Is [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> [[-Value] <Object>] -IsNot [-InputObject <psobject>] [<CommonParameters>]",
  "Where-Object [-Property] <string> -Not [-InputObject <psobject>] [<CommonParameters>]"
 ],
 "ForEach-Object": [
  "ForEach-Object [-Process] <scriptblock[]> [-InputObject <psobject>] [-Begin <scriptblock>] [-End <scriptblock>] [-RemainingScripts <scriptblock[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "ForEach-Object [-MemberName] <string> [-InputObject <psobject>] [-ArgumentList <Object[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "ForEach-Object -Parallel <scriptblock> [-InputObject <psobject>] [-ThrottleLimit <int>] [-TimeoutSeconds <int>] [-AsJob] [-UseNewRunspace] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Sort-Object": [
  "Sort-Object [[-Property] <Object[]>] [-Stable] [-Descending] [-Unique] [-InputObject <psobject>] [-Culture <string>] [-CaseSensitive] [<CommonParameters>]",
  "Sort-Object [[-Property] <Object[]>] -Top <int> [-Descending] [-Unique] [-InputObject <psobject>] [-Culture <string>] [-CaseSensitive] [<CommonParameters>]",
  "Sort-Object [[-Property] <Object[]>] -Bottom <int> [-Descending] [-Unique] [-InputObject <psobject>] [-Culture <string>] [-CaseSensitive] [<CommonParameters>]"
 ],
 "Select-Object": [
  "Select-Object [[-Property] <Object[]>] [-InputObject <psobject>] [-ExcludeProperty <string[]>] [-ExpandProperty <string>] [-Unique] [-CaseInsensitive] [-Last <int>] [-First <int>] [-Skip <int>] [-Wait] [<CommonParameters>]",
  "Select-Object [[-Property] <Object[]>] [-InputObject <psobject>] [-ExcludeProperty <string[]>] [-ExpandProperty <string>] [-Unique] [-CaseInsensitive] [-Skip <int>] [-SkipLast <int>] [<CommonParameters>]",
  "Select-Object [-InputObject <psobject>] [-Unique] [-CaseInsensitive] [-Wait] [-Index <int[]>] [<CommonParameters>]",
  "Select-Object [-InputObject <psobject>] [-Unique] [-CaseInsensitive] [-SkipIndex <int[]>] [<CommonParameters>]"
 ],
 "Measure-Object": [
  "Measure-Object [[-Property] <pspropertyexpression[]>] [-InputObject <psobject>] [-StandardDeviation] [-Sum] [-AllStats] [-Average] [-Maximum] [-Minimum] [<CommonParameters>]",
  "Measure-Object [[-Property] <pspropertyexpression[]>] [-InputObject <psobject>] [-Line] [-Word] [-Character] [-IgnoreWhiteSpace] [<CommonParameters>]"
 ],
 "Group-Object": [
  "Group-Object [[-Property] <Object[]>] [-NoElement] [-AsHashTable] [-AsString] [-InputObject <psobject>] [-Culture <string>] [-CaseSensitive] [<CommonParameters>]"
 ],
 "Format-Table": [
  "Format-Table [[-Property] <Object[]>] [-AutoSize] [-RepeatHeader] [-HideTableHeaders] [-Wrap] [-GroupBy <Object>] [-View <string>] [-ShowError] [-DisplayError] [-Force] [-Expand <string>] [-InputObject <psobject>] [<CommonParameters>]"
 ],
 "Format-List": [
  "Format-List [[-Property] <Object[]>] [-GroupBy <Object>] [-View <string>] [-ShowError] [-DisplayError] [-Force] [-Expand <string>] [-InputObject <psobject>] [<CommonParameters>]"
 ],
 "Format-Wide": [
  "Format-Wide [[-Property] <Object>] [-AutoSize] [-Column <int>] [-GroupBy <Object>] [-View <string>] [-ShowError] [-DisplayError] [-Force] [-Expand <string>] [-InputObject <psobject>] [<CommonParameters>]"
 ],
 "Export-Csv": [
  "Export-Csv [[-Path] <string>] [[-Delimiter] <char>] -InputObject <psobject> [-LiteralPath <string>] [-Force] [-NoClobber] [-Encoding <Encoding>] [-Append] [-IncludeTypeInformation] [-NoTypeInformation] [-QuoteFields <string[]>] [-UseQuotes <BaseCsvWritingCommand+QuoteKind>] [-NoHeader] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Export-Csv [[-Path] <string>] -InputObject <psobject> [-LiteralPath <string>] [-Force] [-NoClobber] [-Encoding <Encoding>] [-Append] [-UseCulture] [-IncludeTypeInformation] [-NoTypeInformation] [-QuoteFields <string[]>] [-UseQuotes <BaseCsvWritingCommand+QuoteKind>] [-NoHeader] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Import-Csv": [
  "Import-Csv [-Path] <string[]> [[-Delimiter] <char>] [-Header <string[]>] [-Encoding <Encoding>] [<CommonParameters>]",
  "Import-Csv [[-Delimiter] <char>] -LiteralPath <string[]> [-Header <string[]>] [-Encoding <Encoding>] [<CommonParameters>]",
  "Import-Csv [-Path] <string[]> -UseCulture [-Header <string[]>] [-Encoding <Encoding>] [<CommonParameters>]",
  "Import-Csv -LiteralPath <string[]> -UseCulture [-Header <string[]>] [-Encoding <Encoding>] [<CommonParameters>]"
 ],
 "ConvertTo-Csv": [
  "ConvertTo-Csv [-InputObject] <psobject> [[-Delimiter] <char>] [-IncludeTypeInformation] [-NoTypeInformation] [-QuoteFields <string[]>] [-UseQuotes <BaseCsvWritingCommand+QuoteKind>] [-NoHeader] [<CommonParameters>]",
  "ConvertTo-Csv [-InputObject] <psobject> [-UseCulture] [-IncludeTypeInformation] [-NoTypeInformation] [-QuoteFields <string[]>] [-UseQuotes <BaseCsvWritingCommand+QuoteKind>] [-NoHeader] [<CommonParameters>]"
 ],
 "ConvertTo-Json": [
  "ConvertTo-Json [-InputObject] <Object> [-Depth <int>] [-Compress] [-EnumsAsStrings] [-AsArray] [-EscapeHandling <StringEscapeHandling>] [<CommonParameters>]"
 ],
 "ConvertFrom-Json": [
  "ConvertFrom-Json [-InputObject] <string> [-AsHashtable] [-Depth <int>] [-NoEnumerate] [-DateKind <JsonDateKind>] [<CommonParameters>]"
 ],
 "ConvertTo-Html": [
  "ConvertTo-Html [[-Property] <Object[]>] [[-Head] <string[]>] [[-Title] <string>] [[-Body] <string[]>] [-InputObject <psobject>] [-As <string>] [-CssUri <uri>] [-PostContent <string[]>] [-PreContent <string[]>] [-Meta <hashtable>] [-Charset <string>] [-Transitional] [<CommonParameters>]",
  "ConvertTo-Html [[-Property] <Object[]>] [-InputObject <psobject>] [-As <string>] [-Fragment] [-PostContent <string[]>] [-PreContent <string[]>] [<CommonParameters>]"
 ],
 "Get-Process": [
  "Get-Process [[-Name] <string[]>] [-Module] [-FileVersionInfo] [<CommonParameters>]",
  "Get-Process [[-Name] <string[]>] -IncludeUserName [<CommonParameters>]",
  "Get-Process -Id <int[]> [-Module] [-FileVersionInfo] [<CommonParameters>]",
  "Get-Process -Id <int[]> -IncludeUserName [<CommonParameters>]",
  "Get-Process -InputObject <Process[]> [-Module] [-FileVersionInfo] [<CommonParameters>]",
  "Get-Process -InputObject <Process[]> -IncludeUserName [<CommonParameters>]"
 ],
 "Stop-Process": [
  "Stop-Process [-Id] <int[]> [-PassThru] [-Force] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Stop-Process -Name <string[]> [-PassThru] [-Force] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Stop-Process [-InputObject] <Process[]> [-PassThru] [-Force] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Get-Service": [
  "Get-Service [[-Name] <string[]>] [-DependentServices] [-RequiredServices] [-Include <string[]>] [-Exclude <string[]>] [<CommonParameters>]",
  "Get-Service -DisplayName <string[]> [-DependentServices] [-RequiredServices] [-Include <string[]>] [-Exclude <string[]>] [<CommonParameters>]",
  "Get-Service [-DependentServices] [-RequiredServices] [-Include <string[]>] [-Exclude <string[]>] [-InputObject <ServiceController[]>] [<CommonParameters>]"
 ],
 "Start-Service": [
  "Start-Service [-InputObject] <ServiceController[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Start-Service [-Name] <string[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Start-Service -DisplayName <string[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Stop-Service": [
  "Stop-Service [-InputObject] <ServiceController[]> [-Force] [-NoWait] [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Stop-Service [-Name] <string[]> [-Force] [-NoWait] [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Stop-Service -DisplayName <string[]> [-Force] [-NoWait] [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Restart-Service": [
  "Restart-Service [-InputObject] <ServiceController[]> [-Force] [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Restart-Service [-Name] <string[]> [-Force] [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Restart-Service -DisplayName <string[]> [-Force] [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Get-Date": [
  "Get-Date [[-Date] <datetime>] [-Year <int>] [-Month <int>] [-Day <int>] [-Hour <int>] [-Minute <int>] [-Second <int>] [-Millisecond <int>] [-DisplayHint <DisplayHintType>] [-Format <string>] [-AsUTC] [<CommonParameters>]",
  "Get-Date [[-Date] <datetime>] -UFormat <string> [-Year <int>] [-Month <int>] [-Day <int>] [-Hour <int>] [-Minute <int>] [-Second <int>] [-Millisecond <int>] [-DisplayHint <DisplayHintType>] [-AsUTC] [<CommonParameters>]",
  "Get-Date -UnixTimeSeconds <long> [-Year <int>] [-Month <int>] [-Day <int>] [-Hour <int>] [-Minute <int>] [-Second <int>] [-Millisecond <int>] [-DisplayHint <DisplayHintType>] [-Format <string>] [-AsUTC] [<CommonParameters>]",
  "Get-Date -UnixTimeSeconds <long> -UFormat <string> [-Year <int>] [-Month <int>] [-Day <int>] [-Hour <int>] [-Minute <int>] [-Second <int>] [-Millisecond <int>] [-DisplayHint <DisplayHintType>] [-AsUTC] [<CommonParameters>]"
 ],
 "Test-Connection": [
  "Test-Connection [-TargetName] <string[]> [-Ping] [-IPv4] [-IPv6] [-ResolveDestination] [-Source <string>] [-MaxHops <int>] [-Count <int>] [-Delay <int>] [-BufferSize <int>] [-DontFragment] [-Quiet] [-TimeoutSeconds <int>] [<CommonParameters>]",
  "Test-Connection [-TargetName] <string[]> -Repeat [-Ping] [-IPv4] [-IPv6] [-ResolveDestination] [-Source <string>] [-MaxHops <int>] [-Delay <int>] [-BufferSize <int>] [-DontFragment] [-Quiet] [-TimeoutSeconds <int>] [<CommonParameters>]",
  "Test-Connection [-TargetName] <string[]> -Traceroute [-IPv4] [-IPv6] [-ResolveDestination] [-Source <string>] [-MaxHops <int>] [-Quiet] [-TimeoutSeconds <int>] [<CommonParameters>]",
  "Test-Connection [-TargetName] <string[]> -MtuSize [-IPv4] [-IPv6] [-ResolveDestination] [-Quiet] [-TimeoutSeconds <int>] [<CommonParameters>]",
  "Test-Connection [-TargetName] <string[]> -TcpPort <int> [-IPv4] [-IPv6] [-ResolveDestination] [-Source <string>] [-Count <int>] [-Delay <int>] [-Repeat] [-Quiet] [-TimeoutSeconds <int>] [-Detailed] [<CommonParameters>]"
 ],
 "Get-PSDrive": [
  "Get-PSDrive [[-Name] <string[]>] [-Scope <string>] [-PSProvider <string[]>] [<CommonParameters>]",
  "Get-PSDrive [-LiteralName] <string[]> [-Scope <string>] [-PSProvider <string[]>] [<CommonParameters>]"
 ],
 "Get-ExecutionPolicy": [
  "Get-ExecutionPolicy [[-Scope] <ExecutionPolicyScope>] [-List] [<CommonParameters>]"
 ],
 "Write-Host": [
  "Write-Host [[-Object] <Object>] [-NoNewline] [-Separator <Object>] [-ForegroundColor <ConsoleColor>] [-BackgroundColor <ConsoleColor>] [<CommonParameters>]"
 ],
 "Write-Output": [
  "Write-Output [-InputObject] <psobject> [-NoEnumerate] [<CommonParameters>]"
 ],
 "Clear-Host": [
  "Clear-Host"
 ],
 "Write-Error": [
  "Write-Error [-Message] <string> [-Category <ErrorCategory>] [-ErrorId <string>] [-TargetObject <Object>] [-RecommendedAction <string>] [-CategoryActivity <string>] [-CategoryReason <string>] [-CategoryTargetName <string>] [-CategoryTargetType <string>] [<CommonParameters>]",
  "Write-Error [-Exception] <Exception> [-Message <string>] [-Category <ErrorCategory>] [-ErrorId <string>] [-TargetObject <Object>] [-RecommendedAction <string>] [-CategoryActivity <string>] [-CategoryReason <string>] [-CategoryTargetName <string>] [-CategoryTargetType <string>] [<CommonParameters>]",
  "Write-Error [-ErrorRecord] <ErrorRecord> [-RecommendedAction <string>] [-CategoryActivity <string>] [-CategoryReason <string>] [-CategoryTargetName <string>] [-CategoryTargetType <string>] [<CommonParameters>]"
 ],
 "Write-Warning": [
  "Write-Warning [-Message] <string> [<CommonParameters>]"
 ],
 "Write-Verbose": [
  "Write-Verbose [-Message] <string> [<CommonParameters>]"
 ],
 "Out-Null": [
  "Out-Null [-InputObject <psobject>] [<CommonParameters>]"
 ],
 "Out-String": [
  "Out-String [-Width <int>] [-NoNewline] [-InputObject <psobject>] [<CommonParameters>]",
  "Out-String [-Stream] [-Width <int>] [-InputObject <psobject>] [<CommonParameters>]"
 ],
 "Out-Host": [
  "Out-Host [-Paging] [-InputObject <psobject>] [<CommonParameters>]"
 ],
 "Start-Sleep": [
  "Start-Sleep [-Seconds] <double> [<CommonParameters>]",
  "Start-Sleep -Milliseconds <int> [<CommonParameters>]",
  "Start-Sleep [-Duration] <timespan> [<CommonParameters>]"
 ],
 "Clear-Content": [
  "Clear-Content [-Path] <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-Stream <string>] [<CommonParameters>]",
  "Clear-Content -LiteralPath <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Force] [-Credential <pscredential>] [-WhatIf] [-Confirm] [-Stream <string>] [<CommonParameters>]"
 ],
 "Resolve-Path": [
  "Resolve-Path [-Path] <string[]> [-Relative] [-RelativeBasePath <string>] [-Force] [-Credential <pscredential>] [<CommonParameters>]",
  "Resolve-Path -LiteralPath <string[]> [-Relative] [-RelativeBasePath <string>] [-Force] [-Credential <pscredential>] [<CommonParameters>]"
 ],
 "Split-Path": [
  "Split-Path [-Path] <string[]> [-Parent] [-Resolve] [-Credential <pscredential>] [<CommonParameters>]",
  "Split-Path [-Path] <string[]> -Leaf [-Resolve] [-Credential <pscredential>] [<CommonParameters>]",
  "Split-Path [-Path] <string[]> -LeafBase [-Resolve] [-Credential <pscredential>] [<CommonParameters>]",
  "Split-Path [-Path] <string[]> -Extension [-Resolve] [-Credential <pscredential>] [<CommonParameters>]",
  "Split-Path [-Path] <string[]> -Qualifier [-Resolve] [-Credential <pscredential>] [<CommonParameters>]",
  "Split-Path [-Path] <string[]> -NoQualifier [-Resolve] [-Credential <pscredential>] [<CommonParameters>]",
  "Split-Path [-Path] <string[]> -IsAbsolute [-Resolve] [-Credential <pscredential>] [<CommonParameters>]",
  "Split-Path -LiteralPath <string[]> [-Resolve] [-Credential <pscredential>] [<CommonParameters>]"
 ],
 "Set-ExecutionPolicy": [
  "Set-ExecutionPolicy [-ExecutionPolicy] <ExecutionPolicy> [[-Scope] <ExecutionPolicyScope>] [-Force] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "ConvertFrom-Csv": [
  "ConvertFrom-Csv [-InputObject] <psobject[]> [[-Delimiter] <char>] [-Header <string[]>] [<CommonParameters>]",
  "ConvertFrom-Csv [-InputObject] <psobject[]> -UseCulture [-Header <string[]>] [<CommonParameters>]"
 ],
 "New-TimeSpan": [
  "New-TimeSpan [[-Start] <datetime>] [[-End] <datetime>] [<CommonParameters>]",
  "New-TimeSpan [-Days <int>] [-Hours <int>] [-Minutes <int>] [-Seconds <int>] [-Milliseconds <int>] [<CommonParameters>]"
 ],
 "Get-Culture": [
  "Get-Culture [-NoUserOverrides] [<CommonParameters>]",
  "Get-Culture [[-Name] <string[]>] [-NoUserOverrides] [<CommonParameters>]",
  "Get-Culture [-ListAvailable] [<CommonParameters>]"
 ],
 "New-Service": [
  "New-Service [-Name] <string> [-BinaryPathName] <string> [-DisplayName <string>] [-Description <string>] [-StartupType <ServiceStartupType>] [-Credential <pscredential>] [-SecurityDescriptorSddl <string>] [-DependsOn <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Remove-Service": [
  "Remove-Service [-Name] <string> [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Remove-Service [-InputObject <ServiceController>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Resume-Service": [
  "Resume-Service [-InputObject] <ServiceController[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Resume-Service [-Name] <string[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Resume-Service -DisplayName <string[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Set-Service": [
  "Set-Service [-Name] <string> [-DisplayName <string>] [-Credential <pscredential>] [-Description <string>] [-StartupType <ServiceStartupType>] [-SecurityDescriptorSddl <string>] [-Status <string>] [-Force] [-PassThru] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Set-Service [-InputObject] <ServiceController> [-DisplayName <string>] [-Credential <pscredential>] [-Description <string>] [-StartupType <ServiceStartupType>] [-SecurityDescriptorSddl <string>] [-Status <string>] [-Force] [-PassThru] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Suspend-Service": [
  "Suspend-Service [-InputObject] <ServiceController[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Suspend-Service [-Name] <string[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Suspend-Service -DisplayName <string[]> [-PassThru] [-Include <string[]>] [-Exclude <string[]>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Clear-Item": [
  "Clear-Item [-Path] <string[]> [-Force] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Clear-Item -LiteralPath <string[]> [-Force] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Invoke-Item": [
  "Invoke-Item [-Path] <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Invoke-Item -LiteralPath <string[]> [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Set-Item": [
  "Set-Item [-Path] <string[]> [[-Value] <Object>] [-Force] [-PassThru] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Set-Item [[-Value] <Object>] -LiteralPath <string[]> [-Force] [-PassThru] [-Filter <string>] [-Include <string[]>] [-Exclude <string[]>] [-Credential <pscredential>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Debug-Process": [
  "Debug-Process [-Name] <string[]> [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Debug-Process [-Id] <int[]> [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Debug-Process -InputObject <Process[]> [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Start-Process": [
  "Start-Process [-FilePath] <string> [[-ArgumentList] <string[]>] [-Credential <pscredential>] [-WorkingDirectory <string>] [-LoadUserProfile] [-NoNewWindow] [-PassThru] [-RedirectStandardError <string>] [-RedirectStandardInput <string>] [-RedirectStandardOutput <string>] [-WindowStyle <ProcessWindowStyle>] [-Wait] [-UseNewEnvironment] [-Environment <hashtable>] [-WhatIf] [-Confirm] [<CommonParameters>]",
  "Start-Process [-FilePath] <string> [[-ArgumentList] <string[]>] [-WorkingDirectory <string>] [-PassThru] [-Verb <string>] [-WindowStyle <ProcessWindowStyle>] [-Wait] [-Environment <hashtable>] [-WhatIf] [-Confirm] [<CommonParameters>]"
 ],
 "Wait-Process": [
  "Wait-Process [-Name] <string[]> [[-Timeout] <int>] [-Any] [-PassThru] [<CommonParameters>]",
  "Wait-Process [-Id] <int[]> [[-Timeout] <int>] [-Any] [-PassThru] [<CommonParameters>]",
  "Wait-Process [[-Timeout] <int>] -InputObject <Process[]> [-Any] [-PassThru] [<CommonParameters>]"
 ],
 "Pop-Location": [
  "Pop-Location [-PassThru] [-StackName <string>] [<CommonParameters>]"
 ],
 "Push-Location": [
  "Push-Location [[-Path] <string>] [-PassThru] [-StackName <string>] [<CommonParameters>]",
  "Push-Location [-LiteralPath <string>] [-PassThru] [-StackName <string>] [<CommonParameters>]"
 ]
};
  // Parameter aus pwsh 7.6.1 in dessen Reihenfolge, mit Zweitnamen ((Get-Command X).Parameters.Values, ohne gemeinsame
  // Parameter). Reihenfolge und Zweitnamen zählen beim Abkürzen wie in pwsh: -P passt bei Get-ChildItem auch auf
  // -LiteralPath (Zweitname PSPath) und wird darum als «-Path -ProgressAction -PipelineVariable -LiteralPath» gemeldet.
  const PARAMETER_PWSH = {
    "Get-ChildItem": "Path LiteralPath=PSPath,LP Filter Include Exclude Recurse=s,r Depth Force Name Attributes FollowSymlink Directory=ad File=af Hidden=ah,h ReadOnly=ar System=as",
    "Get-Item": "Path LiteralPath=PSPath,LP Filter Include Exclude Force Credential Stream",
    "Test-Path": "Path LiteralPath=PSPath,LP Filter Include Exclude PathType=Type IsValid Credential OlderThan NewerThan",
    "Join-Path": "Path=PSPath ChildPath AdditionalChildPath Resolve Credential",
    "Split-Path": "Path LiteralPath=PSPath,LP Qualifier NoQualifier Parent Leaf LeafBase Extension Resolve IsAbsolute Credential",
    "Resolve-Path": "Path LiteralPath=PSPath,LP Relative RelativeBasePath Force Credential",
    "Get-Location": "PSProvider PSDrive Stack StackName",
    "Set-Location": "Path LiteralPath=PSPath,LP PassThru StackName",
    "New-Item": "Path Name ItemType=Type Value=Target Force Credential",
    "Copy-Item": "Path LiteralPath=PSPath,LP Destination Container Force Filter Include Exclude Recurse PassThru Credential FromSession ToSession",
    "Move-Item": "Path LiteralPath=PSPath,LP Destination Force Filter Include Exclude PassThru Credential",
    "Rename-Item": "Path LiteralPath=PSPath,LP NewName Force PassThru Credential",
    "Remove-Item": "Path LiteralPath=PSPath,LP Filter Include Exclude Recurse Force Credential Stream",
    "Get-Content": "ReadCount TotalCount=First,Head Tail=Last Path LiteralPath=PSPath,LP Filter Include Exclude Force Credential Delimiter Wait Raw Encoding AsByteStream Stream",
    "Set-Content": "Value PassThru Path LiteralPath=PSPath,LP Filter Include Exclude Force Credential NoNewline Encoding AsByteStream Stream",
    "Add-Content": "Value PassThru Path LiteralPath=PSPath,LP Filter Include Exclude Force Credential NoNewline Encoding AsByteStream Stream",
    "Clear-Content": "Path LiteralPath=PSPath,LP Filter Include Exclude Force Credential Stream",
    "Out-File": "FilePath=Path LiteralPath=PSPath,LP Encoding Append Force NoClobber=NoOverwrite Width NoNewline InputObject",
    "Where-Object": "InputObject FilterScript Property Value EQ=IEQ CEQ NE=INE CNE GT=IGT CGT LT=ILT CLT GE=IGE CGE LE=ILE CLE Like=ILike CLike NotLike=INotLike CNotLike Match=IMatch CMatch NotMatch=INotMatch CNotMatch Contains=IContains CContains NotContains=INotContains CNotContains In=IIn CIn NotIn=INotIn CNotIn Is IsNot Not",
    "ForEach-Object": "InputObject Begin Process End RemainingScripts MemberName ArgumentList=Args Parallel ThrottleLimit TimeoutSeconds AsJob UseNewRunspace",
    "Sort-Object": "Stable Descending Unique Top Bottom InputObject Property Culture CaseSensitive",
    "Select-Object": "InputObject Property ExcludeProperty ExpandProperty Unique CaseInsensitive Last First Skip SkipLast Wait Index SkipIndex",
    "Measure-Object": "InputObject Property StandardDeviation Sum AllStats Average Maximum Minimum Line Word Character IgnoreWhiteSpace",
    "Group-Object": "NoElement AsHashTable=AHT AsString InputObject Property Culture CaseSensitive",
    "Format-Table": "AutoSize RepeatHeader HideTableHeaders Wrap Property GroupBy View ShowError DisplayError Force Expand InputObject",
    "Format-List": "Property GroupBy View ShowError DisplayError Force Expand InputObject",
    "Format-Wide": "Property AutoSize Column GroupBy View ShowError DisplayError Force Expand InputObject",
    "Export-Csv": "InputObject Path LiteralPath=PSPath,LP Force NoClobber=NoOverwrite Encoding Append Delimiter UseCulture IncludeTypeInformation=ITI NoTypeInformation=NTI QuoteFields=QF UseQuotes=UQ NoHeader",
    "ConvertTo-Csv": "InputObject Delimiter UseCulture IncludeTypeInformation=ITI NoTypeInformation=NTI QuoteFields=QF UseQuotes=UQ NoHeader",
    "Import-Csv": "Delimiter Path LiteralPath=PSPath,LP UseCulture Header Encoding",
    "ConvertFrom-Csv": "Delimiter UseCulture InputObject Header",
    "ConvertTo-Json": "InputObject Depth Compress EnumsAsStrings AsArray EscapeHandling",
    "ConvertFrom-Json": "InputObject AsHashtable Depth NoEnumerate DateKind",
    "ConvertTo-Html": "InputObject Property Body Head Title As CssUri=cu,uri Fragment PostContent PreContent Meta Charset Transitional",
    "Write-Host": "Object=Msg,Message NoNewline Separator ForegroundColor BackgroundColor",
    "Write-Output": "InputObject NoEnumerate",
    "Write-Error": "Exception Message=Msg ErrorRecord Category ErrorId TargetObject RecommendedAction CategoryActivity=Activity CategoryReason=Reason CategoryTargetName=TargetName CategoryTargetType=TargetType",
    "Write-Warning": "Message=Msg",
    "Write-Verbose": "Message=Msg",
    "Out-Null": "InputObject",
    "Out-Host": "Paging InputObject",
    "Out-String": "Stream Width NoNewline InputObject",
    "Start-Sleep": "Seconds Milliseconds=ms Duration=ts",
    "Get-Date": "Date=LastWriteTime UnixTimeSeconds=UnixTime Year Month Day Hour Minute Second Millisecond DisplayHint UFormat Format AsUTC",
    "New-TimeSpan": "Start=LastWriteTime End Days Hours Minutes Seconds Milliseconds",
    "Get-Culture": "Name NoUserOverrides ListAvailable",
    "Get-Member": "InputObject Name MemberType=Type View Static Force",
    "Get-Command": "Name Verb Noun Module=PSSnapin ExcludeModule FullyQualifiedModule CommandType=Type TotalCount Syntax ShowCommandInfo ArgumentList=Args All ListImported ParameterName ParameterType UseFuzzyMatching FuzzyMinimumDistance UseAbbreviationExpansion",
    "Get-Alias": "Name Exclude Scope Definition",
    "Get-Verb": "Verb Group",
    "Get-History": "Id Count",
    "Get-Process": "Name=ProcessName Id=PID InputObject IncludeUserName Module FileVersionInfo=FV,FVI",
    "Stop-Process": "Name=ProcessName Id InputObject PassThru Force",
    "Get-Service": "Name=ServiceName DependentServices=DS RequiredServices=SDO,ServicesDependedOn DisplayName Include Exclude InputObject",
    "Start-Service": "Name=ServiceName InputObject PassThru DisplayName Include Exclude",
    "Stop-Service": "Force NoWait Name=ServiceName InputObject PassThru DisplayName Include Exclude",
    "Restart-Service": "Force Name=ServiceName InputObject PassThru DisplayName Include Exclude",
    "Test-Connection": "Ping IPv4 IPv6 ResolveDestination Source MaxHops=Ttl,TimeToLive,Hops Count Delay BufferSize=Size,Bytes,BS DontFragment Repeat=Continuous Quiet TimeoutSeconds TargetName=ComputerName MtuSize=MtuSizeDetect Traceroute TcpPort Detailed",
    "Get-PSDrive": "Name LiteralName Scope PSProvider",
    "Get-ExecutionPolicy": "Scope List",
    "Set-ExecutionPolicy": "ExecutionPolicy Scope Force",
    "Get-Help": "Name Path Category Detailed Full Examples Parameter Component Functionality Role Online ShowWindow"
  };
  // Dynamische Parameter (Laufwerk C:, FileSystem). pwsh zieht sie beim Abkürzen erst heran, wenn kein fester Parameter passt.
  const DYNAMISCHE_PARAMETER = {
    "Get-ChildItem": "Attributes,FollowSymlink,Directory,File,Hidden,ReadOnly,System",
    "Get-Item": "Stream",
    "Test-Path": "OlderThan,NewerThan",
    "Copy-Item": "FromSession,ToSession",
    "Remove-Item": "Stream",
    "Get-Content": "Delimiter,Wait,Raw,Encoding,AsByteStream,Stream",
    "Set-Content": "NoNewline,Encoding,AsByteStream,Stream",
    "Add-Content": "NoNewline,Encoding,AsByteStream,Stream",
    "Clear-Content": "Stream"
  };
  const MEMBER_DATEN = {
 "System.String": "Clone|Method|System.Object Clone(), System.Object ICloneable.Clone()\nCompareTo|Method|int CompareTo(System.Object value), int CompareTo(string strB), int IComparable.CompareTo(System.Object obj), int IComparable[string].CompareTo(string other)\nContains|Method|bool Contains(string value), bool Contains(string value, System.StringComparison comparisonType), bool Contains(char value), bool Contains(char value, System.StringComparison comparisonType)\nCopyTo|Method|void CopyTo(int sourceIndex, char[] destination, int destinationIndex, int count), void CopyTo(System.Span[char] destination)\nEndsWith|Method|bool EndsWith(string value), bool EndsWith(string value, System.StringComparison comparisonType), bool EndsWith(string value, bool ignoreCase, cultureinfo culture), bool EndsWith(char value)\nEnumerateRunes|Method|System.Text.StringRuneEnumerator EnumerateRunes()\nEquals|Method|bool Equals(System.Object obj), bool Equals(string value), bool Equals(string value, System.StringComparison comparisonType), bool IEquatable[string].Equals(string other)\nGetEnumerator|Method|System.CharEnumerator GetEnumerator(), System.Collections.IEnumerator IEnumerable.GetEnumerator(), System.Collections.Generic.IEnumerator[char] IEnumerable[char].GetEnumerator()\nGetHashCode|Method|int GetHashCode(), int GetHashCode(System.StringComparison comparisonType)\nGetPinnableReference|Method|System.Char&, System.Private.CoreLib, Version=10.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e GetPinnableReference()\nGetType|Method|type GetType()\nGetTypeCode|Method|System.TypeCode GetTypeCode(), System.TypeCode IConvertible.GetTypeCode()\nIndexOf|Method|int IndexOf(char value), int IndexOf(char value, int startIndex), int IndexOf(char value, System.StringComparison comparisonType), int IndexOf(char value, int startIndex, int count), int IndexOf(string value), int IndexOf(string value, int startIndex), int IndexOf(string value, int startIndex, int count), int IndexOf(string value, System.StringComparison comparisonType), int IndexOf(string value, int startIndex, System.StringComparison comparisonType), int IndexOf(string value, int startIndex, int count, System.StringComparison comparisonType)\nIndexOfAny|Method|int IndexOfAny(char[] anyOf), int IndexOfAny(char[] anyOf, int startIndex), int IndexOfAny(char[] anyOf, int startIndex, int count)\nInsert|Method|string Insert(int startIndex, string value)\nIsNormalized|Method|bool IsNormalized(), bool IsNormalized(System.Text.NormalizationForm normalizationForm)\nLastIndexOf|Method|int LastIndexOf(char value), int LastIndexOf(char value, int startIndex), int LastIndexOf(char value, int startIndex, int count), int LastIndexOf(string value), int LastIndexOf(string value, int startIndex), int LastIndexOf(string value, int startIndex, int count), int LastIndexOf(string value, System.StringComparison comparisonType), int LastIndexOf(string value, int startIndex, System.StringComparison comparisonType), int LastIndexOf(string value, int startIndex, int count, System.StringComparison comparisonType)\nLastIndexOfAny|Method|int LastIndexOfAny(char[] anyOf), int LastIndexOfAny(char[] anyOf, int startIndex), int LastIndexOfAny(char[] anyOf, int startIndex, int count)\nNormalize|Method|string Normalize(), string Normalize(System.Text.NormalizationForm normalizationForm)\nPadLeft|Method|string PadLeft(int totalWidth), string PadLeft(int totalWidth, char paddingChar)\nPadRight|Method|string PadRight(int totalWidth), string PadRight(int totalWidth, char paddingChar)\nRemove|Method|string Remove(int startIndex, int count), string Remove(int startIndex)\nReplace|Method|string Replace(string oldValue, string newValue, bool ignoreCase, cultureinfo culture), string Replace(string oldValue, string newValue, System.StringComparison comparisonType), string Replace(char oldChar, char newChar), string Replace(string oldValue, string newValue)\nReplaceLineEndings|Method|string ReplaceLineEndings(), string ReplaceLineEndings(string replacementText)\nSplit|Method|string[] Split(char separator, System.StringSplitOptions options = System.StringSplitOptions.None), string[] Split(char separator, int count, System.StringSplitOptions options = System.StringSplitOptions.None), string[] Split(Params char[] separator), string[] Split(System.ReadOnlySpan[char] separator), string[] Split(char[] separator, int count), string[] Split(char[] separator, System.StringSplitOptions options), string[] Split(char[] separator, int count, System.StringSplitOptions options), string[] Split(string separator, System.StringSplitOptions options = System.StringSplitOptions.None), string[] Split(string separator, int count, System.StringSplitOptions options = System.StringSplitOptions.None), string[] Split(string[] separator, System.StringSplitOptions options), string[] Split(string[] separator, int count, System.StringSplitOptions options)\nStartsWith|Method|bool StartsWith(string value), bool StartsWith(string value, System.StringComparison comparisonType), bool StartsWith(string value, bool ignoreCase, cultureinfo culture), bool StartsWith(char value)\nSubstring|Method|string Substring(int startIndex), string Substring(int startIndex, int length)\nToBoolean|Method|bool IConvertible.ToBoolean(System.IFormatProvider provider)\nToByte|Method|byte IConvertible.ToByte(System.IFormatProvider provider)\nToChar|Method|char IConvertible.ToChar(System.IFormatProvider provider)\nToCharArray|Method|char[] ToCharArray(), char[] ToCharArray(int startIndex, int length)\nToDateTime|Method|datetime IConvertible.ToDateTime(System.IFormatProvider provider)\nToDecimal|Method|decimal IConvertible.ToDecimal(System.IFormatProvider provider)\nToDouble|Method|double IConvertible.ToDouble(System.IFormatProvider provider)\nToInt16|Method|short IConvertible.ToInt16(System.IFormatProvider provider)\nToInt32|Method|int IConvertible.ToInt32(System.IFormatProvider provider)\nToInt64|Method|long IConvertible.ToInt64(System.IFormatProvider provider)\nToLower|Method|string ToLower(), string ToLower(cultureinfo culture)\nToLowerInvariant|Method|string ToLowerInvariant()\nToSByte|Method|sbyte IConvertible.ToSByte(System.IFormatProvider provider)\nToSingle|Method|float IConvertible.ToSingle(System.IFormatProvider provider)\nToString|Method|string ToString(), string ToString(System.IFormatProvider provider), string IConvertible.ToString(System.IFormatProvider provider)\nToType|Method|System.Object IConvertible.ToType(type conversionType, System.IFormatProvider provider)\nToUInt16|Method|ushort IConvertible.ToUInt16(System.IFormatProvider provider)\nToUInt32|Method|uint IConvertible.ToUInt32(System.IFormatProvider provider)\nToUInt64|Method|ulong IConvertible.ToUInt64(System.IFormatProvider provider)\nToUpper|Method|string ToUpper(), string ToUpper(cultureinfo culture)\nToUpperInvariant|Method|string ToUpperInvariant()\nTrim|Method|string Trim(), string Trim(char trimChar), string Trim(Params char[] trimChars), string Trim(System.ReadOnlySpan[char] trimChars)\nTrimEnd|Method|string TrimEnd(), string TrimEnd(char trimChar), string TrimEnd(Params char[] trimChars), string TrimEnd(System.ReadOnlySpan[char] trimChars)\nTrimStart|Method|string TrimStart(), string TrimStart(char trimChar), string TrimStart(Params char[] trimChars), string TrimStart(System.ReadOnlySpan[char] trimChars)\nTryCopyTo|Method|bool TryCopyTo(System.Span[char] destination)\nChars|ParameterizedProperty|char Chars(int index) {get;}\nLength|Property|int Length {get;}",
 "System.Int32": "CompareTo|Method|int CompareTo(System.Object value), int CompareTo(int value), int IComparable.CompareTo(System.Object obj), int IComparable[int].CompareTo(int other)\nEquals|Method|bool Equals(System.Object obj), bool Equals(int obj), bool IEquatable[int].Equals(int other)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nToString|Method|string ToString(), string ToString(string format), string ToString(System.IFormatProvider provider), string ToString(string format, System.IFormatProvider provider), string IConvertible.ToString(System.IFormatProvider provider), string IFormattable.ToString(string format, System.IFormatProvider formatProvider)",
 "System.Double": "CompareTo|Method|int CompareTo(System.Object value), int CompareTo(double value), int IComparable.CompareTo(System.Object obj), int IComparable[double].CompareTo(double other)\nEquals|Method|bool Equals(System.Object obj), bool Equals(double obj), bool IEquatable[double].Equals(double other)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nToString|Method|string ToString(), string ToString(string format), string ToString(System.IFormatProvider provider), string ToString(string format, System.IFormatProvider provider), string IConvertible.ToString(System.IFormatProvider provider), string IFormattable.ToString(string format, System.IFormatProvider formatProvider)",
 "System.Boolean": "CompareTo|Method|int CompareTo(System.Object obj), int CompareTo(bool value), int IComparable.CompareTo(System.Object obj), int IComparable[bool].CompareTo(bool other)\nEquals|Method|bool Equals(System.Object obj), bool Equals(bool obj), bool IEquatable[bool].Equals(bool other)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nToString|Method|string ToString(), string ToString(System.IFormatProvider provider), string IConvertible.ToString(System.IFormatProvider provider)",
 "System.DateTime": "AddDays|Method|datetime AddDays(double value)\nAddHours|Method|datetime AddHours(double value)\nAddMinutes|Method|datetime AddMinutes(double value)\nAddMonths|Method|datetime AddMonths(int months)\nAddSeconds|Method|datetime AddSeconds(double value)\nAddYears|Method|datetime AddYears(int value)\nCompareTo|Method|int CompareTo(System.Object value), int CompareTo(datetime value), int IComparable.CompareTo(System.Object obj), int IComparable[datetime].CompareTo(datetime other)\nEquals|Method|bool Equals(System.Object value), bool Equals(datetime value), bool IEquatable[datetime].Equals(datetime other)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nSubtract|Method|timespan Subtract(datetime value), datetime Subtract(timespan value)\nToLongDateString|Method|string ToLongDateString()\nToLongTimeString|Method|string ToLongTimeString()\nToShortDateString|Method|string ToShortDateString()\nToShortTimeString|Method|string ToShortTimeString()\nToString|Method|string ToString(), string ToString(string format), string ToString(System.IFormatProvider provider), string ToString(string format, System.IFormatProvider provider), string IFormattable.ToString(string format, System.IFormatProvider formatProvider), string IConvertible.ToString(System.IFormatProvider provider)\nDate|Property|datetime Date {get;}\nDay|Property|int Day {get;}\nDayOfWeek|Property|System.DayOfWeek DayOfWeek {get;}\nDayOfYear|Property|int DayOfYear {get;}\nHour|Property|int Hour {get;}\nKind|Property|System.DateTimeKind Kind {get;}\nMicrosecond|Property|int Microsecond {get;}\nMillisecond|Property|int Millisecond {get;}\nMinute|Property|int Minute {get;}\nMonth|Property|int Month {get;}\nNanosecond|Property|int Nanosecond {get;}\nSecond|Property|int Second {get;}\nTicks|Property|long Ticks {get;}\nTimeOfDay|Property|timespan TimeOfDay {get;}\nYear|Property|int Year {get;}\nDateTime|ScriptProperty|System.Object DateTime {get=if ((& { Set-StrictMode -Version 1; $this.DisplayHint }) -ieq \"Date\") { \"{0}\" -f $this.ToLongDateString() } elseif ((& { Set-StrictMode -Version 1; $this.DisplayHint }) -ieq \"Time\") { \"{0}\" -f $this.ToLongTimeString() } else { \"{0} {1}\" -f $this.ToLongDateString(), $this.ToLongTimeString() };}",
 "System.IO.FileInfo": "Target|AliasProperty|Target = LinkTarget\nLinkType|CodeProperty|System.String LinkType{get=GetLinkType;}\nMode|CodeProperty|System.String Mode{get=Mode;}\nModeWithoutHardLink|CodeProperty|System.String ModeWithoutHardLink{get=ModeWithoutHardLink;}\nResolvedTarget|CodeProperty|System.String ResolvedTarget{get=ResolvedTarget;}\nCopyTo|Method|System.IO.FileInfo CopyTo(string destFileName), System.IO.FileInfo CopyTo(string destFileName, bool overwrite)\nDelete|Method|void Delete()\nEquals|Method|bool Equals(System.Object obj)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nMoveTo|Method|void MoveTo(string destFileName), void MoveTo(string destFileName, bool overwrite)\nRefresh|Method|void Refresh()\nToString|Method|string ToString()\nAttributes|Property|System.IO.FileAttributes Attributes {get;set;}\nCreationTime|Property|datetime CreationTime {get;set;}\nCreationTimeUtc|Property|datetime CreationTimeUtc {get;set;}\nDirectory|Property|System.IO.DirectoryInfo Directory {get;}\nDirectoryName|Property|string DirectoryName {get;}\nExists|Property|bool Exists {get;}\nExtension|Property|string Extension {get;}\nFullName|Property|string FullName {get;}\nIsReadOnly|Property|bool IsReadOnly {get;set;}\nLastAccessTime|Property|datetime LastAccessTime {get;set;}\nLastAccessTimeUtc|Property|datetime LastAccessTimeUtc {get;set;}\nLastWriteTime|Property|datetime LastWriteTime {get;set;}\nLastWriteTimeUtc|Property|datetime LastWriteTimeUtc {get;set;}\nLength|Property|long Length {get;}\nLinkTarget|Property|string LinkTarget {get;}\nName|Property|string Name {get;}\nUnixFileMode|Property|System.IO.UnixFileMode UnixFileMode {get;set;}\nBaseName|ScriptProperty|System.Object BaseName {get=if ($this.Extension.Length -gt 0){$this.Name.Remove($this.Name.Length - $this.Extension.Length)}else{$this.Name};}\nVersionInfo|ScriptProperty|System.Object VersionInfo {get=[System.Diagnostics.FileVersionInfo]::GetVersionInfo($this.FullName);}",
 "System.IO.DirectoryInfo": "Target|AliasProperty|Target = LinkTarget\nLinkType|CodeProperty|System.String LinkType{get=GetLinkType;}\nMode|CodeProperty|System.String Mode{get=Mode;}\nModeWithoutHardLink|CodeProperty|System.String ModeWithoutHardLink{get=ModeWithoutHardLink;}\nResolvedTarget|CodeProperty|System.String ResolvedTarget{get=ResolvedTarget;}\nCreateSubdirectory|Method|System.IO.DirectoryInfo CreateSubdirectory(string path)\nDelete|Method|void Delete(), void Delete(bool recursive)\nEquals|Method|bool Equals(System.Object obj)\nGetDirectories|Method|System.IO.DirectoryInfo[] GetDirectories(), System.IO.DirectoryInfo[] GetDirectories(string searchPattern), System.IO.DirectoryInfo[] GetDirectories(string searchPattern, System.IO.SearchOption searchOption), System.IO.DirectoryInfo[] GetDirectories(string searchPattern, System.IO.EnumerationOptions enumerationOptions)\nGetFiles|Method|System.IO.FileInfo[] GetFiles(), System.IO.FileInfo[] GetFiles(string searchPattern), System.IO.FileInfo[] GetFiles(string searchPattern, System.IO.SearchOption searchOption), System.IO.FileInfo[] GetFiles(string searchPattern, System.IO.EnumerationOptions enumerationOptions)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nMoveTo|Method|void MoveTo(string destDirName)\nRefresh|Method|void Refresh()\nToString|Method|string ToString()\nAttributes|Property|System.IO.FileAttributes Attributes {get;set;}\nCreationTime|Property|datetime CreationTime {get;set;}\nCreationTimeUtc|Property|datetime CreationTimeUtc {get;set;}\nExists|Property|bool Exists {get;}\nExtension|Property|string Extension {get;}\nFullName|Property|string FullName {get;}\nLastAccessTime|Property|datetime LastAccessTime {get;set;}\nLastAccessTimeUtc|Property|datetime LastAccessTimeUtc {get;set;}\nLastWriteTime|Property|datetime LastWriteTime {get;set;}\nLastWriteTimeUtc|Property|datetime LastWriteTimeUtc {get;set;}\nLinkTarget|Property|string LinkTarget {get;}\nName|Property|string Name {get;}\nParent|Property|System.IO.DirectoryInfo Parent {get;}\nRoot|Property|System.IO.DirectoryInfo Root {get;}\nUnixFileMode|Property|System.IO.UnixFileMode UnixFileMode {get;set;}\nBaseName|ScriptProperty|System.Object BaseName {get=$this.Name;}",
 "System.Diagnostics.Process": "Handles|AliasProperty|Handles = Handlecount\nName|AliasProperty|Name = ProcessName\nNPM|AliasProperty|NPM = NonpagedSystemMemorySize64\nPM|AliasProperty|PM = PagedMemorySize64\nSI|AliasProperty|SI = SessionId\nVM|AliasProperty|VM = VirtualMemorySize64\nWS|AliasProperty|WS = WorkingSet64\nEquals|Method|bool Equals(System.Object obj)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nKill|Method|void Kill(), void Kill(bool entireProcessTree)\nRefresh|Method|void Refresh()\nToString|Method|string ToString()\nWaitForExit|Method|void WaitForExit(), bool WaitForExit(int milliseconds), bool WaitForExit(timespan timeout)\nBasePriority|Property|int BasePriority {get;}\nHandleCount|Property|int HandleCount {get;}\nHasExited|Property|bool HasExited {get;}\nId|Property|int Id {get;}\nMachineName|Property|string MachineName {get;}\nMainWindowTitle|Property|string MainWindowTitle {get;}\nNonpagedSystemMemorySize64|Property|long NonpagedSystemMemorySize64 {get;}\nPriorityClass|Property|System.Diagnostics.ProcessPriorityClass PriorityClass {get;set;}\nProcessName|Property|string ProcessName {get;}\nResponding|Property|bool Responding {get;}\nSessionId|Property|int SessionId {get;}\nStartTime|Property|datetime StartTime {get;}\nTotalProcessorTime|Property|timespan TotalProcessorTime {get;}\nVirtualMemorySize64|Property|long VirtualMemorySize64 {get;}\nWorkingSet64|Property|long WorkingSet64 {get;}\nCompany|ScriptProperty|System.Object Company {get=$this.Mainmodule.FileVersionInfo.CompanyName;}\nCPU|ScriptProperty|System.Object CPU {get=$this.TotalProcessorTime.TotalSeconds;}\nDescription|ScriptProperty|System.Object Description {get=$this.Mainmodule.FileVersionInfo.FileDescription;}\nPath|ScriptProperty|System.Object Path {get=$this.Mainmodule.FileName;}",
 "System.ServiceProcess.ServiceController": "Name|AliasProperty|Name = ServiceName\nRequiredServices|AliasProperty|RequiredServices = ServicesDependedOn\nEquals|Method|bool Equals(System.Object obj)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nRefresh|Method|void Refresh()\nStart|Method|void Start(), void Start(string[] args)\nStop|Method|void Stop(), void Stop(bool stopDependentServices)\nCanPauseAndContinue|Property|bool CanPauseAndContinue {get;}\nCanShutdown|Property|bool CanShutdown {get;}\nCanStop|Property|bool CanStop {get;}\nDependentServices|Property|System.ServiceProcess.ServiceController[] DependentServices {get;}\nDisplayName|Property|string DisplayName {get;set;}\nMachineName|Property|string MachineName {get;set;}\nServiceName|Property|string ServiceName {get;set;}\nServicesDependedOn|Property|System.ServiceProcess.ServiceController[] ServicesDependedOn {get;}\nServiceType|Property|System.ServiceProcess.ServiceType ServiceType {get;}\nStartType|Property|System.ServiceProcess.ServiceStartMode StartType {get;}\nStatus|Property|System.ServiceProcess.ServiceControllerStatus Status {get;}\nToString|ScriptMethod|System.Object ToString();",
 "System.Collections.Hashtable": "Add|Method|void Add(System.Object key, System.Object value), void IDictionary.Add(System.Object key, System.Object value)\nClear|Method|void Clear(), void IDictionary.Clear()\nContains|Method|bool Contains(System.Object key), bool IDictionary.Contains(System.Object key)\nContainsKey|Method|bool ContainsKey(System.Object key)\nContainsValue|Method|bool ContainsValue(System.Object value)\nEquals|Method|bool Equals(System.Object obj)\nGetEnumerator|Method|System.Collections.IDictionaryEnumerator GetEnumerator(), System.Collections.IDictionaryEnumerator IDictionary.GetEnumerator(), System.Collections.IEnumerator IEnumerable.GetEnumerator()\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nRemove|Method|void Remove(System.Object key), void IDictionary.Remove(System.Object key)\nToString|Method|string ToString()\nItem|ParameterizedProperty|System.Object Item(System.Object key) {get;set;}\nCount|Property|int Count {get;}\nIsFixedSize|Property|bool IsFixedSize {get;}\nIsReadOnly|Property|bool IsReadOnly {get;}\nIsSynchronized|Property|bool IsSynchronized {get;}\nKeys|Property|System.Collections.ICollection Keys {get;}\nSyncRoot|Property|System.Object SyncRoot {get;}\nValues|Property|System.Collections.ICollection Values {get;}",
 "System.TimeSpan": "Add|Method|timespan Add(timespan ts)\nEquals|Method|bool Equals(System.Object value), bool Equals(timespan obj), bool IEquatable[timespan].Equals(timespan other)\nGetHashCode|Method|int GetHashCode()\nGetType|Method|type GetType()\nSubtract|Method|timespan Subtract(timespan ts)\nToString|Method|string ToString(), string ToString(string format), string ToString(string format, System.IFormatProvider formatProvider), string IFormattable.ToString(string format, System.IFormatProvider formatProvider)\nDays|Property|int Days {get;}\nHours|Property|int Hours {get;}\nMicroseconds|Property|int Microseconds {get;}\nMilliseconds|Property|int Milliseconds {get;}\nMinutes|Property|int Minutes {get;}\nNanoseconds|Property|int Nanoseconds {get;}\nSeconds|Property|int Seconds {get;}\nTicks|Property|long Ticks {get;}\nTotalDays|Property|double TotalDays {get;}\nTotalHours|Property|double TotalHours {get;}\nTotalMicroseconds|Property|double TotalMicroseconds {get;}\nTotalMilliseconds|Property|double TotalMilliseconds {get;}\nTotalMinutes|Property|double TotalMinutes {get;}\nTotalNanoseconds|Property|double TotalNanoseconds {get;}\nTotalSeconds|Property|double TotalSeconds {get;}",
 "System.Object[]": "Contains|Method|bool IList.Contains(System.Object value)\nEquals|Method|bool Equals(System.Object obj), bool IStructuralEquatable.Equals(System.Object other, System.Collections.IEqualityComparer comparer)\nGetHashCode|Method|int GetHashCode(), int IStructuralEquatable.GetHashCode(System.Collections.IEqualityComparer comparer)\nGetType|Method|type GetType()\nIndexOf|Method|int IList.IndexOf(System.Object value)\nToString|Method|string ToString()\nItem|ParameterizedProperty|System.Object IList.Item(int index) {get;set;}\nCount|Property|int Count {get;}\nIsFixedSize|Property|bool IsFixedSize {get;}\nIsReadOnly|Property|bool IsReadOnly {get;}\nIsSynchronized|Property|bool IsSynchronized {get;}\nLength|Property|int Length {get;}\nLongLength|Property|long LongLength {get;}\nRank|Property|int Rank {get;}\nSyncRoot|Property|System.Object SyncRoot {get;}"
};
  const ECHTE_LISTE = "Add-Computer,Add-Content,Add-History,Add-LocalGroupMember,Add-Member,Add-Type,Checkpoint-Computer,Clear-Content,Clear-EventLog,Clear-History,Clear-Item,Clear-ItemProperty,Clear-RecycleBin,Clear-Variable,Compare-Object,Complete-Transaction,Compress-Archive,Compress-PSResource,Connect-ExchangeOnline,Connect-MgGraph,Connect-PSSession,Convert-Path,ConvertFrom-CliXml,ConvertFrom-Csv,ConvertFrom-Json,ConvertFrom-Markdown,ConvertFrom-SddlString,ConvertFrom-SecureString,ConvertFrom-StringData,ConvertTo-CliXml,ConvertTo-Csv,ConvertTo-Html,ConvertTo-Json,ConvertTo-SecureString,ConvertTo-Xml,Copy-Item,Copy-ItemProperty,Debug-Job,Debug-Process,Debug-Runspace,Disable-ComputerRestore,Disable-ExperimentalFeature,Disable-LocalUser,Disable-PSBreakpoint,Disable-PSRemoting,Disable-PSSessionConfiguration,Disable-RunspaceDebug,Disconnect-PSSession,Enable-ComputerRestore,Enable-ExperimentalFeature,Enable-LocalUser,Enable-PSBreakpoint,Enable-PSRemoting,Enable-PSSessionConfiguration,Enable-RunspaceDebug,Enter-PSHostProcess,Enter-PSSession,Exit-PSHostProcess,Exit-PSSession,Expand-Archive,Export-Alias,Export-BinaryMiLog,Export-Clixml,Export-Counter,Export-Csv,Export-FormatData,Export-ModuleMember,Export-PSSession,Find-Command,Find-DscResource,Find-Module,Find-PSResource,Find-RoleCapability,Find-Script,ForEach-Object,Format-Custom,Format-Hex,Format-List,Format-Table,Format-Wide,Get-Acl,Get-ADComputer,Get-ADGroupMember,Get-ADUser,Get-Alias,Get-AuthenticodeSignature,Get-ChildItem,Get-CimAssociatedInstance,Get-CimClass,Get-CimInstance,Get-CimSession,Get-Clipboard,Get-CmsMessage,Get-Command,Get-ComputerInfo,Get-ComputerRestorePoint,Get-Content,Get-ControlPanelItem,Get-Counter,Get-Credential,Get-CredsFromCredentialProvider,Get-Culture,Get-Date,Get-Disk,Get-DnsClientServerAddress,Get-Error,Get-Event,Get-EventLog,Get-EventSubscriber,Get-ExecutionPolicy,Get-ExperimentalFeature,Get-FileHash,Get-FormatData,Get-Help,Get-History,Get-Host,Get-HotFix,Get-InstalledModule,Get-InstalledPSResource,Get-InstalledScript,Get-Item,Get-ItemProperty,Get-ItemPropertyValue,Get-Job,Get-LocalGroup,Get-LocalGroupMember,Get-LocalUser,Get-Location,Get-Mailbox,Get-MarkdownOption,Get-Member,Get-MgUser,Get-Module,Get-MpComputerStatus,Get-NetAdapter,Get-NetIPAddress,Get-NetIPConfiguration,Get-Package,Get-PfxCertificate,Get-Printer,Get-Process,Get-PSBreakpoint,Get-PSCallStack,Get-PSDrive,Get-PSHostProcessInfo,Get-PSProvider,Get-PSReadLineKeyHandler,Get-PSReadLineOption,Get-PSRepository,Get-PSResourceRepository,Get-PSScriptFileInfo,Get-PSSession,Get-PSSessionCapability,Get-PSSessionConfiguration,Get-PSSubsystem,Get-Random,Get-Runspace,Get-RunspaceDebug,Get-ScheduledTask,Get-SecureRandom,Get-Service,Get-SmbShare,Get-TimeZone,Get-TraceSource,Get-Transaction,Get-TypeData,Get-UICulture,Get-Unique,Get-Uptime,Get-Variable,Get-Verb,Get-Volume,Get-WindowsOptionalFeature,Get-WinEvent,Get-WmiObject,Group-Object,Import-Alias,Import-BinaryMiLog,Import-Clixml,Import-Counter,Import-Csv,Import-LocalizedData,Import-Module,Import-PowerShellDataFile,Import-PSGetRepository,Import-PSSession,Install-Module,Install-Package,Install-PSResource,Install-Script,Invoke-CimMethod,Invoke-Command,Invoke-Expression,Invoke-History,Invoke-Item,Invoke-RestMethod,Invoke-WebRequest,Invoke-WmiMethod,Join-Path,Join-String,Limit-EventLog,Measure-Command,Measure-Object,Move-Item,Move-ItemProperty,New-ADUser,New-Alias,New-CimInstance,New-CimSession,New-CimSessionOption,New-Event,New-EventLog,New-FileCatalog,New-Guid,New-Item,New-ItemProperty,New-LocalGroup,New-LocalUser,New-Module,New-ModuleManifest,New-Object,New-PSDrive,New-PSRoleCapabilityFile,New-PSScriptFileInfo,New-PSSession,New-PSSessionConfigurationFile,New-PSSessionOption,New-PSTransportOption,New-ScriptFileInfo,New-Service,New-TemporaryFile,New-TimeSpan,New-Variable,New-WebServiceProxy,New-WinEvent,Out-Default,Out-File,Out-GridView,Out-Host,Out-Null,Out-Printer,Out-String,Pop-Location,Protect-CmsMessage,Publish-Module,Publish-PSResource,Publish-Script,Push-Location,Read-Host,Receive-Job,Receive-PSSession,Register-ArgumentCompleter,Register-CimIndicationEvent,Register-EngineEvent,Register-ObjectEvent,Register-PSRepository,Register-PSResourceRepository,Register-PSSessionConfiguration,Register-ScheduledTask,Register-WmiEvent,Remove-Alias,Remove-CimInstance,Remove-CimSession,Remove-Computer,Remove-Event,Remove-EventLog,Remove-Item,Remove-ItemProperty,Remove-Job,Remove-LocalGroup,Remove-LocalGroupMember,Remove-LocalUser,Remove-Module,Remove-PSBreakpoint,Remove-PSDrive,Remove-PSReadLineKeyHandler,Remove-PSSession,Remove-Service,Remove-TypeData,Remove-Variable,Remove-WmiObject,Rename-Computer,Rename-Item,Rename-ItemProperty,Rename-LocalGroup,Rename-LocalUser,Reset-ComputerMachinePassword,Reset-PSResourceRepository,Resolve-DnsName,Resolve-Path,Restart-Computer,Restart-Service,Restore-Computer,Resume-Service,Save-Help,Save-Module,Save-PSResource,Save-Script,Select-Object,Select-String,Select-Xml,Send-MailMessage,Set-Acl,Set-Alias,Set-AuthenticodeSignature,Set-CimInstance,Set-Clipboard,Set-Content,Set-Date,Set-ExecutionPolicy,Set-Item,Set-ItemProperty,Set-LocalGroup,Set-LocalUser,Set-Location,Set-MarkdownOption,Set-PSBreakpoint,Set-PSDebug,Set-PSReadLineKeyHandler,Set-PSReadLineOption,Set-PSRepository,Set-PSResourceRepository,Set-PSSessionConfiguration,Set-Service,Set-StrictMode,Set-TimeZone,Set-TraceSource,Set-Variable,Set-WmiInstance,Show-Command,Show-ControlPanelItem,Show-EventLog,Show-Markdown,Sort-Object,Split-Path,Start-Job,Start-Process,Start-Service,Start-Sleep,Start-Transaction,Start-Transcript,Stop-Computer,Stop-Job,Stop-Process,Stop-Service,Stop-Transcript,Suspend-Service,Tee-Object,Test-ComputerSecureChannel,Test-Connection,Test-FileCatalog,Test-Json,Test-ModuleManifest,Test-NetConnection,Test-Path,Test-PSScriptFileInfo,Test-PSSessionConfigurationFile,Test-ScriptFileInfo,Trace-Command,Unblock-File,Undo-Transaction,Uninstall-Module,Uninstall-PSResource,Uninstall-Script,Unprotect-CmsMessage,Unregister-Event,Unregister-PSRepository,Unregister-PSResourceRepository,Unregister-PSSessionConfiguration,Update-FormatData,Update-Help,Update-List,Update-Module,Update-ModuleManifest,Update-PSModuleManifest,Update-PSResource,Update-PSScriptFileInfo,Update-Script,Update-ScriptFileInfo,Update-TypeData,Use-Transaction,Wait-Debugger,Wait-Event,Wait-Job,Wait-Process,Where-Object,Write-Debug,Write-Error,Write-EventLog,Write-Host,Write-Information,Write-Output,Write-Progress,Write-Verbose,Write-Warning";

  /* ======================================================================
     2. Objektmodell
     Werte im Simulator:
       null, true/false, Zahl (number oder PSDouble), Text (string), Array (JS-Array = object[]),
       PSDatum, PSZeitspanne, PSEnum, PSHashtable, PSObjekt, Skriptblock, PSTyp, FehlerDatensatz
     ====================================================================== */

  // Objekt mit benannten Eigenschaften (PSCustomObject, FileInfo, Process, …)
  class PSObjekt {
    constructor(typen, eigenschaften, arten) {
      this.typen = Array.isArray(typen) ? typen : [typen];
      this._namen = [];
      this._werte = new Map();
      this._arten = new Map(); // Name → MemberType (NoteProperty, Property, AliasProperty, ScriptProperty, CodeProperty)
      if (eigenschaften) for (const [n, w] of eigenschaften) this.setzen(n, w, arten && arten[n]);
    }
    get typ() { return this.typen[0]; }
    setzen(name, wert, art) {
      const k = klein(name);
      if (!this._werte.has(k)) this._namen.push(name);
      this._werte.set(k, wert);
      if (art) this._arten.set(k, art);
    }
    hat(name) { return this._werte.has(klein(name)); }
    wert(name) { return this._werte.has(klein(name)) ? this._werte.get(klein(name)) : null; }
    art(name) { return this._arten.get(klein(name)) || "NoteProperty"; }
    namen() { return this._namen.slice(); }
    echterName(name) { return this._namen.find((n) => gleichCI(n, name)) || name; }
  }
  const CUSTOM = "System.Management.Automation.PSCustomObject";
  const neuesObjekt = (paare, typ) => new PSObjekt(typ ? [typ, CUSTOM] : [CUSTOM], paare);

  // Hashtable mit Schlüsseln ohne Gross/Klein, Reihenfolge = Einfügen
  class PSHashtable {
    constructor(geordnet) { this.geordnet = !!geordnet; this._m = new Map(); }
    static schluessel(k) {
      if (typeof k === "string") return "s:" + klein(k);
      if (istZahl(k)) return "n:" + zahlWert(k);
      return "o:" + textVon(k);
    }
    setzen(k, w) {
      const s = PSHashtable.schluessel(k);
      const alt = this._m.get(s);
      this._m.set(s, { k: alt ? alt.k : k, w: w });
    }
    hole(k) { const e = this._m.get(PSHashtable.schluessel(k)); return e ? e.w : null; }
    hat(k) { return this._m.has(PSHashtable.schluessel(k)); }
    entfernen(k) { this._m.delete(PSHashtable.schluessel(k)); }
    get anzahl() { return this._m.size; }
    eintraege() { return Array.from(this._m.values()); }
    kopie() { const h = new PSHashtable(this.geordnet); this.eintraege().forEach((e) => h.setzen(e.k, e.w)); return h; }
  }

  // Skriptblock { … } mit Syntaxbaum und Quelltext
  class Skriptblock {
    constructor(knoten, text) { this.knoten = knoten; this.text = text; }
  }

  // Typ für [int], GetType() und -is
  class PSTyp {
    constructor(info) { this.info = info; }
    get name() { return this.info.name; }
    get voll() { return this.info.voll; }
  }

  // Fehler wie ein ErrorRecord in PowerShell
  class FehlerDatensatz {
    constructor(o) {
      this.meldung = o.meldung;            // Message der Exception (englisch wie pwsh 7)
      this.befehl = o.befehl || null;      // Cmdlet, das den Fehler meldet (Präfix «Get-Item:»)
      this.art = o.art || null;            // Präfix ohne Cmdlet, z. B. RuntimeException, InvalidOperation
      this.kategorie = o.kategorie || "NotSpecified";
      this.ausnahme = o.ausnahme || "System.Management.Automation.RuntimeException";
      this.ziel = o.ziel === undefined ? null : o.ziel;
      this.id = o.id || "";
      this.pos = o.pos || null;            // { quelle, start, ende, datei } für die Anzeige «Line |»
      this.hinweis = o.hinweis || null;
      this.innere = o.innere || null;      // innere Ausnahme, z. B. System.DivideByZeroException    // Zusatz wie «Suggestion [3,General]: …»
    }
  }

  /* ---------- Steuerung des Ablaufs ---------- */

  // Abbrechender Fehler. umfang: "anweisung" (nächste Anweisung läuft weiter) oder "skript" (bricht ab)
  class AbbruchFehler extends Error {
    constructor(datensatz, umfang) { super(datensatz.meldung); this.datensatz = datensatz; this.umfang = umfang || "anweisung"; }
  }
  class SteuerSignal { constructor(art, wert) { this.art = art; this.wert = wert; } } // break, continue, return, exit
  class Rueckfrage { constructor(text) { this.text = text; } }                      // -Confirm braucht eine Antwort
  class ParseFehler extends Error {
    constructor(meldung, pos, laenge, unvollstaendig) { super(meldung); this.pos = pos; this.laenge = laenge || 1; this.unvollstaendig = !!unvollstaendig; }
  }

  /* ---------- Typen ---------- */

  const TYPEN = {};
  function typ(kurz, voll, basis, extra) {
    const info = Object.assign({ name: voll.split(".").pop(), voll: voll, basis: basis, kurz: kurz }, extra || {});
    TYPEN[klein(voll)] = info;
    TYPEN[klein(info.name)] = info;
    if (kurz) TYPEN[klein(kurz)] = info;
    return info;
  }
  const T_INT = typ("int", "System.Int32", "System.ValueType", { def: "int" });
  const T_LONG = typ("long", "System.Int64", "System.ValueType", { def: "long" });
  const T_DOUBLE = typ("double", "System.Double", "System.ValueType", { def: "double" });
  typ("decimal", "System.Decimal", "System.ValueType", { def: "decimal" });
  typ("float", "System.Single", "System.ValueType", { def: "float" });
  typ("single", "System.Single", "System.ValueType");
  const T_STRING = typ("string", "System.String", "System.Object", { def: "string" });
  typ("char", "System.Char", "System.ValueType", { def: "char" });
  const T_BOOL = typ("bool", "System.Boolean", "System.ValueType", { def: "bool" });
  typ("boolean", "System.Boolean", "System.ValueType");
  const T_DATUM = typ("datetime", "System.DateTime", "System.ValueType", { def: "datetime" });
  const T_ZEIT = typ("timespan", "System.TimeSpan", "System.ValueType", { def: "timespan" });
  const T_ARRAY = typ(null, "System.Object[]", "System.Array", { name: "Object[]" });
  typ("array", "System.Array", "System.Object");
  TYPEN["object[]"] = T_ARRAY;
  const T_HASH = typ("hashtable", "System.Collections.Hashtable", "System.Object");
  const T_ORDERED = typ("ordered", "System.Collections.Specialized.OrderedDictionary", "System.Object");
  const T_CUSTOM = typ("pscustomobject", CUSTOM, "System.Object");
  typ("psobject", "System.Management.Automation.PSObject", "System.Object");
  const T_SKRIPT = typ("scriptblock", "System.Management.Automation.ScriptBlock", "System.Object");
  const T_OBJECT = typ("object", "System.Object", null);
  const T_MATH = typ("math", "System.Math", "System.Object");
  const T_ERROR = typ(null, "System.Management.Automation.ErrorRecord", "System.Object");
  typ("regex", "System.Text.RegularExpressions.Regex", "System.Object");
  typ("type", "System.Type", "System.Reflection.MemberInfo");
  typ("void", "System.Void", "System.ValueType");
  typ("switch", "System.Management.Automation.SwitchParameter", "System.ValueType");
  typ("environment", "System.Environment", "System.Object");
  typ("io.path", "System.IO.Path", "System.Object");
  typ(null, "System.IO.FileInfo", "System.IO.FileSystemInfo");
  typ(null, "System.IO.DirectoryInfo", "System.IO.FileSystemInfo");
  typ(null, "System.Diagnostics.Process", "System.ComponentModel.Component");
  typ(null, "System.ServiceProcess.ServiceController", "System.ComponentModel.Component");
  typ(null, "System.DayOfWeek", "System.Enum");
  typ(null, "Microsoft.PowerShell.Commands.GroupInfo", "System.Object");
  typ(null, "Microsoft.PowerShell.Commands.GenericMeasureInfo", "Microsoft.PowerShell.Commands.MeasureInfo");
  typ(null, "System.Management.Automation.PathInfo", "System.Object");
  const T_INT_ARR = typ(null, "System.Int32[]", "System.Array", { name: "Int32[]", element: T_INT });
  TYPEN["int[]"] = T_INT_ARR;
  const T_STR_ARR = typ(null, "System.String[]", "System.Array", { name: "String[]", element: T_STRING });
  TYPEN["string[]"] = T_STR_ARR;

  function typSuchen(name) {
    let n = klein(String(name).trim());
    if (TYPEN[n]) return TYPEN[n];
    if (n.startsWith("system.") && TYPEN[n.slice(7)]) return TYPEN[n.slice(7)];
    if (TYPEN["system." + n]) return TYPEN["system." + n];
    return null;
  }

  // Typ eines Werts (für GetType(), -is, Get-Member)
  function typVon(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "boolean") return T_BOOL;
    if (istZahl(v)) {
      if (istDouble(v)) return T_DOUBLE;
      const w = zahlWert(v);
      return w > INT32_MAX || w < INT32_MIN ? T_LONG : T_INT;
    }
    if (typeof v === "string") return T_STRING;
    if (Array.isArray(v)) return v._typ || T_ARRAY;
    if (v instanceof PSDatum) return T_DATUM;
    if (v instanceof PSZeitspanne) return T_ZEIT;
    if (v instanceof PSHashtable) return v.geordnet ? T_ORDERED : T_HASH;
    if (v instanceof Skriptblock) return T_SKRIPT;
    if (v instanceof PSTyp) return typSuchen("type");
    if (v instanceof FehlerDatensatz) return T_ERROR;
    if (v instanceof PSEnum) return typSuchen(v.typ) || typ(null, v.typ, "System.Enum");
    if (v instanceof PSObjekt) {
      const t = v.typen.find((x) => !x.startsWith("Selected.") && x !== CUSTOM) || v.typ;
      return typSuchen(t) || typ(null, t, "System.Object");
    }
    return T_OBJECT;
  }
  const typNameVon = (v) => (v instanceof PSObjekt ? v.typ : typVon(v) ? typVon(v).voll : "");

  /* ---------- Werte in Text umwandeln ---------- */

  // ToString() wie .NET (Kultur de-CH bei Datum)
  function textVon(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (typeof v === "boolean") return v ? "True" : "False";
    if (istZahl(v)) return zahlText(v);
    if (Array.isArray(v)) return v._typ ? v._typ.voll : "System.Object[]";
    if (v instanceof PSDatum) return datumKurz(v);
    if (v instanceof PSZeitspanne) return zeitspanneText(v);
    if (v instanceof PSEnum) return v.name;
    if (v instanceof PSHashtable) return v.geordnet ? "System.Collections.Specialized.OrderedDictionary" : "System.Collections.Hashtable";
    if (v instanceof Skriptblock) return v.text;
    if (v instanceof PSTyp) return v.voll;
    if (v instanceof FehlerDatensatz) return v.meldung;
    if (v instanceof PSObjekt) {
      if (v._text) return v._text(v);
      if (v.typen.includes(CUSTOM) || v.typen.some((t) => t.startsWith("Selected."))) return objektKurztext(v);
      return v.typ;
    }
    return String(v);
  }

  // «@{Name=Lea; Alter=31}» wie PSCustomObject.ToString()
  function objektKurztext(o) {
    return "@{" + o.namen().map((n) => n + "=" + textImString(o.wert(n))).join("; ") + "}";
  }

  // Wert in einem String mit "$x" (Datum invariant, Arrays mit Leerzeichen)
  function textImString(v) {
    if (Array.isArray(v)) return v.map(textImString).join(" ");
    if (v instanceof PSDatum) return datumInvariant(v);
    return textVon(v);
  }

  /* ---------- Wahrheitswert, Umwandlung ---------- */

  function alsBool(v) {
    if (v === null || v === undefined) return false;
    if (typeof v === "boolean") return v;
    if (istZahl(v)) return zahlWert(v) !== 0;
    if (typeof v === "string") return v.length > 0;
    if (Array.isArray(v)) return v.length === 0 ? false : v.length === 1 ? alsBool(v[0]) : true;
    if (v instanceof PSEnum) return v.wert !== 0;
    return true;
  }

  function konvertFehler(wert, typName, grund) {
    return new AbbruchFehler(new FehlerDatensatz({
      meldung: 'Cannot convert value "' + textVon(wert) + '" to type "' + typName + '". Error: "' + grund + '"',
      art: "InvalidArgument", kategorie: "InvalidArgument", ausnahme: "System.Management.Automation.PSInvalidCastException", id: "InvalidCastFromStringToInteger",
    }));
  }

  // Text → Zahl wie PowerShell ("0x1F", "1e3", " 42 ", "1KB"). null, wenn es keine Zahl ist.
  function textAlsZahl(s) {
    const t = String(s).trim();
    if (t === "") return 0;
    let m = /^([+-]?)0x([0-9a-f]+)$/i.exec(t);
    if (m) return (m[1] === "-" ? -1 : 1) * parseInt(m[2], 16);
    m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(kb|mb|gb|tb|pb)?$/i.exec(t);
    if (!m) return null;
    const faktor = m[2] ? Math.pow(1024, ["kb", "mb", "gb", "tb", "pb"].indexOf(klein(m[2])) + 1) : 1;
    const w = Number(m[1]) * faktor;
    return /[.e]/i.test(m[1]) ? alsDouble(w) : w;
  }

  // Banker's Rounding wie [int]2.5 = 2
  function rundenGerade(w) {
    const r = Math.round(w);
    return Math.abs(w % 1) === 0.5 ? (r % 2 === 0 ? r : r - 1) : r;
  }

  function nachZahl(v, typInfo) {
    const name = (typInfo || T_INT).voll;
    if (v === null || v === undefined) return 0;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (istZahl(v)) return v;
    if (v instanceof PSEnum) return v.wert;
    if (typeof v === "string") {
      const z = textAlsZahl(v);
      if (z === null) throw konvertFehler(v, name, "The input string '" + v + "' was not in a correct format.");
      return z;
    }
    if (Array.isArray(v) && v.length === 1) return nachZahl(v[0], typInfo);
    throw konvertFehler(v, name, 'Cannot convert the "' + textVon(v) + '" value of type "' + typNameVon(v) + '" to type "' + name + '".');
  }

  // Umwandlung für [typ]wert, typisierte Parameter und Variablen
  function konvertieren(v, typInfo) {
    if (!typInfo) return v;
    const voll = typInfo.voll;
    switch (voll) {
      case "System.Int32": case "System.Int64": {
        const z = nachZahl(v, typInfo);
        const w = rundenGerade(zahlWert(z));
        if (voll === "System.Int32" && (w > INT32_MAX || w < INT32_MIN))
          throw konvertFehler(v, voll, "Value was either too large or too small for an Int32.");
        return w;
      }
      case "System.Double": case "System.Single": case "System.Decimal":
        return alsDouble(zahlWert(nachZahl(v, typInfo)));
      case "System.String":
        if (v === null) return "";
        return Array.isArray(v) ? v.map(textImString).join(" ") : textVon(v);
      case "System.Char": {
        const s = textVon(v);
        if (s.length !== 1) throw konvertFehler(v, voll, "String must be exactly one character long.");
        return s;
      }
      case "System.Boolean":
        return alsBool(v);
      case "System.DateTime": {
        if (v instanceof PSDatum) return v;
        const d = datumLesen(textVon(v), false);
        if (!d) throw konvertFehler(v, voll, "String '" + textVon(v) + "' was not recognized as a valid DateTime.");
        return d;
      }
      case "System.TimeSpan":
        if (v instanceof PSZeitspanne) return v;
        throw konvertFehler(v, voll, "Invalid cast.");
      case "System.Object[]": case "System.Array":
        return Array.isArray(v) ? v : v === null ? [] : [v];
      case "System.Int32[]": case "System.String[]": {
        const liste = (Array.isArray(v) ? v : v === null ? [] : [v]).map((x) => konvertieren(x, typInfo.element));
        liste._typ = typInfo;
        return liste;
      }
      case "System.Collections.Hashtable":
        if (v instanceof PSHashtable) return v;
        throw konvertFehler(v, voll, "Invalid cast.");
      case CUSTOM: case "System.Management.Automation.PSObject":
        if (v instanceof PSHashtable) return neuesObjekt(v.eintraege().map((e) => [textVon(e.k), e.w]));
        return v;
      case "System.Management.Automation.SwitchParameter":
        return alsBool(v);
      case "System.Object":
        return v;
      default:
        return v;
    }
  }

  /* ---------- Vergleiche ---------- */

  // -eq ohne Gross/Klein (cs = case-sensitive). Der linke Wert bestimmt den Typ.
  function gleich(a, b, cs) {
    if (a === null || a === undefined) return b === null || b === undefined;
    if (b === null || b === undefined) return false;
    if (typeof a === "string" || a instanceof PSEnum) {
      const x = typeof a === "string" ? a : a.name;
      const y = b instanceof PSEnum ? b.name : textVon(b);
      return cs ? x === y : x.toLowerCase() === y.toLowerCase();
    }
    if (istZahl(a)) {
      if (typeof b === "string") { const z = textAlsZahl(b); return z !== null && zahlWert(z) === zahlWert(a); }
      if (istZahl(b) || typeof b === "boolean") return zahlWert(a) === Number(zahlWert(b));
      if (b instanceof PSEnum) return zahlWert(a) === b.wert;
      return false;
    }
    if (typeof a === "boolean") return a === alsBool(b);
    if (a instanceof PSDatum) {
      if (b instanceof PSDatum) return a.ms === b.ms;
      const d = typeof b === "string" ? datumLesen(b, false) : null;
      return !!d && d.ms === a.ms;
    }
    if (a instanceof PSZeitspanne) return b instanceof PSZeitspanne && a.ms === b.ms;
    return a === b;
  }

  // Ordnung für -lt/-gt und Sort-Object. Gibt -1, 0, 1 zurück.
  function vergleichen(a, b, cs) {
    if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
    if (b === null || b === undefined) return 1;
    if (typeof a === "string") {
      const y = textVon(b);
      if (cs) return a < y ? -1 : a > y ? 1 : 0;
      return Math.sign(kulturVergleich(a, y));
    }
    if (a instanceof PSEnum) return Math.sign(a.wert - (b instanceof PSEnum ? b.wert : zahlWert(nachZahl(b))));
    if (istZahl(a) || typeof a === "boolean") {
      const x = Number(zahlWert(a));
      let y;
      if (typeof b === "string") {
        const z = textAlsZahl(b);
        if (z === null) throw konvertFehler(b, typVon(a).voll, "The input string '" + b + "' was not in a correct format.");
        y = zahlWert(z);
      } else y = Number(zahlWert(b instanceof PSEnum ? b.wert : b));
      return x < y ? -1 : x > y ? 1 : 0;
    }
    if (a instanceof PSDatum) {
      const d = b instanceof PSDatum ? b : datumLesen(textVon(b), false);
      if (!d) throw konvertFehler(b, "System.DateTime", "String '" + textVon(b) + "' was not recognized as a valid DateTime.");
      return Math.sign(a.ms - d.ms);
    }
    if (a instanceof PSZeitspanne && b instanceof PSZeitspanne) return Math.sign(a.ms - b.ms);
    return Math.sign(kulturVergleich(textVon(a), textVon(b)));
  }

  // Arrays, die PowerShell in der Pipeline aufzählt (Hashtables und Strings nicht)
  const istAufzaehlbar = (v) => Array.isArray(v);
  const alsListe = (v) => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);
  // Ausgabe einer Pipeline als Wert: nichts → $null, eins → das Objekt, mehrere → Array
  const ausgabeWert = (liste) => (liste.length === 0 ? null : liste.length === 1 ? liste[0] : liste);

  /* ======================================================================
     3. Spiel-Rechner «Lea»
     Lea arbeitet in der Informatik der Gemeinde Wolkenried. Alles ist fest vorgegeben
     (deterministisch). cfg.umgebung kann Teile ergänzen oder alles ersetzen.
     ====================================================================== */

  const LEA = {
    computer: "WR-LEA-01",
    benutzer: "lea",
    domaene: "WOLKENRIED",
    home: "C:\\Users\\lea",
    zeit: "2026-11-02T09:00:00", // Montag, 2. November 2026, 09:00
    admin: false,
    richtlinie: "RemoteSigned",
    laufwerkC: { belegt: 187.42, frei: 287.13 },
    // [Pfad, LastWriteTime, versteckt]
    ordner: [
      ["C:\\Program Files", "2026-09-20T10:12:00"],
      ["C:\\Program Files\\PowerShell", "2026-09-20T10:12:00"],
      ["C:\\Program Files\\PowerShell\\7", "2026-09-20T10:12:00"],
      ["C:\\Users", "2025-01-14T08:30:00"],
      ["C:\\Users\\Public", "2025-01-14T08:30:00"],
      ["C:\\Windows", "2026-10-15T03:12:00"],
      ["C:\\Windows\\System32", "2026-10-15T03:12:00"],
      ["C:\\Users\\lea", "2026-11-02T08:55:00"],
      ["C:\\Users\\lea\\AppData", "2025-01-14T08:31:00", true],
      ["C:\\Users\\lea\\AppData\\Local", "2026-11-02T08:01:00"],
      ["C:\\Users\\lea\\AppData\\Local\\Temp", "2026-11-02T08:01:00"],
      ["C:\\Users\\lea\\AppData\\Roaming", "2026-10-30T16:44:00"],
      ["C:\\Users\\lea\\Berichte", "2026-10-28T16:20:00"],
      ["C:\\Users\\lea\\Bilder", "2026-08-14T18:43:00"],
      ["C:\\Users\\lea\\Dokumente", "2026-10-30T17:05:00"],
      ["C:\\Users\\lea\\Dokumente\\Archiv", "2026-03-12T10:16:00"],
      ["C:\\Users\\lea\\Downloads", "2026-10-31T11:47:00"],
      ["C:\\Users\\lea\\Logs", "2026-11-02T08:59:13"],
    ],
    // [Pfad, LastWriteTime, Grösse (null = aus Inhalt), Inhalt (Zeilen mit \n), versteckt]
    dateien: [
      ["C:\\Program Files\\PowerShell\\7\\pwsh.exe", "2026-09-20T10:12:00", 290304],
      ["C:\\Windows\\notepad.exe", "2026-10-15T03:12:00", 360448],
      ["C:\\Windows\\System32\\drivers.txt", "2026-10-15T03:12:00", 1024],
      ["C:\\Users\\lea\\Berichte\\mitarbeitende.csv", "2026-10-28T16:20:00", null,
        "Name,Vorname,Abteilung,Pensum,Eintritt\nKeller,Lea,Informatik,80,2021-03-01\nBrunner,Marco,Finanzen,100,2018-08-15\n" +
        "Huber,Sandra,Bauamt,100,2015-01-01\nMeier,Reto,Informatik,100,2023-05-01\nFrei,Anna,Einwohnerdienste,60,2019-11-01\n" +
        "Schmid,Peter,Bauamt,90,2012-04-01\nGerber,Nina,Finanzen,50,2024-02-01\nBühler,Jonas,Informatik,100,2020-09-01"],
      ["C:\\Users\\lea\\Berichte\\quartalsbericht-q3.xlsx", "2026-10-05T11:12:00", 24576],
      ["C:\\Users\\lea\\Berichte\\budget-2027.xlsx", "2026-10-27T15:31:00", 31744],
      ["C:\\Users\\lea\\Bilder\\ferien-01.jpg", "2026-08-14T18:42:00", 3145728],
      ["C:\\Users\\lea\\Bilder\\ferien-02.jpg", "2026-08-14T18:43:00", 2883584],
      ["C:\\Users\\lea\\Bilder\\gemeindehaus.png", "2026-06-02T09:30:00", 845312],
      ["C:\\Users\\lea\\Bilder\\logo-wolkenried.png", "2025-01-15T13:20:00", 48213],
      ["C:\\Users\\lea\\Dokumente\\notizen.txt", "2026-10-30T17:05:00", null,
        "Notizen von Lea\n- Logdateien im Ordner Logs aufräumen (älter als 30 Tage)\n" +
        "- Dienst WolkenriedSync prüfen, er läuft seit Sonntag nicht mehr\n- Mitarbeitendenliste an das Personalamt schicken"],
      ["C:\\Users\\lea\\Dokumente\\einkaufsliste.txt", "2026-10-29T19:12:00", null, "Milch\nBrot\nKäse\nÄpfel\nKaffee"],
      ["C:\\Users\\lea\\Dokumente\\bewerbung-alt.docx", "2024-11-11T20:45:00", 22016],
      ["C:\\Users\\lea\\Dokumente\\protokoll-teamsitzung.docx", "2026-10-27T10:02:00", 18944],
      ["C:\\Users\\lea\\Dokumente\\Archiv\\vertrag-2020.pdf", "2026-03-12T10:15:00", 412672],
      ["C:\\Users\\lea\\Dokumente\\Archiv\\schatz.txt", "2026-03-12T10:16:00", null, "Gut gemacht! Du hast die versteckte Datei gefunden.", true],
      ["C:\\Users\\lea\\Downloads\\setup-alt.exe", "2025-03-03T07:05:00", 52428800],
      ["C:\\Users\\lea\\Downloads\\WolkenriedSync-setup.exe", "2026-09-15T14:22:00", 31457280],
      ["C:\\Users\\lea\\Downloads\\rechnung-2026-09.pdf", "2026-10-02T08:14:00", 184320],
      ["C:\\Users\\lea\\Downloads\\rechnung-2026-10.pdf", "2026-10-31T11:47:00", 191488],
      ["C:\\Users\\lea\\Downloads\\foto-apero.jpg", "2026-10-25T21:03:00", 2097152],
      ["C:\\Users\\lea\\Downloads\\handbuch-drucker.pdf", "2026-05-18T16:40:00", 5242880],
      ["C:\\Users\\lea\\Logs\\app.log", "2026-11-02T08:59:13", null,
        "2026-11-02 08:00:01 INFO  Dienst gestartet\n2026-11-02 08:15:42 INFO  Benutzer lea angemeldet\n" +
        "2026-11-02 08:31:07 WARN  Speicher knapp (85 %)\n2026-11-02 08:44:19 ERROR Verbindung zu sync.wolkenried.ch fehlgeschlagen\n" +
        "2026-11-02 08:59:13 INFO  Sicherung abgeschlossen"],
      ["C:\\Users\\lea\\Logs\\app-2026-07.log", "2026-07-31T23:59:00", 8912896],
      ["C:\\Users\\lea\\Logs\\app-2026-08.log", "2026-08-31T23:59:00", 6291456],
      ["C:\\Users\\lea\\Logs\\app-2026-09.log", "2026-09-30T23:59:00", 4718592],
      ["C:\\Users\\lea\\Logs\\app-2026-10.log", "2026-10-31T23:59:00", 3407872],
      ["C:\\Users\\lea\\Logs\\backup-2026-06.log", "2026-06-30T03:00:00", 1153434],
      ["C:\\Users\\lea\\Logs\\sync-fehler.log", "2026-11-01T22:14:03", null,
        "2026-11-01 22:14:03 ERROR WolkenriedSync: Dienst unerwartet beendet\n2026-11-01 22:14:03 ERROR WolkenriedSync: Zugriff auf \\\\server\\ablage verweigert"],
    ],
    // Prozesse: Name, Id, SI, NPM, PM, WS (Bytes), CPU (s), Systemprozess (nur mit Adminrechten beendbar)
    prozesse: [
      ["berichtgenerator", 6612, 1, 52224, 1912602624, 2013265920, 812.4375, false, "C:\\Program Files\\Wolkenried\\berichtgenerator.exe", "Gemeinde Wolkenried", "Berichtgenerator"],
      ["chrome", 4120, 1, 61440, 301989888, 432013312, 1534.21875, false, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "Google LLC", "Google Chrome"],
      ["chrome", 4388, 1, 31744, 152043520, 196608000, 210.5, false, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "Google LLC", "Google Chrome"],
      ["chrome", 5012, 1, 18432, 68157440, 98566144, 45.125, false, "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "Google LLC", "Google Chrome"],
      ["Code", 8012, 1, 72704, 412041216, 389021696, 301.75, false, "C:\\Users\\lea\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe", "Microsoft Corporation", "Visual Studio Code"],
      ["explorer", 3456, 1, 98304, 98566144, 187695104, 120.0625, false, "C:\\Windows\\explorer.exe", "Microsoft Corporation", "Windows Explorer"],
      ["Idle", 0, 0, 0, 61440, 8192, null, true, null, null, null],
      ["lsass", 812, 0, 30720, 9437184, 22020096, null, true, null, null, null],
      ["ms-teams", 7720, 1, 48128, 352321536, 498073600, 655.34375, false, "C:\\Program Files\\WindowsApps\\MSTeams\\ms-teams.exe", "Microsoft Corporation", "Microsoft Teams"],
      ["notepad", 8840, 1, 15360, 3407872, 14680064, 0.28125, false, "C:\\Windows\\notepad.exe", "Microsoft Corporation", "Notepad"],
      ["OUTLOOK", 7044, 1, 101376, 245366784, 312475648, 402.0625, false, "C:\\Program Files\\Microsoft Office\\root\\Office16\\OUTLOOK.EXE", "Microsoft Corporation", "Microsoft Outlook"],
      ["pwsh", 9120, 1, 40960, 88080384, 121634816, 3.5, false, "C:\\Program Files\\PowerShell\\7\\pwsh.exe", "Microsoft Corporation", "pwsh"],
      ["svchost", 1024, 0, 20480, 7340032, 18874368, null, true, null, null, null],
      ["svchost", 1088, 0, 15360, 5242880, 12582912, null, true, null, null, null],
      ["svchost", 1260, 0, 25600, 10485760, 29360128, null, true, null, null, null],
      ["System", 4, 0, 0, 196608, 3145728, null, true, null, null, null],
      ["WolkenriedBackup", 2240, 0, 12288, 26214400, 41943040, null, true, null, null, null],
    ],
    // Dienste: Name, DisplayName, Status, StartType
    dienste: [
      ["AudioSrv", "Windows Audio", "Running", "Automatic"],
      ["BITS", "Background Intelligent Transfer Service", "Stopped", "Manual"],
      ["Dnscache", "DNS Client", "Running", "Automatic"],
      ["EventLog", "Windows Event Log", "Running", "Automatic"],
      ["Fax", "Fax", "Stopped", "Manual"],
      ["Spooler", "Print Spooler", "Running", "Automatic"],
      ["W32Time", "Windows Time", "Stopped", "Manual"],
      ["WinDefend", "Microsoft Defender Antivirus Service", "Running", "Automatic"],
      ["WolkenriedBackup", "Wolkenried Sicherung", "Running", "Automatic"],
      ["WolkenriedSync", "Wolkenried Dateisynchronisation", "Stopped", "Automatic"],
      ["WSearch", "Windows Search", "Running", "Automatic"],
      ["wuauserv", "Windows Update", "Running", "Manual"],
    ],
    env: [
      ["ALLUSERSPROFILE", "C:\\ProgramData"],
      ["APPDATA", "C:\\Users\\lea\\AppData\\Roaming"],
      ["COMPUTERNAME", "WR-LEA-01"],
      ["HOMEDRIVE", "C:"],
      ["HOMEPATH", "\\Users\\lea"],
      ["LOCALAPPDATA", "C:\\Users\\lea\\AppData\\Local"],
      ["NUMBER_OF_PROCESSORS", "8"],
      ["OS", "Windows_NT"],
      ["Path", "C:\\Program Files\\PowerShell\\7;C:\\WINDOWS\\system32;C:\\WINDOWS;C:\\Users\\lea\\AppData\\Local\\Microsoft\\WindowsApps"],
      ["PROCESSOR_ARCHITECTURE", "AMD64"],
      ["ProgramFiles", "C:\\Program Files"],
      ["PUBLIC", "C:\\Users\\Public"],
      ["SystemDrive", "C:"],
      ["SystemRoot", "C:\\WINDOWS"],
      ["TEMP", "C:\\Users\\lea\\AppData\\Local\\Temp"],
      ["TMP", "C:\\Users\\lea\\AppData\\Local\\Temp"],
      ["USERDOMAIN", "WOLKENRIED"],
      ["USERNAME", "lea"],
      ["USERPROFILE", "C:\\Users\\lea"],
      ["windir", "C:\\WINDOWS"],
    ],
    // HKCU: verschachtelte Schlüssel mit Werten
    registry: {
      Console: { werte: [["FontSize", 1048576], ["QuickEdit", 1]] },
      "Control Panel": { kinder: { Desktop: { werte: [["Wallpaper", "C:\\Users\\lea\\Bilder\\gemeindehaus.png"]] } } },
      Environment: { werte: [["TEMP", "C:\\Users\\lea\\AppData\\Local\\Temp"], ["TMP", "C:\\Users\\lea\\AppData\\Local\\Temp"]] },
      Software: { kinder: { Microsoft: {}, Wolkenried: { kinder: { Sync: { werte: [["Server", "sync.wolkenried.ch"], ["Intervall", 15]] } } } } },
    },
    // Netz für Test-Connection: Name → [Adresse, Latenz in ms (null = keine Antwort)]
    netz: {
      localhost: ["::1", 0], "127.0.0.1": ["127.0.0.1", 0], "wr-lea-01": ["10.0.0.42", 0],
      server: ["10.0.0.10", 1], "sync.wolkenried.ch": ["10.0.0.25", null], "www.wolkenried.ch": ["203.0.113.10", 12],
      "learn.microsoft.com": ["13.107.246.40", 9],
    },
  };

  const msAusText = (t) => {
    const d = datumLesen(t, false);
    return d ? d.ms : JETZT.ms;
  };
  // Grösse einer Textdatei wie pwsh 7: UTF-8 ohne BOM, jede Zeile mit CRLF
  function textGroesse(inhalt) {
    if (inhalt === null || inhalt === undefined) return 0;
    let n = 0;
    for (const ch of inhalt) {
      const c = ch.codePointAt(0);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    return n;
  }
  const zeilenAlsInhalt = (zeilen) => (zeilen.length ? zeilen.join("\r\n") + "\r\n" : "");

  /* ---------- Welt: Zustand des Spiel-Rechners ---------- */

  class Welt {
    constructor(daten) {
      daten = daten || LEA;
      this.computer = daten.computer;
      this.benutzer = daten.benutzer;
      this.domaene = daten.domaene;
      this.home = daten.home;
      this.zeit = msAusText(daten.zeit);
      this.admin = !!daten.admin;
      this.richtlinie = daten.richtlinie || "RemoteSigned";
      this.laufwerkC = Object.assign({}, daten.laufwerkC);
      this.c = { name: "C:", ordner: true, kinder: [], zeit: this.zeit, erstellt: this.zeit };
      (daten.ordner || []).forEach((o) => this.ordnerAnlegen(o[0], msAusText(o[1]), !!o[2]));
      (daten.dateien || []).forEach((d) => this.dateiSchreiben(d[0], d[3] === undefined || d[3] === null ? null : d[3].replace(/\r?\n/g, "\r\n") + "\r\n",
        { zeit: msAusText(d[1]), groesse: d[2], versteckt: !!d[4], ohneOrdnerZeit: true }));
      this.prozesse = (daten.prozesse || []).map((p) => ({
        name: p[0], id: p[1], si: p[2], npm: p[3], pm: p[4], ws: p[5], cpu: p[6], system: !!p[7],
        pfad: p[8] || null, firma: p[9] || null, beschreibung: p[10] || null,
      }));
      this.dienste = (daten.dienste || []).map((d) => ({ name: d[0], anzeige: d[1], status: d[2], start: d[3] }));
      this.env = (daten.env || []).map((e) => [e[0], e[1]]);
      this.registry = JSON.parse(JSON.stringify(daten.registry || {}));
      this.netz = Object.assign({}, daten.netz || {});
    }

    // Tiefe Kopie (für Zurücksetzen und Rückfragen)
    kopie() {
      const w = Object.create(Welt.prototype);
      Object.assign(w, this);
      const kopiereKnoten = (k) => Object.assign({}, k, k.kinder ? { kinder: k.kinder.map(kopiereKnoten) } : {});
      w.c = kopiereKnoten(this.c);
      w.prozesse = this.prozesse.map((p) => Object.assign({}, p));
      w.dienste = this.dienste.map((d) => Object.assign({}, d));
      w.env = this.env.map((e) => e.slice());
      w.registry = JSON.parse(JSON.stringify(this.registry));
      w.laufwerkC = Object.assign({}, this.laufwerkC);
      w.netz = Object.assign({}, this.netz);
      return w;
    }

    // Pfad "C:\a\b" → ["a","b"] (nur Laufwerk C)
    static teileVon(pfad) {
      const p = String(pfad).replace(/\//g, "\\").replace(/^[Cc]:\\?/, "");
      return p.split("\\").filter((x) => x !== "");
    }
    knoten(teile) {
      let k = this.c;
      for (const t of teile) {
        if (!k.ordner) return null;
        k = k.kinder.find((x) => gleichCI(x.name, t));
        if (!k) return null;
      }
      return k;
    }
    elternUndName(teile) {
      return { eltern: this.knoten(teile.slice(0, -1)), name: teile[teile.length - 1] };
    }
    ordnerAnlegen(pfad, zeit, versteckt) {
      const teile = Array.isArray(pfad) ? pfad : Welt.teileVon(pfad);
      let k = this.c;
      teile.forEach((t, i) => {
        let kind = k.kinder.find((x) => gleichCI(x.name, t));
        if (!kind) {
          kind = { name: t, ordner: true, kinder: [], zeit: zeit === undefined ? this.zeit : zeit, erstellt: zeit === undefined ? this.zeit : zeit, versteckt: false };
          k.kinder.push(kind);
        }
        if (i === teile.length - 1) {
          if (zeit !== undefined) kind.zeit = zeit;
          if (versteckt) kind.versteckt = true;
        }
        k = kind;
      });
      return k;
    }
    // Datei anlegen oder überschreiben; inhalt null = Datei ohne hinterlegten Text (nur Grösse)
    dateiSchreiben(pfad, inhalt, o) {
      o = o || {};
      const teile = Array.isArray(pfad) ? pfad : Welt.teileVon(pfad);
      const eltern = this.ordnerAnlegen(teile.slice(0, -1), o.ohneOrdnerZeit ? undefined : undefined);
      const name = teile[teile.length - 1];
      let d = eltern.kinder.find((x) => gleichCI(x.name, name));
      const zeit = o.zeit === undefined ? this.zeit : o.zeit;
      if (!d) {
        d = { name: name, ordner: false, erstellt: zeit, versteckt: !!o.versteckt, nurLesen: false };
        eltern.kinder.push(d);
        if (!o.ohneOrdnerZeit) eltern.zeit = this.zeit;
      }
      d.inhalt = inhalt;
      d.groesse = o.groesse === undefined || o.groesse === null ? textGroesse(inhalt) : o.groesse;
      d.zeit = zeit;
      return d;
    }
    // Kinder wie NTFS sortiert (Ordner zuerst wie pwsh 7)
    kinderSortiert(k) {
      const liste = (k.kinder || []).slice();
      liste.sort((a, b) => (a.ordner === b.ordner ? ordinalCI(a.name, b.name) : a.ordner ? -1 : 1));
      return liste;
    }

    prozess(id) { return this.prozesse.find((p) => p.id === id) || null; }
    dienst(name) { return this.dienste.find((d) => gleichCI(d.name, name)) || null; }
    envHolen(name) { const e = this.env.find((x) => gleichCI(x[0], name)); return e ? e[1] : null; }
    envSetzen(name, wert) {
      const e = this.env.find((x) => gleichCI(x[0], name));
      if (wert === null || wert === "") { if (e) this.env.splice(this.env.indexOf(e), 1); return; }
      if (e) e[1] = wert; else this.env.push([name, wert]);
    }
    registryKnoten(teile) {
      let k = { kinder: this.registry };
      for (const t of teile) {
        const name = Object.keys(k.kinder || {}).find((n) => gleichCI(n, t));
        if (!name) return null;
        k = Object.assign({ name: name }, k.kinder[name]);
      }
      return k;
    }
  }

  // cfg.umgebung auf eine Welt anwenden (ergänzen, ersetzen, entfernen)
  function umgebungAnwenden(welt, u) {
    if (!u) return welt;
    if (u.ersetzen) {
      welt = new Welt({ computer: LEA.computer, benutzer: LEA.benutzer, domaene: LEA.domaene, home: LEA.home, zeit: u.zeit || LEA.zeit,
        ordner: [["C:\\Users", LEA.zeit], ["C:\\Users\\lea", LEA.zeit]], dateien: [], prozesse: [["pwsh", 9120, 1, 40960, 88080384, 121634816, 3.5, false]],
        dienste: [], env: LEA.env, registry: {}, netz: LEA.netz, laufwerkC: LEA.laufwerkC, richtlinie: LEA.richtlinie });
    }
    if (u.zeit) welt.zeit = msAusText(u.zeit);
    if (u.admin !== undefined) welt.admin = !!u.admin;
    if (u.richtlinie) welt.richtlinie = u.richtlinie;
    (u.ordner || []).forEach((o) => {
      const x = typeof o === "string" ? { pfad: o } : o;
      welt.ordnerAnlegen(x.pfad, x.zeit ? msAusText(x.zeit) : welt.zeit, !!x.versteckt);
    });
    (u.dateien || []).forEach((d) => {
      const inhalt = d.inhalt === undefined || d.inhalt === null ? null : String(d.inhalt).replace(/\r?\n/g, "\r\n") + "\r\n";
      welt.dateiSchreiben(d.pfad, inhalt, { zeit: d.zeit ? msAusText(d.zeit) : welt.zeit, groesse: d.groesse, versteckt: !!d.versteckt });
    });
    (u.entfernen || []).forEach((p) => {
      const teile = Welt.teileVon(p);
      const eltern = welt.knoten(teile.slice(0, -1));
      if (eltern && eltern.kinder) eltern.kinder = eltern.kinder.filter((k) => !gleichCI(k.name, teile[teile.length - 1]));
    });
    (u.prozesse || []).forEach((p) => {
      const neu = { name: p.name, id: p.id, si: p.si === undefined ? 1 : p.si, npm: p.npm || 20480, pm: p.pm || 10485760, ws: p.ws || 20971520,
        cpu: p.cpu === undefined ? 1 : p.cpu, system: !!p.system, pfad: p.pfad || null, firma: p.firma || null, beschreibung: p.beschreibung || null };
      welt.prozesse = welt.prozesse.filter((x) => x.id !== neu.id).concat([neu]);
    });
    (u.dienste || []).forEach((d) => {
      const neu = { name: d.name, anzeige: d.anzeige || d.name, status: d.status || "Stopped", start: d.start || "Manual" };
      welt.dienste = welt.dienste.filter((x) => !gleichCI(x.name, neu.name)).concat([neu]);
    });
    Object.keys(u.env || {}).forEach((k) => welt.envSetzen(k, u.env[k]));
    return welt;
  }

  /* ======================================================================
     4. Tokenizer
     PowerShell liest Text in zwei Modi:
       «ausdruck»: $x -gt 5, 1MB, "Text", Operatoren
       «befehl»:   Get-ChildItem -Path Logs *.log  (Wörter sind Text, -Name ist ein Parameter)
     Der Parser sagt dem Tokenizer bei jedem Token, in welchem Modus er lesen soll.
     Token: { art, wert, start, ende, … }
       art: ende, nl, sym (Satzzeichen), zahl, string, xstring (mit $-Teilen), variable,
            operator, zuweisung, parameter, wort, xwort, umleitung
     ====================================================================== */

  const OPERATOREN = new Set([
    "eq", "ne", "gt", "ge", "lt", "le", "like", "notlike", "match", "notmatch", "contains", "notcontains", "in", "notin",
    "replace", "split", "join", "is", "isnot", "as", "and", "or", "xor", "not", "band", "bor", "bxor", "bnot", "shl", "shr", "f",
  ]);
  ["eq", "ne", "gt", "ge", "lt", "le", "like", "notlike", "match", "notmatch", "contains", "notcontains", "in", "notin", "replace", "split"]
    .forEach((o) => { OPERATOREN.add("c" + o); OPERATOREN.add("i" + o); });
  const SCHLUESSELWOERTER = new Set([
    "if", "elseif", "else", "switch", "foreach", "for", "while", "do", "until", "function", "filter", "param", "begin", "process", "end",
    "try", "catch", "finally", "throw", "return", "break", "continue", "exit", "trap", "class", "enum", "data", "dynamicparam", "using",
  ]);
  const EINFACHE_ANFZ = "'‘’‚‛";
  const DOPPELTE_ANFZ = "\"“”„";
  const STRICHE = "-–—―";
  const ZAHL_MUSTER = /^(0x[0-9a-f]+|(?:\d+(?:\.(?!\.)\d*)?|\.\d+)(?:e[+-]?\d+)?)([dl])?(kb|mb|gb|tb|pb)?/i;
  const NAME_ZEICHEN = /[A-Za-z0-9_À-ɏ]/;
  const BEREICHE_VAR = ["env", "global", "script", "local", "private", "variable", "using"];

  // Wert einer Zahl aus dem Quelltext ("1.5MB", "0x1F", "42")
  function zahlLiteral(text) {
    const m = ZAHL_MUSTER.exec(text);
    if (!m || m[0].length !== text.length) return null;
    let w, double = false;
    if (/^0x/i.test(m[1])) w = parseInt(m[1].slice(2), 16);
    else { w = Number(m[1]); double = /[.e]/i.test(m[1]); }
    if (m[2] && klein(m[2]) === "d") double = true;
    if (m[3]) w *= Math.pow(1024, ["kb", "mb", "gb", "tb", "pb"].indexOf(klein(m[3])) + 1);
    return double ? alsDouble(w) : w;
  }

  class Lexer {
    constructor(text) {
      this.t = text;
      this.i = 0;
      this.kommentare = [];
    }
    zeichen(o) { return this.t.charAt(this.i + (o || 0)); }
    amEnde() { return this.i >= this.t.length; }

    // Leerzeichen, Tabs, Zeilenfortsetzung (` am Zeilenende) und Kommentare überspringen
    leerzeichen(mitZeilen) {
      for (;;) {
        const c = this.zeichen();
        if (c === " " || c === "\t" || c === " " || c === "\f") { this.i++; continue; }
        if (c === "`" && (this.zeichen(1) === "\n" || (this.zeichen(1) === "\r" && this.zeichen(2) === "\n"))) {
          this.i += this.zeichen(1) === "\r" ? 3 : 2;
          continue;
        }
        if (mitZeilen && (c === "\n" || c === "\r")) { this.i++; continue; }
        if (c === "#") {
          const start = this.i;
          while (!this.amEnde() && this.zeichen() !== "\n" && this.zeichen() !== "\r") this.i++;
          this.kommentare.push({ start: start, ende: this.i });
          continue;
        }
        if (c === "<" && this.zeichen(1) === "#") {
          const start = this.i;
          const ende = this.t.indexOf("#>", this.i + 2);
          if (ende < 0) throw new ParseFehler("Missing end of comment block.", start, 2, true);
          this.i = ende + 2;
          this.kommentare.push({ start: start, ende: this.i });
          continue;
        }
        return;
      }
    }

    // Nächstes Token lesen, ohne es zu verbrauchen
    blick(modus) {
      const merk = this.i, merkK = this.kommentare.length;
      try { return this.naechstes(modus); } finally { this.i = merk; this.kommentare.length = merkK; }
    }

    naechstes(modus) {
      this.leerzeichen(false);
      const start = this.i;
      const tok = (art, wert, extra) => Object.assign({ art: art, wert: wert, start: start, ende: this.i }, extra || {});
      if (this.amEnde()) return tok("ende", null);
      const c = this.zeichen(), n = this.zeichen(1);

      if (c === "\r" && n === "\n") { this.i += 2; return tok("nl", "\n"); }
      if (c === "\n" || c === "\r") { this.i++; return tok("nl", "\n"); }
      if (c === ";") { this.i++; return tok("sym", ";"); }
      if (c === "|") { if (n === "|") { this.i += 2; return tok("sym", "||"); } this.i++; return tok("sym", "|"); }
      if (c === "&") { if (n === "&") { this.i += 2; return tok("sym", "&&"); } this.i++; return tok("sym", "&"); }
      if ("(){}".includes(c)) { this.i++; return tok("sym", c); }
      if (c === "," ) { this.i++; return tok("sym", ","); }
      if (c === "$" && n === "(") { this.i += 2; return tok("sym", "$("); }
      if (c === "@" && n === "(") { this.i += 2; return tok("sym", "@("); }
      if (c === "@" && n === "{") { this.i += 2; return tok("sym", "@{"); }
      if (c === "@" && (enthaelt(DOPPELTE_ANFZ, n) || enthaelt(EINFACHE_ANFZ, n)) && /^[ \t]*\r?\n/.test(this.t.slice(this.i + 2))) return this.hereString();

      // Umleitung: > >> 2> 2>> 2>&1 *> …
      const um = /^([1-6*])?>(>|&[12])?/.exec(this.t.slice(this.i));
      if (um && (um[1] || c === ">")) { this.i += um[0].length; return tok("umleitung", um[0]); }

      if (c === "$") return this.variable();
      if (enthaelt(EINFACHE_ANFZ, c)) return this.einfacherString();
      if (enthaelt(DOPPELTE_ANFZ, c)) return this.doppelterString();

      if (modus === "befehl") return this.befehlsToken();
      return this.ausdrucksToken();
    }

    variable() {
      const start = this.i;
      this.i++; // $
      let name = "", bereich = null;
      if (this.zeichen() === "{") {
        const ende = this.t.indexOf("}", this.i);
        if (ende < 0) throw new ParseFehler("Missing '}' in variable reference.", start, 2, true);
        name = this.t.slice(this.i + 1, ende);
        this.i = ende + 1;
      } else if (enthaelt("?^$", this.zeichen()) && !NAME_ZEICHEN.test(this.zeichen(1) || " ")) {
        name = this.zeichen();
        this.i++;
      } else {
        while (NAME_ZEICHEN.test(this.zeichen())) name += this.t.charAt(this.i++);
        if (this.zeichen() === ":" && this.zeichen(1) !== ":" && BEREICHE_VAR.includes(klein(name)) && NAME_ZEICHEN.test(this.zeichen(1))) {
          bereich = klein(name);
          this.i++;
          name = "";
          while (NAME_ZEICHEN.test(this.zeichen())) name += this.t.charAt(this.i++);
        }
      }
      if (name === "") return { art: "wort", wert: "$", start: start, ende: this.i };
      const teil = name.indexOf(":");
      if (!bereich && teil > 0) { bereich = klein(name.slice(0, teil)); name = name.slice(teil + 1); }
      return { art: "variable", wert: name, bereich: bereich, start: start, ende: this.i };
    }

    einfacherString() {
      const start = this.i;
      this.i++;
      let s = "";
      for (;;) {
        if (this.amEnde()) throw new ParseFehler("The string is missing the terminator: '.", start, 1, true);
        const c = this.zeichen();
        if (enthaelt(EINFACHE_ANFZ, c)) {
          if (enthaelt(EINFACHE_ANFZ, this.zeichen(1))) { s += "'"; this.i += 2; continue; }
          this.i++;
          break;
        }
        s += c;
        this.i++;
      }
      return { art: "string", wert: s, start: start, ende: this.i };
    }

    doppelterString() {
      const start = this.i;
      this.i++;
      const inhaltStart = this.i;
      for (;;) {
        if (this.amEnde()) throw new ParseFehler('The string is missing the terminator: ".', start, 1, true);
        const c = this.zeichen();
        if (c === "`") { this.i += 2; continue; }
        if (c === "$" && this.zeichen(1) === "(") { this.i = this.klammerEnde(this.i + 1); continue; }
        if (enthaelt(DOPPELTE_ANFZ, c)) {
          if (enthaelt(DOPPELTE_ANFZ, this.zeichen(1))) { this.i += 2; continue; }
          break;
        }
        this.i++;
      }
      const roh = this.t.slice(inhaltStart, this.i);
      this.i++;
      return { art: "xstring", teile: stringTeile(roh, inhaltStart, true), start: start, ende: this.i };
    }

    hereString() {
      const start = this.i;
      const doppelt = enthaelt(DOPPELTE_ANFZ, this.zeichen(1));
      const zeilenEnde = this.t.indexOf("\n", this.i);
      const inhaltStart = zeilenEnde + 1;
      const muster = doppelt ? /\r?\n["“”„]@/g : /\r?\n['‘’‚‛]@/g;
      muster.lastIndex = inhaltStart - 1;
      const m = muster.exec(this.t);
      if (!m) throw new ParseFehler("The string is missing the terminator: " + (doppelt ? '"@' : "'@") + ".", start, 2, true);
      const roh = this.t.slice(inhaltStart, m.index);
      this.i = m.index + m[0].length;
      if (!doppelt) return { art: "string", wert: roh.replace(/\r\n/g, "\n"), start: start, ende: this.i };
      return { art: "xstring", teile: stringTeile(roh.replace(/\r\n/g, "\n"), inhaltStart, false), start: start, ende: this.i };
    }

    // Ende einer Klammer $( … ) finden (Strings und verschachtelte Klammern beachten)
    klammerEnde(i) {
      let tiefe = 0;
      for (; i < this.t.length; i++) {
        const c = this.t.charAt(i);
        if (c === "`") { i++; continue; }
        if (enthaelt(EINFACHE_ANFZ, c)) {
          i++;
          while (i < this.t.length && !enthaelt(EINFACHE_ANFZ, this.t.charAt(i))) i++;
          continue;
        }
        if (enthaelt(DOPPELTE_ANFZ, c) && tiefe > 0) {
          i++;
          while (i < this.t.length && !enthaelt(DOPPELTE_ANFZ, this.t.charAt(i))) { if (this.t.charAt(i) === "`") i++; i++; }
          continue;
        }
        if (c === "(") tiefe++;
        else if (c === ")") { tiefe--; if (tiefe === 0) return i + 1; }
      }
      throw new ParseFehler("Missing closing ')' in subexpression.", i, 1, true);
    }

    // Befehlsmodus: Parameter (-Name), Zahl oder Wort bis zum nächsten Trennzeichen
    befehlsToken() {
      const start = this.i;
      const c = this.zeichen(), n = this.zeichen(1);
      if (enthaelt(STRICHE, c) && /[A-Za-z_?]/.test(n)) {
        this.i++;
        let name = "";
        while (/[A-Za-z0-9_\-?]/.test(this.zeichen()) && !(this.zeichen() === "-" && !/[A-Za-z0-9_]/.test(this.zeichen(1)))) name += this.t.charAt(this.i++);
        let doppelpunkt = false;
        if (this.zeichen() === ":") { doppelpunkt = true; this.i++; }
        return { art: "parameter", wert: name, doppelpunkt: doppelpunkt, start: start, ende: this.i };
      }
      let wort = "";
      let mitVariable = false;
      while (!this.amEnde()) {
        const z = this.zeichen();
        if (/[\s;|&(){},<>]/.test(z) || enthaelt(EINFACHE_ANFZ, z) || enthaelt(DOPPELTE_ANFZ, z)) {
          if (z === "(" && wort.endsWith("$")) { /* $( im Wort */ } else break;
        }
        if (z === "`" && this.i + 1 < this.t.length) { wort += this.t.charAt(this.i) + this.t.charAt(this.i + 1); this.i += 2; continue; }
        if (z === "$" && /[A-Za-z_{(]/.test(this.zeichen(1))) mitVariable = true;
        wort += z;
        this.i++;
      }
      if (wort === "") { this.i++; return { art: "sym", wert: c, start: start, ende: this.i }; }
      const zahl = /^[\d.-]/.test(wort) ? zahlLiteral(wort.replace(/^[–—―]/, "-").replace(/^-/, "")) : null;
      if (zahl !== null && /^-?[\d.]/.test(wort)) {
        const neg = wort.startsWith("-");
        return { art: "zahl", wert: neg ? (istDouble(zahl) ? alsDouble(-zahlWert(zahl)) : -zahl) : zahl, roh: wort, start: start, ende: this.i };
      }
      if (mitVariable) return { art: "xwort", teile: stringTeile(wort, start, true), roh: wort, start: start, ende: this.i };
      return { art: "wort", wert: wort.replace(/`(.)/g, "$1"), roh: wort, start: start, ende: this.i };
    }

    // Ausdrucksmodus: Zahlen, Operatoren, Namen
    ausdrucksToken() {
      const start = this.i;
      const rest = this.t.slice(this.i);
      const tok = (art, wert, laenge, extra) => { this.i += laenge; return Object.assign({ art: art, wert: wert, start: start, ende: this.i }, extra || {}); };
      const c = rest.charAt(0), n = rest.charAt(1);

      if (/[\d]/.test(c) || (c === "." && /\d/.test(n))) {
        const m = ZAHL_MUSTER.exec(rest);
        const folgt = rest.charAt(m[0].length);
        if (NAME_ZEICHEN.test(folgt)) {
          let ende = m[0].length;
          while (NAME_ZEICHEN.test(rest.charAt(ende))) ende++;
          throw new ParseFehler("Unexpected token '" + rest.slice(0, ende) + "' in expression or statement.", start, ende);
        }
        return tok("zahl", zahlLiteral(m[0]), m[0].length);
      }
      if (enthaelt(STRICHE, c)) {
        const m = /^[-–—―]([A-Za-z]+)/.exec(rest);
        if (m) {
          const op = klein(m[1]);
          if (OPERATOREN.has(op)) return tok("operator", "-" + op, m[0].length);
          throw new ParseFehler("Unexpected token '" + m[0] + "' in expression or statement.", start, m[0].length);
        }
        if (n === "-") return tok("operator", "--", 2);
        if (n === "=") return tok("zuweisung", "-=", 2);
        return tok("operator", "-", 1);
      }
      const zwei = rest.slice(0, 3) === "??=" ? "??=" : rest.slice(0, 2);
      if (["+=", "*=", "/=", "%=", "??="].includes(zwei)) return tok("zuweisung", zwei, zwei.length);
      if (["++", "..", "::", "??", "?."].includes(zwei)) return tok(zwei === "::" || zwei === "?." ? "sym" : "operator", zwei, 2);
      if (zwei === "!=" || zwei === "==") throw new ParseFehler("Unexpected token '" + zwei.charAt(1) + "' in expression or statement.", start + 1, 1);
      if ("+*/%!".includes(c)) return tok("operator", c, 1);
      if (c === "=") return tok("zuweisung", "=", 1);
      if ("[].?:".includes(c)) return tok("sym", c, 1);
      if (NAME_ZEICHEN.test(c)) {
        let ende = 0;
        while (ende < rest.length && (NAME_ZEICHEN.test(rest.charAt(ende)) || (rest.charAt(ende) === "-" && NAME_ZEICHEN.test(rest.charAt(ende + 1))))) ende++;
        return tok("wort", rest.slice(0, ende), ende);
      }
      return tok("sym", c, 1);
    }
  }

  // Teile eines Strings mit Einsetzen: Text, $variable, $( … )
  function stringTeile(roh, basis, escapes) {
    const teile = [];
    let text = "";
    const flush = () => { if (text) { teile.push({ art: "text", wert: text }); text = ""; } };
    for (let i = 0; i < roh.length; i++) {
      const c = roh.charAt(i);
      if (c === "`" && escapes && i + 1 < roh.length) {
        const e = roh.charAt(++i);
        if (e === "u" && roh.charAt(i + 1) === "{") {
          const ende = roh.indexOf("}", i);
          text += String.fromCodePoint(parseInt(roh.slice(i + 2, ende), 16));
          i = ende;
        } else text += { n: "\n", t: "\t", r: "\r", "0": "\0", a: "\u0007", b: "\b", e: "\u001b", f: "\f", v: "\v" }[e] || e;
        continue;
      }
      if (enthaelt(DOPPELTE_ANFZ, c) && enthaelt(DOPPELTE_ANFZ, roh.charAt(i + 1))) { text += '"'; i++; continue; }
      if (c === "$") {
        const n = roh.charAt(i + 1);
        if (n === "(") {
          const lx = new Lexer(roh);
          const ende = lx.klammerEnde(i + 1);
          flush();
          teile.push({ art: "sub", quelle: roh.slice(i + 2, ende - 1), start: basis + i + 2 });
          i = ende - 1;
          continue;
        }
        if (n === "{") {
          const ende = roh.indexOf("}", i);
          if (ende > 0) { flush(); teile.push({ art: "var", name: roh.slice(i + 2, ende), bereich: null, start: basis + i }); i = ende; continue; }
        }
        if (NAME_ZEICHEN.test(n) || ((n === "?" || n === "^" || n === "$") && i + 1 < roh.length)) {
          let j = i + 1, name = "", bereich = null;
          if (!NAME_ZEICHEN.test(n)) { name = n; j++; }
          else {
            while (j < roh.length && NAME_ZEICHEN.test(roh.charAt(j))) name += roh.charAt(j++);
            if (roh.charAt(j) === ":" && BEREICHE_VAR.includes(klein(name)) && NAME_ZEICHEN.test(roh.charAt(j + 1))) {
              bereich = klein(name);
              name = "";
              j++;
              while (j < roh.length && NAME_ZEICHEN.test(roh.charAt(j))) name += roh.charAt(j++);
            }
          }
          flush();
          teile.push({ art: "var", name: name, bereich: bereich, start: basis + i });
          i = j - 1;
          continue;
        }
      }
      text += c;
    }
    flush();
    return teile;
  }

  /* ======================================================================
     5. Parser: Text → Syntaxbaum
     Knoten haben k (Art), start und ende (Zeichenpositionen für Fehlermeldungen).
     Anweisungen: skript, pipeline, zuweisung, kette (&& ||), if, switch, foreach, for, while, do,
                  funktion, try, throw, return, break, continue, exit
     Pipeline-Elemente: befehl, ausdruck
     Ausdrücke: zahl, string, xstring, wort, var, array, arrayausdruck, subausdruck, klammer, hash,
                skriptblock, binaer, unaer, cast, typ, member, index, inkrement, ternaer
     ====================================================================== */

  // Vorrang der binären Operatoren (höher bindet stärker)
  const VORRANG = {
    "-and": 1, "-or": 1, "-xor": 1,
    "-band": 3, "-bor": 3, "-bxor": 3, "-shl": 3, "-shr": 3,
    "+": 4, "-": 4, "*": 5, "/": 5, "%": 5, "-f": 7, "..": 8,
  };
  const VERGLEICHE = /^-[ci]?(eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|contains|notcontains|in|notin|replace|split)$|^-(join|is|isnot|as)$/;
  const vorrang = (op) => (VERGLEICHE.test(op) ? 2 : VORRANG[op] || 0);

  class Parser {
    constructor(text) {
      this.q = text;
      this.lx = new Lexer(text);
    }
    fehler(meldung, pos, laenge, unvollstaendig) { return new ParseFehler(meldung, pos, laenge, unvollstaendig); }
    blick(modus) { return this.lx.blick(modus || "ausdruck"); }
    nimm(modus) { return this.lx.naechstes(modus || "ausdruck"); }
    istSym(t, w) { return t.art === "sym" && t.wert === w; }
    zeichen() { return this.lx.zeichen(); }
    zeilenUeberspringen() { for (;;) { this.lx.leerzeichen(true); if (this.zeichen() === ";") { this.lx.i++; continue; } return; } }
    nurZeilen() { this.lx.leerzeichen(true); }

    erwarteSym(w, meldung, unvollstaendig) {
      const t = this.nimm("ausdruck");
      if (!this.istSym(t, w)) {
        const ende = t.art === "ende";
        throw this.fehler(meldung || "Missing '" + w + "'.", ende ? this.q.length : t.start, 1, ende || unvollstaendig);
      }
      return t;
    }
    unerwartet(t) {
      if (t.art === "ende") return this.fehler("Unexpected end of input.", this.q.length, 1, true);
      const roh = this.q.slice(t.start, t.ende) || t.wert;
      return this.fehler("Unexpected token '" + roh + "' in expression or statement.", t.start, Math.max(1, t.ende - t.start));
    }

    /* ---------- Skript und Anweisungslisten ---------- */

    skript() {
      this.zeilenUeberspringen();
      const param = this.paramBlockFalls();
      const saetze = this.saetze(null);
      const t = this.blick();
      if (t.art !== "ende") throw this.unerwartet(t);
      return { k: "skript", param: param, saetze: saetze, start: 0, ende: this.q.length };
    }

    // Anweisungen bis zum schliessenden Zeichen ("}" oder ")") bzw. Textende
    saetze(endeZeichen, oeffner) {
      const liste = [];
      for (;;) {
        this.zeilenUeberspringen();
        const t = this.blick("befehl");
        if (t.art === "ende") {
          if (endeZeichen) throw this.fehler(endeZeichen === "}" ? "Missing closing '}' in statement block or type definition." : "Missing closing ')' in expression.", oeffner === undefined ? this.q.length : oeffner, 1, true);
          return liste;
        }
        if (endeZeichen && this.istSym(t, endeZeichen)) return liste;
        if (this.istSym(t, ")") || this.istSym(t, "}")) throw this.unerwartet(t);
        liste.push(this.satz());
        const n = this.blick("befehl");
        const nachBlock = /\}\s*$/.test(this.q.slice(0, this.lx.i)); // nach «}» darf die nächste Anweisung direkt folgen
        if (n.art !== "ende" && n.art !== "nl" && !this.istSym(n, ";") && !(endeZeichen && this.istSym(n, endeZeichen)) && !nachBlock) throw this.unerwartet(n);
      }
    }

    satz() {
      this.lx.leerzeichen(false);
      const t = this.blick("befehl");
      if (t.art === "wort") {
        const kw = klein(t.wert);
        const folgt = this.q.charAt(t.ende);
        if (SCHLUESSELWOERTER.has(kw) && !(kw === "in" || kw === "until")) {
          switch (kw) {
            case "if": return this.ifSatz();
            case "switch": return this.switchSatz();
            case "foreach": if (folgt !== "-") return this.foreachSatz(); break;
            case "for": return this.forSatz();
            case "while": return this.whileSatz();
            case "do": return this.doSatz();
            case "function": case "filter": return this.funktionSatz();
            case "try": return this.trySatz();
            case "throw": case "return": case "exit": return this.sprungMitWert(kw);
            case "break": case "continue": { this.nimm("befehl"); return { k: kw, start: t.start, ende: t.ende }; }
            case "param": throw this.fehler("Unexpected attribute 'param'.", t.start, 5);
            case "class": case "enum": case "trap": case "data": case "using": case "dynamicparam":
              throw this.fehler("Das Schlüsselwort «" + t.wert + "» ist im Simulator nicht nachgebaut.", t.start, t.ende - t.start);
            default: break;
          }
        }
      }
      return this.pipelineSatz();
    }

    sprungMitWert(art) {
      const t = this.nimm("befehl");
      this.lx.leerzeichen(false);
      const n = this.blick("befehl");
      let wert = null;
      if (!(n.art === "ende" || n.art === "nl" || this.istSym(n, ";") || this.istSym(n, "}") || this.istSym(n, ")"))) wert = this.pipelineSatz();
      return { k: art, wert: wert, start: t.start, ende: wert ? wert.ende : t.ende };
    }

    bedingungInKlammern(kw, start) {
      this.lx.leerzeichen(false);
      if (!this.istSym(this.blick(), "(")) throw this.fehler("Missing '(' after '" + kw + "' in " + kw + " statement.", this.lx.i, 1, this.lx.amEnde());
      this.nimm();
      this.nurZeilen();
      if (this.istSym(this.blick(), ")")) throw this.fehler("Missing condition in " + kw + " statement after '" + kw + " ('.", this.lx.i, 1);
      if (this.blick().art === "ende") throw this.fehler("Missing condition in " + kw + " statement after '" + kw + " ('.", this.q.length, 1, true);
      const bed = this.pipelineSatz();
      this.nurZeilen();
      this.erwarteSym(")", "Missing closing ')' after expression in '" + kw + "' statement.");
      return bed;
    }

    block(kontext) {
      this.nurZeilen();
      const t = this.blick();
      if (!this.istSym(t, "{")) throw this.fehler("Missing statement block " + (kontext || "") + ".", t.art === "ende" ? this.q.length : t.start, 1, t.art === "ende");
      return this.skriptblockLiteral().knoten;
    }

    // Prüft, ob nach Zeilenumbrüchen das Schlüsselwort folgt (else, elseif, catch, finally, while)
    folgtWort(woerter) {
      const merk = this.lx.i;
      this.nurZeilen();
      const t = this.blick("befehl");
      if (t.art === "wort" && woerter.includes(klein(t.wert))) return klein(t.wert);
      this.lx.i = merk;
      return null;
    }

    ifSatz() {
      const start = this.nimm("befehl").start;
      const zweige = [];
      let sonst = null;
      zweige.push({ bed: this.bedingungInKlammern("if", start), block: this.block("after if ( condition )") });
      for (;;) {
        const w = this.folgtWort(["elseif", "else"]);
        if (!w) break;
        this.nimm("befehl");
        if (w === "elseif") zweige.push({ bed: this.bedingungInKlammern("elseif"), block: this.block("after elseif ( condition )") });
        else { sonst = this.block("after 'else' keyword"); break; }
      }
      return { k: "if", zweige: zweige, sonst: sonst, start: start, ende: this.lx.i };
    }

    switchSatz() {
      const start = this.nimm("befehl").start;
      const optionen = {};
      for (;;) {
        this.lx.leerzeichen(false);
        const t = this.blick("befehl");
        if (t.art !== "parameter") break;
        this.nimm("befehl");
        optionen[klein(t.wert)] = true;
      }
      const wert = this.bedingungInKlammern("switch", start);
      this.nurZeilen();
      this.erwarteSym("{", "Missing opening '{' in switch statement.", true);
      const faelle = [];
      let standard = null;
      for (;;) {
        this.zeilenUeberspringen();
        const t = this.blick("befehl");
        if (this.istSym(t, "}")) { this.nimm(); break; }
        if (t.art === "ende") throw this.fehler("Missing closing '}' in statement block or type definition.", this.q.length, 1, true);
        if (t.art === "wort" && klein(t.wert) === "default") {
          this.nimm("befehl");
          standard = this.block("in switch default clause");
          continue;
        }
        const test = this.befehlsArgument();
        const blk = this.block("in switch statement clause");
        faelle.push({ test: test, block: blk });
      }
      return { k: "switch", wert: wert, optionen: optionen, faelle: faelle, standard: standard, start: start, ende: this.lx.i };
    }

    foreachSatz() {
      const start = this.nimm("befehl").start;
      this.lx.leerzeichen(false);
      if (!this.istSym(this.blick(), "(")) throw this.fehler("Missing opening '(' after keyword 'foreach'.", this.lx.i, 1, this.lx.amEnde());
      this.nimm();
      this.nurZeilen();
      const v = this.nimm();
      if (v.art !== "variable") throw this.fehler("Missing variable name after foreach.", v.start, 1, v.art === "ende");
      this.lx.leerzeichen(true);
      const inT = this.nimm();
      if (!(inT.art === "wort" && klein(inT.wert) === "in")) throw this.fehler("Missing 'in' after variable in foreach loop.", inT.start, 1, inT.art === "ende");
      this.nurZeilen();
      const sammlung = this.pipelineSatz();
      this.nurZeilen();
      this.erwarteSym(")", "Missing closing ')' after expression in 'foreach' statement.");
      return { k: "foreach", var: v.wert, sammlung: sammlung, block: this.block("in foreach loop"), start: start, ende: this.lx.i };
    }

    forSatz() {
      const start = this.nimm("befehl").start;
      this.lx.leerzeichen(false);
      this.erwarteSym("(", "Missing opening '(' after keyword 'for'.");
      const teil = (ende) => {
        this.nurZeilen();
        const t = this.blick("befehl");
        if (this.istSym(t, ende)) return null;
        return this.pipelineSatz();
      };
      const init = teil(";");
      this.nurZeilen();
      this.erwarteSym(";", "Missing ';' in for statement.");
      const bed = teil(";");
      this.nurZeilen();
      this.erwarteSym(";", "Missing ';' in for statement.");
      const schritt = teil(")");
      this.nurZeilen();
      this.erwarteSym(")", "Missing closing ')' after expression in 'for' statement.");
      return { k: "for", init: init, bed: bed, schritt: schritt, block: this.block("in for loop"), start: start, ende: this.lx.i };
    }

    whileSatz() {
      const start = this.nimm("befehl").start;
      const bed = this.bedingungInKlammern("while", start);
      return { k: "while", bed: bed, block: this.block("in while loop"), start: start, ende: this.lx.i };
    }

    doSatz() {
      const start = this.nimm("befehl").start;
      const blk = this.block("in do loop");
      const w = this.folgtWort(["while", "until"]);
      if (!w) throw this.fehler("Missing while or until in do loop.", this.lx.i, 1, this.lx.amEnde());
      this.nimm("befehl");
      const bed = this.bedingungInKlammern(w, start);
      return { k: "do", block: blk, bed: bed, bis: w === "until", start: start, ende: this.lx.i };
    }

    funktionSatz() {
      const start = this.nimm("befehl").start;
      this.lx.leerzeichen(false);
      const n = this.nimm("befehl");
      if (n.art !== "wort") throw this.fehler("Missing function name.", n.start, 1, n.art === "ende");
      let param = null;
      this.lx.leerzeichen(false);
      if (this.istSym(this.blick(), "(")) {
        this.nimm();
        param = this.paramListe(")");
      }
      this.nurZeilen();
      if (!this.istSym(this.blick(), "{")) throw this.fehler("Missing function body in function declaration.", this.lx.i, 1, this.lx.amEnde());
      const sb = this.skriptblockLiteral();
      if (param && !sb.knoten.param) sb.knoten.param = param;
      return { k: "funktion", name: n.wert, koerper: sb, start: start, ende: this.lx.i };
    }

    trySatz() {
      const start = this.nimm("befehl").start;
      const blk = this.block("after 'try'");
      const faenge = [];
      let schluss = null;
      for (;;) {
        const w = this.folgtWort(["catch", "finally"]);
        if (!w) break;
        this.nimm("befehl");
        if (w === "catch") {
          const typen = [];
          for (;;) {
            this.lx.leerzeichen(false);
            if (this.zeichen() !== "[") break;
            typen.push(this.typNameLesen());
            this.lx.leerzeichen(false);
            if (this.zeichen() === ",") this.lx.i++;
          }
          faenge.push({ typen: typen, block: this.block("after 'catch'") });
        } else { schluss = this.block("after 'finally'"); break; }
      }
      if (!faenge.length && !schluss) throw this.fehler("The Try statement is missing its Catch or Finally block.", this.lx.i, 1, this.lx.amEnde());
      return { k: "try", block: blk, faenge: faenge, schluss: schluss, start: start, ende: this.lx.i };
    }

    /* ---------- param( … ) ---------- */

    paramBlockFalls() {
      const merk = this.lx.i;
      // [CmdletBinding()] vor param überspringen
      for (;;) {
        this.zeilenUeberspringen();
        if (this.zeichen() === "[") { const m = this.lx.i; const n = this.typNameLesen(); if (!/\(/.test(n)) { this.lx.i = m; break; } continue; }
        break;
      }
      const t = this.blick("befehl");
      if (t.art === "wort" && klein(t.wert) === "param") {
        this.nimm("befehl");
        this.lx.leerzeichen(true);
        this.erwarteSym("(", "Missing '(' in param block.", true);
        return this.paramListe(")");
      }
      this.lx.i = merk;
      return null;
    }

    paramListe(ende) {
      const liste = [];
      for (;;) {
        this.nurZeilen();
        if (this.istSym(this.blick(), ende)) { this.nimm(); return liste; }
        const p = { name: null, typ: null, standard: null, pflicht: false, schalter: false };
        for (;;) {
          this.nurZeilen();
          if (this.zeichen() !== "[") break;
          const inhalt = this.typNameLesen();
          if (/\(/.test(inhalt)) { if (/mandatory/i.test(inhalt) && !/mandatory\s*=\s*\$false/i.test(inhalt)) p.pflicht = true; }
          else { p.typ = inhalt; if (gleichCI(inhalt, "switch")) p.schalter = true; }
        }
        this.nurZeilen();
        const v = this.nimm();
        if (v.art !== "variable") throw this.fehler("Missing variable name in parameter list.", v.start, 1, v.art === "ende");
        p.name = v.wert;
        this.nurZeilen();
        if (this.blick().art === "zuweisung" && this.blick().wert === "=") {
          this.nimm();
          this.nurZeilen();
          p.standard = this.ausdruck(true);
        }
        liste.push(p);
        this.nurZeilen();
        const t = this.nimm();
        if (this.istSym(t, ",")) continue;
        if (this.istSym(t, ende)) return liste;
        throw this.fehler("Missing ')' in function parameter list.", t.start, 1, t.art === "ende");
      }
    }

    // Inhalt von [ … ] roh lesen (Typname oder Attribut), auch verschachtelt wie [string[]]
    typNameLesen() {
      const start = this.lx.i;
      let tiefe = 0, i = this.lx.i;
      for (; i < this.q.length; i++) {
        const c = this.q.charAt(i);
        if (c === "[") tiefe++;
        else if (c === "]") { tiefe--; if (tiefe === 0) break; }
        else if (c === "\n" && tiefe === 1 && !/\(/.test(this.q.slice(start, i))) break;
      }
      if (i >= this.q.length || this.q.charAt(i) !== "]") throw this.fehler("Missing ] at end of attribute or type literal.", start, 1, i >= this.q.length);
      this.lx.i = i + 1;
      return this.q.slice(start + 1, i).trim();
    }

    /* ---------- Pipelines ---------- */

    pipelineSatz() {
      this.lx.leerzeichen(false);
      const start = this.lx.i;
      const erstes = this.pipelineElement(true);
      // Zuweisung?
      if (erstes.k === "ausdruck") {
        this.lx.leerzeichen(false);
        const z = this.blick();
        if (z.art === "zuweisung") {
          if (!["var", "member", "index", "cast"].includes(erstes.ausdruck.k))
            throw this.fehler("The assignment expression is not valid. The input to an assignment operator must be an object that is able to accept assignments, such as a variable or a property.", erstes.start, erstes.ende - erstes.start);
          this.nimm();
          this.nurZeilen();
          const t = this.blick("befehl");
          if (t.art === "ende" || t.art === "nl" || this.istSym(t, ";") || this.istSym(t, "}") || this.istSym(t, ")"))
            throw this.fehler("You must provide a value expression following the '" + z.wert + "' operator.", t.art === "ende" ? this.q.length : t.start, 1, t.art === "ende");
          const wert = this.satz();
          return { k: "zuweisung", ziel: erstes.ausdruck, op: z.wert, wert: wert, start: start, ende: wert.ende };
        }
      }
      const elemente = [erstes];
      for (;;) {
        this.lx.leerzeichen(false);
        let t = this.blick("befehl");
        if (t.art === "nl") {
          // Pipe am Anfang der nächsten Zeile (pwsh 7)
          const merk = this.lx.i;
          this.nurZeilen();
          if (this.zeichen() === "|" && this.lx.zeichen(1) !== "|") t = this.blick("befehl");
          else { this.lx.i = merk; break; }
        }
        if (!this.istSym(t, "|")) break;
        this.nimm("befehl");
        this.nurZeilen();
        const n = this.blick("befehl");
        if (n.art === "ende") throw this.fehler("An empty pipe element is not allowed.", t.start, 1, true);
        if (n.art === "nl" || this.istSym(n, ";") || this.istSym(n, "|") || this.istSym(n, ")") || this.istSym(n, "}"))
          throw this.fehler("An empty pipe element is not allowed.", n.art === "nl" ? t.start : n.start, 1);
        const el = this.pipelineElement(false);
        if (el.k === "ausdruck") throw this.fehler("Expressions are only allowed as the first element of a pipeline.", el.start, el.ende - el.start);
        elemente.push(el);
      }
      let knoten = { k: "pipeline", elemente: elemente, start: start, ende: this.lx.i };
      // Ketten mit && und ||
      for (;;) {
        this.lx.leerzeichen(false);
        const t = this.blick("befehl");
        if (!(this.istSym(t, "&&") || this.istSym(t, "||"))) break;
        this.nimm("befehl");
        this.nurZeilen();
        const rechts = this.pipelineSatz();
        knoten = { k: "kette", links: knoten, op: t.wert, rechts: rechts, start: start, ende: rechts.ende };
      }
      return knoten;
    }

    pipelineElement(erstes) {
      this.lx.leerzeichen(false);
      const start = this.lx.i;
      const c = this.zeichen();
      const t = this.blick("befehl");
      let el;
      const pfadBefehl = /^\.{1,2}[\\/]/.test(this.q.slice(this.lx.i));
      const istBefehl =
        this.istSym(t, "&") ||
        (t.art === "wort" && t.wert === "." && /\s/.test(this.q.charAt(t.ende))) ||
        ((t.art === "wort" || t.art === "xwort") && (!/^[\d.[!+]/.test(c) || pfadBefehl));
      if (istBefehl) el = this.befehl();
      else {
        if (t.art === "ende") throw this.fehler("Unexpected end of input.", this.q.length, 1, true);
        el = { k: "ausdruck", ausdruck: this.ausdruck(false), start: start, umleitungen: [] };
      }
      // Umleitungen nach einem Ausdruck
      if (el.k === "ausdruck") {
        for (;;) {
          this.lx.leerzeichen(false);
          const u = this.blick("befehl");
          if (u.art !== "umleitung") break;
          el.umleitungen.push(this.umleitung());
        }
      }
      el.ende = this.lx.i;
      return el;
    }

    umleitung() {
      const u = this.nimm("befehl");
      if (u.wert.endsWith("&1") || u.wert.endsWith("&2")) return { op: u.wert, ziel: null, start: u.start };
      this.lx.leerzeichen(false);
      const ziel = this.blick("befehl");
      if (ziel.art === "ende" || ziel.art === "nl" || this.istSym(ziel, "|") || this.istSym(ziel, ";"))
        throw this.fehler("Missing file specification after redirection operator.", u.start, u.ende - u.start, ziel.art === "ende");
      return { op: u.wert, ziel: this.befehlsArgument(), start: u.start };
    }

    befehl() {
      const start = this.lx.i;
      let name = null, nameAusdruck = null, aufruf = null;
      const t = this.blick("befehl");
      if (this.istSym(t, "&")) {
        this.nimm("befehl");
        this.lx.leerzeichen(false);
        aufruf = "&";
        nameAusdruck = this.befehlsArgument();
      } else if (t.art === "wort" && t.wert === "." && /\s/.test(this.q.charAt(t.ende))) {
        this.nimm("befehl");
        this.lx.leerzeichen(false);
        aufruf = ".";
        nameAusdruck = this.befehlsArgument();
      } else {
        const n = this.nimm("befehl");
        if (n.art === "xwort") nameAusdruck = { k: "xstring", teile: n.teile, start: n.start, ende: n.ende };
        else name = n.wert;
      }
      const nameEnde = this.lx.i;
      const argumente = [], umleitungen = [];
      for (;;) {
        this.lx.leerzeichen(false);
        const a = this.blick("befehl");
        if (a.art === "ende" || a.art === "nl" || this.istSym(a, ";") || this.istSym(a, "|") || this.istSym(a, ")") || this.istSym(a, "}") ||
            this.istSym(a, "&&") || this.istSym(a, "||")) break;
        if (a.art === "umleitung") { umleitungen.push(this.umleitung()); continue; }
        if (a.art === "parameter") {
          this.nimm("befehl");
          const arg = { art: "param", name: a.wert, start: a.start, ende: a.ende, doppelpunkt: a.doppelpunkt };
          if (a.doppelpunkt) { arg.wert = this.befehlsArgument(); arg.ende = this.lx.i; }
          argumente.push(arg);
          continue;
        }
        if (this.istSym(a, "&")) throw this.fehler("The ampersand (&) character is not allowed. The & operator is reserved for future use; wrap an ampersand in double quotation marks (\"&\") to pass it as part of a string.", a.start, 1);
        const wert = this.befehlsArgumentListe();
        argumente.push({ art: "wert", wert: wert, start: wert.start, ende: wert.ende });
      }
      return { k: "befehl", name: name, nameAusdruck: nameAusdruck, aufruf: aufruf, argumente: argumente, umleitungen: umleitungen,
        start: start, nameEnde: nameEnde, ende: this.lx.i };
    }

    befehlsArgumentListe() {
      const erstes = this.befehlsArgument();
      this.lx.leerzeichen(false);
      if (this.zeichen() !== ",") return erstes;
      const elemente = [erstes];
      while (this.zeichen() === ",") {
        this.lx.i++;
        this.lx.leerzeichen(true);
        elemente.push(this.befehlsArgument());
        this.lx.leerzeichen(false);
      }
      return { k: "array", elemente: elemente, start: erstes.start, ende: this.lx.i };
    }

    // Ein Argument im Befehlsmodus: Wort, Zahl, String, Variable, ( … ), { … }, @( … ), …
    befehlsArgument() {
      this.lx.leerzeichen(false);
      const t = this.nimm("befehl");
      let e;
      switch (t.art) {
        case "zahl": e = { k: "zahl", wert: t.wert, start: t.start, ende: t.ende }; return e;
        case "wort": e = { k: "wort", wert: t.wert, start: t.start, ende: t.ende }; return e;
        case "xwort": e = { k: "xstring", teile: t.teile, start: t.start, ende: t.ende }; return e;
        case "string": e = { k: "string", wert: t.wert, start: t.start, ende: t.ende }; break;
        case "xstring": e = { k: "xstring", teile: t.teile, start: t.start, ende: t.ende }; break;
        case "variable": {
          // $ordner\datei.txt ist im Befehlsmodus ein einziges Argument mit Einsetzen
          const nx = this.q.charAt(t.ende);
          if (nx && !/[\s;|&(){},<>.[\]:]/.test(nx)) {
            this.lx.i = t.start;
            const w = this.lx.befehlsToken();
            return w.art === "xwort" ? { k: "xstring", teile: w.teile, start: w.start, ende: w.ende } : { k: "wort", wert: w.wert, start: w.start, ende: w.ende };
          }
          e = { k: "var", name: t.wert, bereich: t.bereich, start: t.start, ende: t.ende };
          break;
        }
        case "parameter": e = { k: "wort", wert: "-" + t.wert + (t.doppelpunkt ? ":" : ""), start: t.start, ende: t.ende }; return e;
        case "sym":
          if (["(", "$(", "@(", "@{", "{"].includes(t.wert)) { this.lx.i = t.start; e = this.primaer(); break; }
          throw this.unerwartet(t);
        default: throw this.unerwartet(t);
      }
      return this.postfix(e);
    }

    /* ---------- Ausdrücke ---------- */

    // ohneKomma: innerhalb von Methodenargumenten trennt das Komma Argumente
    ausdruck(ohneKomma) {
      const start = this.lx.i;
      const bed = this.binaer(1, ohneKomma);
      this.lx.leerzeichen(false);
      let t = this.blick();
      if (t.art === "operator" && t.wert === "??") {
        this.nimm();
        this.nurZeilen();
        const rechts = this.ausdruck(ohneKomma);
        return { k: "binaer", op: "??", links: bed, rechts: rechts, start: start, ende: rechts.ende };
      }
      if (this.istSym(t, "?") && /\s/.test(this.q.charAt(t.ende))) {
        this.nimm();
        this.nurZeilen();
        const ja = this.ausdruck(ohneKomma);
        this.nurZeilen();
        this.erwarteSym(":", "Missing ':' in ternary expression.", this.lx.amEnde());
        this.nurZeilen();
        const nein = this.ausdruck(ohneKomma);
        return { k: "ternaer", bed: bed, ja: ja, nein: nein, start: start, ende: nein.ende };
      }
      return bed;
    }

    binaer(minVorrang, ohneKomma) {
      let links = this.unaer(ohneKomma);
      for (;;) {
        this.lx.leerzeichen(false);
        const t = this.blick();
        if (t.art !== "operator") break;
        const op = t.wert;
        const v = vorrang(op);
        if (!v || v < minVorrang) break;
        this.nimm();
        this.nurZeilen();
        const n = this.blick();
        if (n.art === "ende" || n.art === "nl" || this.istSym(n, ")") || this.istSym(n, "}") || this.istSym(n, ";") || this.istSym(n, "|"))
          throw this.fehler("You must provide a value expression following the '" + op + "' operator.", n.art === "ende" ? this.q.length : t.ende, 1, n.art === "ende");
        const rechts = this.binaer(v + 1, ohneKomma);
        links = { k: "binaer", op: op, links: links, rechts: rechts, start: links.start, ende: rechts.ende };
      }
      return links;
    }

    unaer(ohneKomma) {
      this.lx.leerzeichen(false);
      const t = this.blick();
      if (this.istSym(t, ",")) {
        this.nimm();
        const operand = this.unaer(true);
        return { k: "array", elemente: [operand], start: t.start, ende: operand.ende };
      }
      if (t.art === "operator" && ["-not", "!", "-", "+", "-bnot", "-split", "-join", "++", "--"].includes(t.wert)) {
        this.nimm();
        this.lx.leerzeichen(false);
        const n = this.blick();
        if (n.art === "ende" || n.art === "nl" || this.istSym(n, ")"))
          throw this.fehler("Missing expression after unary operator '" + t.wert + "'.", n.art === "ende" ? this.q.length : n.start, 1, n.art === "ende");
        if (t.wert === "++" || t.wert === "--") {
          const ziel = this.unaer(ohneKomma);
          return { k: "inkrement", op: t.wert, ziel: ziel, praefix: true, start: t.start, ende: ziel.ende };
        }
        const operand = t.wert === "-" || t.wert === "+" ? this.binaer(6, ohneKomma) : this.unaer(ohneKomma);
        return { k: "unaer", op: t.wert, operand: operand, start: t.start, ende: operand.ende };
      }
      return this.komma(ohneKomma);
    }

    komma(ohneKomma) {
      const erstes = this.cast();
      if (ohneKomma) return erstes;
      this.lx.leerzeichen(false);
      if (!this.istSym(this.blick(), ",")) return erstes;
      const elemente = [erstes];
      while (this.istSym(this.blick(), ",")) {
        this.nimm();
        this.nurZeilen();
        elemente.push(this.cast());
        this.lx.leerzeichen(false);
      }
      return { k: "array", elemente: elemente, start: erstes.start, ende: elemente[elemente.length - 1].ende };
    }

    cast() {
      this.lx.leerzeichen(false);
      if (this.zeichen() === "[") {
        const start = this.lx.i;
        const name = this.typNameLesen();
        if (this.zeichen() === ":" && this.lx.zeichen(1) === ":") {
          return this.postfix({ k: "typ", name: name, start: start, ende: this.lx.i });
        }
        this.lx.leerzeichen(false);
        const n = this.blick();
        const endet = n.art === "ende" || n.art === "nl" || n.art === "operator" && !["-", "!", "-not", "+"].includes(n.wert) ||
          this.istSym(n, ")") || this.istSym(n, "}") || this.istSym(n, ";") || this.istSym(n, "|") || this.istSym(n, ",") || this.istSym(n, "]") || n.art === "zuweisung";
        if (endet) return { k: "typ", name: name, start: start, ende: this.lx.i };
        const operand = gleichCI(name, "ordered") ? this.primaerMitPostfix() : this.unaerOhneKomma();
        return { k: "cast", typ: name, operand: operand, start: start, ende: operand.ende };
      }
      return this.primaerMitPostfix();
    }
    unaerOhneKomma() {
      this.lx.leerzeichen(false);
      const t = this.blick();
      if (t.art === "operator" && ["-not", "!", "-"].includes(t.wert)) return this.unaer(true);
      return this.cast();
    }

    primaerMitPostfix() { return this.postfix(this.primaer()); }

    primaer() {
      this.lx.leerzeichen(false);
      const t = this.nimm("ausdruck");
      switch (t.art) {
        case "zahl": return { k: "zahl", wert: t.wert, start: t.start, ende: t.ende };
        case "string": return { k: "string", wert: t.wert, start: t.start, ende: t.ende };
        case "xstring": return { k: "xstring", teile: t.teile, start: t.start, ende: t.ende };
        case "variable": return { k: "var", name: t.wert, bereich: t.bereich, start: t.start, ende: t.ende };
        case "sym":
          switch (t.wert) {
            case "(": {
              this.nurZeilen();
              if (this.istSym(this.blick(), ")")) throw this.fehler("An expression was expected after '('.", this.lx.i, 1);
              const inner = this.satz();
              this.nurZeilen();
              this.erwarteSym(")", "Missing closing ')' in expression.", this.lx.amEnde());
              return { k: "klammer", inhalt: inner, start: t.start, ende: this.lx.i };
            }
            case "$(": case "@(": {
              const s = this.saetze(")");
              this.nimm();
              return { k: t.wert === "$(" ? "subausdruck" : "arrayausdruck", saetze: s, start: t.start, ende: this.lx.i };
            }
            case "@{": return this.hashLiteral(t.start);
            case "{": { this.lx.i = t.start; const sb = this.skriptblockLiteral(); return { k: "skriptblock", wert: sb, start: t.start, ende: this.lx.i }; }
            default: throw this.unerwartet(t);
          }
        default: throw this.unerwartet(t);
      }
    }

    // Anhängsel: .Name, .Methode(…), ::Statisch, [Index], ++, --
    postfix(e) {
      for (;;) {
        const c = this.zeichen(), n = this.lx.zeichen(1);
        if (c === "." && n !== "." && (NAME_ZEICHEN.test(n) || n === "$" || enthaelt(DOPPELTE_ANFZ, n) || enthaelt(EINFACHE_ANFZ, n))) {
          this.lx.i++;
          e = this.member(e, false);
          continue;
        }
        if (c === "?" && n === "." && NAME_ZEICHEN.test(this.lx.zeichen(2))) { this.lx.i += 2; e = this.member(e, false, true); continue; }
        if (c === ":" && n === ":") { this.lx.i += 2; e = this.member(e, true); continue; }
        if (c === "[") {
          this.lx.i++;
          this.nurZeilen();
          if (this.zeichen() === "]") throw this.fehler("Array index expression is missing or not valid.", this.lx.i, 1);
          const index = this.ausdruck(false);
          this.nurZeilen();
          this.erwarteSym("]", "Missing ']' after array index expression.", this.lx.amEnde());
          e = { k: "index", objekt: e, index: index, start: e.start, ende: this.lx.i };
          continue;
        }
        if ((c === "+" && n === "+") || (c === "-" && n === "-")) {
          if (["var", "member", "index"].includes(e.k)) {
            this.lx.i += 2;
            e = { k: "inkrement", op: c + n, ziel: e, praefix: false, start: e.start, ende: this.lx.i };
            continue;
          }
        }
        return e;
      }
    }

    member(objekt, statisch, nullBedingt) {
      let name;
      const c = this.zeichen();
      if (c === "$" ) { const v = this.nimm(); name = { k: "var", name: v.wert, bereich: v.bereich, start: v.start, ende: v.ende }; }
      else if (enthaelt(DOPPELTE_ANFZ, c) || enthaelt(EINFACHE_ANFZ, c)) { const s = this.nimm(); name = s.art === "string" ? s.wert : { k: "xstring", teile: s.teile, start: s.start, ende: s.ende }; }
      else {
        let j = this.lx.i;
        while (NAME_ZEICHEN.test(this.q.charAt(j))) j++;
        name = this.q.slice(this.lx.i, j);
        this.lx.i = j;
      }
      let argumente = null;
      if (this.zeichen() === "(") {
        this.lx.i++;
        argumente = [];
        this.nurZeilen();
        if (this.zeichen() === ")") this.lx.i++;
        else {
          for (;;) {
            this.nurZeilen();
            argumente.push(this.ausdruck(true));
            this.nurZeilen();
            const t = this.nimm();
            if (this.istSym(t, ",")) continue;
            if (this.istSym(t, ")")) break;
            throw this.fehler("Missing ')' in method call.", t.art === "ende" ? this.q.length : t.start, 1, t.art === "ende");
          }
        }
      }
      return { k: "member", objekt: objekt, name: name, statisch: statisch, argumente: argumente, nullBedingt: !!nullBedingt, start: objekt.start, ende: this.lx.i };
    }

    hashLiteral(start) {
      const eintraege = [];
      for (;;) {
        this.zeilenUeberspringen();
        const t = this.blick("befehl");
        if (this.istSym(t, "}")) { this.nimm(); break; }
        if (t.art === "ende") throw this.fehler("Missing closing '}' in statement block or type definition.", this.q.length, 1, true);
        let schluessel;
        const a = this.blick("ausdruck");
        if (a.art === "wort") { this.nimm("ausdruck"); schluessel = { k: "string", wert: a.wert }; }
        else if (a.art === "zahl") { this.nimm("ausdruck"); schluessel = { k: "zahl", wert: a.wert }; }
        else schluessel = this.primaerMitPostfix();
        this.lx.leerzeichen(false);
        const gl = this.nimm();
        if (!(gl.art === "zuweisung" && gl.wert === "=")) throw this.fehler("Missing '=' operator after key in hash literal.", gl.art === "ende" ? this.q.length : gl.start, 1, gl.art === "ende");
        this.nurZeilen();
        const wert = this.satz();
        eintraege.push({ schluessel: schluessel, wert: wert });
        this.lx.leerzeichen(false);
        const s = this.blick("befehl");
        if (!(s.art === "nl" || this.istSym(s, ";") || this.istSym(s, "}") || s.art === "ende"))
          throw this.fehler("Missing statement after '=' in hash literal.", s.start, 1);
      }
      return { k: "hash", eintraege: eintraege, start: start, ende: this.lx.i };
    }

    // { param(…) begin {…} process {…} end {…} Anweisungen }
    skriptblockLiteral() {
      const auf = this.nimm();
      const innenStart = this.lx.i;
      this.zeilenUeberspringen();
      const param = this.paramBlockFalls();
      const knoten = { k: "skript", param: param, saetze: null, begin: null, process: null, end: null, start: innenStart };
      this.zeilenUeberspringen();
      const t = this.blick("befehl");
      if (t.art === "wort" && ["begin", "process", "end"].includes(klein(t.wert)) && /^\s*\{/.test(this.q.slice(t.ende))) {
        for (;;) {
          this.zeilenUeberspringen();
          const b = this.blick("befehl");
          if (this.istSym(b, "}")) break;
          if (!(b.art === "wort" && ["begin", "process", "end"].includes(klein(b.wert)))) throw this.unerwartet(b);
          this.nimm("befehl");
          knoten[klein(b.wert)] = this.block("after '" + b.wert + "'").saetze;
        }
        knoten.saetze = knoten.end || [];
      } else {
        knoten.saetze = this.saetze("}", auf.start);
      }
      const zu = this.nimm();
      if (!this.istSym(zu, "}")) throw this.fehler("Missing closing '}' in statement block or type definition.", auf.start, 1, true);
      knoten.ende = zu.start;
      knoten.text = this.q.slice(innenStart, zu.start);
      return new Skriptblock(knoten, knoten.text);
    }
  }

  function parsen(text) {
    return new Parser(text).skript();
  }

  /* ======================================================================
     6. Auswertung
     Interpreter führt den Syntaxbaum aus. Ausgaben einer Eingabezeile landen im «strom»:
       { art: "objekt", wert }      Objekt für Out-Default (wird formatiert)
       { art: "host", text, farbe } Write-Host
       { art: "fehler", datensatz } Fehler (rot)
       { art: "warnung", text }     WARNING: …
       { art: "hinweis", text }     Hinweis des Simulators (deutsch)
       { art: "rueckfrage", text, antwort }
       { art: "leeren" }            Clear-Host
     ====================================================================== */

  const MAX_SCHRITTE = 200000; // Schutz vor Endlosschleifen
  const MAX_TIEFE = 100;       // Schutz vor endloser Rekursion
  const NUR_LESEN = ["true", "false", "null", "home", "pid", "psversiontable", "error", "pwd", "host", "pshome", "iswindows", "islinux", "ismacos", "iscoreclr", "psculture", "psuiculture", "?"];

  class Bereich {
    constructor(eltern, art) { this.vars = new Map(); this.eltern = eltern; this.art = art || "lokal"; }
  }

  function fehlerAus(o) { return new FehlerDatensatz(o); }
  function abbruch(o, umfang) { return new AbbruchFehler(fehlerAus(o), umfang); }
  const ungueltig = (meldung, extra) => abbruch(Object.assign({ meldung: meldung, art: "InvalidOperation", kategorie: "InvalidOperation" }, extra || {}));

  class Interpreter {
    constructor(welt) {
      this.welt = welt;
      this.global = new Bereich(null, "global");
      this.funktionen = new Map();
      this.verlauf = [];
      this.fehlerListe = [];
      this.orte = { C: Welt.teileVon(welt.home), ENV: [], HKCU: [] };
      this.laufwerk = "C";
      this.strom = [];
      this.antworten = [];
      this.alleJa = false;
      this.alleNein = false;
      this.quellen = [];        // Stapel: { text, datei } der gerade laufenden Quelle
      this.tryTiefe = 0;
      this.tiefe = 0;
      this.schritte = 0;
      this.letzterErfolg = true;
      this.fehlerUmleitung = []; // Stapel: "host", "verwerfen" oder ein Array (2>&1)
      this.befehleDerZeile = [];
      this.globaleVariablen();
    }

    globaleVariablen() {
      const g = this.global.vars;
      const setze = (n, w) => g.set(klein(n), { name: n, wert: w, typ: null });
      setze("HOME", this.welt.home);
      setze("PID", 9120);
      setze("PSHOME", "C:\\Program Files\\PowerShell\\7");
      setze("IsWindows", true); setze("IsLinux", false); setze("IsMacOS", false); setze("IsCoreCLR", true);
      setze("PSCulture", "de-CH"); setze("PSUICulture", "en-US");
      setze("ErrorActionPreference", "Continue");
      setze("WarningPreference", "Continue");
      setze("ConfirmPreference", "High");
      setze("WhatIfPreference", false);
      setze("FormatEnumerationLimit", 4);
      setze("OFS", " ");
      setze("MaximumHistoryCount", 4096);
      const v = new PSHashtable(true);
      [["PSVersion", "7.6.1"], ["PSEdition", "Core"], ["GitCommitId", "7.6.1"], ["OS", "Microsoft Windows 10.0.26100"], ["Platform", "Win32NT"],
        ["PSCompatibleVersions", ["1.0", "2.0", "3.0", "4.0", "5.0", "5.1", "6.0", "7.0"]], ["PSRemotingProtocolVersion", "2.4"],
        ["SerializationVersion", "1.1.0.1"], ["WSManStackVersion", "3.0"]].forEach(([k, w]) => v.setzen(k, w));
      v._version = true;
      setze("PSVersionTable", v);
    }

    /* ---------- Ort (aktuelles Verzeichnis) ---------- */

    ortText(laufwerk, teile) {
      laufwerk = laufwerk || this.laufwerk;
      teile = teile || this.orte[laufwerk];
      if (laufwerk === "C") return "C:\\" + teile.join("\\");
      return (laufwerk === "ENV" ? "Env" : laufwerk) + ":\\" + teile.join("\\");
    }
    get ort() { return this.ortText(); }

    // Pfadtext → { laufwerk, teile } (ohne Platzhalter-Auflösung)
    pfadAufloesen(text) {
      let p = String(text === null || text === undefined ? "" : text).trim().replace(/\//g, "\\");
      p = p.replace(/^Microsoft\.PowerShell\.Core\\(FileSystem|Environment|Registry)::/i, "");
      p = p.replace(/^HKEY_CURRENT_USER/i, "HKCU:");
      let laufwerk = this.laufwerk, basis = this.orte[this.laufwerk];
      const m = /^([A-Za-z][A-Za-z0-9]*):(.*)$/.exec(p);
      if (m) {
        const lw = klein(m[1]) === "c" ? "C" : klein(m[1]) === "env" ? "ENV" : klein(m[1]) === "hkcu" ? "HKCU" : null;
        if (!lw) {
          throw abbruch({
            meldung: "Cannot find drive. A drive with the name '" + m[1] + "' does not exist.", kategorie: "ObjectNotFound",
            ausnahme: "System.Management.Automation.DriveNotFoundException", id: "DriveNotFound", ziel: m[1],
          });
        }
        laufwerk = lw;
        p = m[2];
        basis = p.startsWith("\\") ? [] : this.orte[lw];
      } else if (p === "~" || p.startsWith("~\\")) {
        laufwerk = "C";
        basis = Welt.teileVon(this.welt.home);
        p = p.slice(1);
      } else if (p.startsWith("\\")) basis = [];
      const teile = basis.slice();
      p.split("\\").forEach((t) => {
        if (t === "" || t === ".") return;
        if (t === "..") { teile.pop(); return; }
        teile.push(t);
      });
      return { laufwerk: laufwerk, teile: teile };
    }

    /* ---------- Variablen ---------- */

    varEintrag(name, bereich, ber, anlegen) {
      const k = klein(name === "PSItem" || klein(name) === "psitem" ? "_" : name);
      if (bereich === "global") ber = this.global;
      else if (bereich === "script") { let b = ber; while (b && b.art !== "skript" && b.eltern) b = b.eltern; ber = b || this.global; }
      if (bereich === "local" || bereich === "private" || anlegen) {
        if (ber.vars.has(k)) return ber.vars.get(k);
        if (!anlegen) return null;
        if (bereich !== "local" && bereich !== "private") {
          // Zuweisung: bestehende Variable im eigenen Bereich, sonst neu anlegen (wie PowerShell)
        }
        const e = { name: name, wert: null, typ: null };
        ber.vars.set(k, e);
        return e;
      }
      for (let b = ber; b; b = b.eltern) if (b.vars.has(k)) return b.vars.get(k);
      return null;
    }

    varHolen(name, bereich, ber) {
      const k = klein(name);
      if (bereich === "env") return this.welt.envHolen(name);
      switch (k) {
        case "true": return true;
        case "false": return false;
        case "null": return null;
        case "error": return this.fehlerListe;
        case "pwd": return this.pfadInfo();
        case "?": return this.vorherErfolg === undefined ? true : this.vorherErfolg;
        case "host": return neuesObjekt([["Name", "ConsoleHost"], ["Version", "7.6.1"], ["CurrentCulture", "de-CH"], ["CurrentUICulture", "en-US"]], "System.Management.Automation.Internal.Host.InternalHost");
        default: break;
      }
      const e = this.varEintrag(name, bereich, ber, false);
      return e ? e.wert : null;
    }

    varSetzen(name, wert, bereich, ber) {
      const k = klein(name);
      if (bereich === "env") { this.welt.envSetzen(name, wert === null ? null : textVon(wert)); return; }
      if (NUR_LESEN.includes(k)) {
        throw abbruch({ meldung: "Cannot overwrite variable " + name + " because it is read-only or constant.", art: "WriteError", kategorie: "WriteError",
          ausnahme: "System.Management.Automation.SessionStateUnauthorizedAccessException", id: "VariableNotWritable" });
      }
      const e = this.varEintrag(name, bereich, ber, true);
      e.wert = e.typ ? konvertieren(wert, e.typ) : wert;
    }

    pfadInfo() {
      const lw = this.laufwerk;
      return new PSObjekt(["System.Management.Automation.PathInfo"], [
        ["Drive", lw === "ENV" ? "Env" : lw], ["Provider", lw === "C" ? "Microsoft.PowerShell.Core\\FileSystem" : lw === "ENV" ? "Microsoft.PowerShell.Core\\Environment" : "Microsoft.PowerShell.Core\\Registry"],
        ["ProviderPath", lw === "HKCU" ? "HKEY_CURRENT_USER" + (this.orte.HKCU.length ? "\\" + this.orte.HKCU.join("\\") : "") : this.ort], ["Path", this.ort],
      ], { Drive: "Property", Provider: "Property", ProviderPath: "Property", Path: "Property" });
    }

    /* ---------- Ausgabe und Fehler ---------- */

    hostSchreiben(text, farbe) { this.strom.push({ art: "host", text: text, farbe: farbe || null }); }
    hinweis(text) { this.strom.push({ art: "hinweis", text: text }); }
    warnung(text) { this.strom.push({ art: "warnung", text: text }); }

    aktuelleQuelle() { return this.quellen[this.quellen.length - 1] || { text: "", datei: null }; }
    posVon(knoten) {
      if (!knoten) return null;
      const q = this.aktuelleQuelle();
      return { quelle: q.text, datei: q.datei, start: knoten.start, ende: knoten.ende };
    }

    // Fehler melden: in $Error eintragen und anzeigen (oder umleiten)
    fehlerMelden(ds, nichtAnzeigen) {
      this.fehlerListe.unshift(ds);
      this.letzterErfolg = false;
      if (nichtAnzeigen) return;
      const ziel = this.fehlerUmleitung[this.fehlerUmleitung.length - 1] || "host";
      if (ziel === "verwerfen") return;
      if (Array.isArray(ziel)) { ziel.push(ds); return; }
      this.strom.push({ art: "fehler", datensatz: ds });
    }

    // Rückfrage (-Confirm, Ordner mit Inhalt). Ohne vorbereitete Antwort hält die Zeile an.
    rueckfrage(text) {
      if (this.alleJa) return true;
      if (this.alleNein) return false;
      if (!this.antworten.length) throw new Rueckfrage(text);
      const roh = String(this.antworten.shift() || "").trim();
      const a = klein(roh || "y");
      this.strom.push({ art: "rueckfrage", text: text, antwort: roh });
      if (a === "a") { this.alleJa = true; return true; }
      if (a === "l") { this.alleNein = true; return false; }
      return a === "y";
    }

    zaehlen() {
      if (++this.schritte > MAX_SCHRITTE) {
        throw abbruch({ meldung: "Die Ausführung wurde nach " + MAX_SCHRITTE + " Schritten abgebrochen (Endlosschleife?).", art: "Simulator" }, "skript");
      }
    }

    /* ---------- Anweisungen ---------- */

    saetzeAusfuehren(saetze, ber, aus) {
      for (const s of saetze) {
        try {
          this.satzAusfuehren(s, ber, aus);
        } catch (e) {
          if (e instanceof AbbruchFehler && e.umfang === "anweisung" && this.tryTiefe === 0) {
            if (!e.datensatz.pos) e.datensatz.pos = this.posVon(s);
            this.fehlerMelden(e.datensatz);
            continue;
          }
          if (e instanceof AbbruchFehler && !e.datensatz.pos) e.datensatz.pos = this.posVon(s);
          throw e;
        }
      }
    }

    satzAusfuehren(s, ber, aus) {
      this.zaehlen();
      switch (s.k) {
        case "pipeline": return this.pipelineAusfuehren(s, ber, aus);
        case "zuweisung": return this.zuweisen(s, ber);
        case "kette": {
          this.satzAusfuehren(s.links, ber, aus);
          const ok = this.letzterErfolg;
          if ((s.op === "&&" && ok) || (s.op === "||" && !ok)) this.satzAusfuehren(s.rechts, ber, aus);
          return;
        }
        case "if": {
          for (const z of s.zweige) {
            if (alsBool(this.satzWert(z.bed, ber))) return this.saetzeAusfuehren(z.block.saetze, ber, aus);
          }
          if (s.sonst) this.saetzeAusfuehren(s.sonst.saetze, ber, aus);
          return;
        }
        case "switch": return this.switchAusfuehren(s, ber, aus);
        case "foreach": {
          const liste = alsListe(this.satzWert(s.sammlung, ber));
          for (const x of liste) {
            this.zaehlen();
            this.varSetzen(s.var, x, null, ber);
            const sig = this.schleifenRumpf(s.block, ber, aus);
            if (sig === "break") break;
          }
          return;
        }
        case "for": {
          if (s.init) this.satzAusfuehren(s.init, ber, []);
          for (;;) {
            this.zaehlen();
            if (s.bed && !alsBool(this.satzWert(s.bed, ber))) break;
            const sig = this.schleifenRumpf(s.block, ber, aus);
            if (sig === "break") break;
            if (s.schritt) this.satzAusfuehren(s.schritt, ber, []);
          }
          return;
        }
        case "while": {
          while (alsBool(this.satzWert(s.bed, ber))) {
            this.zaehlen();
            if (this.schleifenRumpf(s.block, ber, aus) === "break") break;
          }
          return;
        }
        case "do": {
          for (;;) {
            this.zaehlen();
            if (this.schleifenRumpf(s.block, ber, aus) === "break") break;
            const b = alsBool(this.satzWert(s.bed, ber));
            if (s.bis ? b : !b) break;
          }
          return;
        }
        case "funktion": {
          const sb = s.koerper;
          sb.quelle = this.aktuelleQuelle();
          this.funktionen.set(klein(s.name), { name: s.name, sb: sb });
          return;
        }
        case "try": return this.tryAusfuehren(s, ber, aus);
        case "throw": {
          let wert = s.wert ? this.satzWert(s.wert, ber) : null;
          if (wert === null && !s.wert) {
            const akt = this.varHolen("_", null, ber);
            if (akt instanceof FehlerDatensatz) throw new AbbruchFehler(akt, "skript");
            wert = "ScriptHalted";
          }
          if (wert instanceof FehlerDatensatz) throw new AbbruchFehler(wert, "skript");
          throw abbruch({ meldung: textVon(wert), art: "Exception", kategorie: "OperationStopped", ausnahme: "System.Management.Automation.RuntimeException",
            ziel: wert, id: textVon(wert), pos: this.posVon(s) }, "skript");
        }
        case "return": {
          if (s.wert) this.satzAusfuehren(s.wert, ber, aus);
          throw new SteuerSignal("return");
        }
        case "break": throw new SteuerSignal("break");
        case "continue": throw new SteuerSignal("continue");
        case "exit": throw new SteuerSignal("exit", s.wert ? this.satzWert(s.wert, ber) : 0);
        default: throw ungueltig("Unbekannte Anweisung " + s.k);
      }
    }

    schleifenRumpf(block, ber, aus) {
      try {
        this.saetzeAusfuehren(block.saetze, ber, aus);
      } catch (e) {
        if (e instanceof SteuerSignal && (e.art === "break" || e.art === "continue")) return e.art;
        throw e;
      }
      return null;
    }

    // Wert einer Anweisung (Bedingung, rechte Seite): Ausgaben sammeln
    satzWert(s, ber) {
      const aus = [];
      this.satzAusfuehren(s, ber, aus);
      return ausgabeWert(aus);
    }

    switchAusfuehren(s, ber, aus) {
      const o = s.optionen;
      const werte = alsListe(this.satzWert(s.wert, ber));
      const passtFall = (x, f) => {
        if (f.test.k === "skriptblock") return alsBool(this.skriptblockWert(f.test.wert, ber, { dollarUnter: x }));
        const t = this.auswerten(f.test, ber);
        if (o.wildcard) return platzhalterRegex(textVon(t)).test(textVon(x)) && (!o.casesensitive || new RegExp(platzhalterRegex(textVon(t)).source).test(textVon(x)));
        if (o.regex) {
          const m = new RegExp(textVon(t), o.casesensitive ? "" : "i").exec(textVon(x));
          if (m) this.varSetzen("Matches", trefferTabelle(m), null, ber);
          return !!m;
        }
        return gleich(x, t, !!o.casesensitive);
      };
      const alt = this.varEintrag("_", null, ber, false);
      const altWert = alt ? alt.wert : null;
      try {
        for (const x of werte) {
          this.varSetzen("_", x, "local", ber);
          let getroffen = false;
          let abbrechen = false;
          for (const f of s.faelle) {
            if (!passtFall(x, f)) continue;
            getroffen = true;
            const sig = this.schleifenRumpf(f.block, ber, aus);
            if (sig === "break") { abbrechen = true; break; }
            if (sig === "continue") break;
          }
          if (abbrechen) break;
          if (!getroffen && s.standard) {
            if (this.schleifenRumpf(s.standard, ber, aus) === "break") break;
          }
        }
      } finally {
        this.varSetzen("_", altWert, "local", ber);
      }
    }

    tryAusfuehren(s, ber, aus) {
      try {
        this.tryTiefe++;
        try {
          this.saetzeAusfuehren(s.block.saetze, ber, aus);
        } finally {
          this.tryTiefe--;
        }
      } catch (e) {
        if (!(e instanceof AbbruchFehler) || e.datensatz.art === "Simulator") { this.schlussAusfuehren(s, ber, aus); throw e; }
        const ds = e.datensatz;
        const fang = s.faenge.find((f) => !f.typen.length || f.typen.some((t) => ausnahmePasst(ds, t)));
        if (!fang) { this.schlussAusfuehren(s, ber, aus); throw e; }
        this.fehlerListe.unshift(ds);
        const alt = this.varEintrag("_", null, ber, false);
        const altWert = alt ? alt.wert : null;
        try {
          this.varSetzen("_", ds, "local", ber);
          this.saetzeAusfuehren(fang.block.saetze, ber, aus);
        } finally {
          this.varSetzen("_", altWert, "local", ber);
          this.schlussAusfuehren(s, ber, aus);
        }
        return;
      }
      this.schlussAusfuehren(s, ber, aus);
    }
    schlussAusfuehren(s, ber, aus) {
      if (s.schluss && !s._schlussLaeuft) {
        s._schlussLaeuft = true;
        try { this.saetzeAusfuehren(s.schluss.saetze, ber, aus); } finally { s._schlussLaeuft = false; }
      }
    }

    /* ---------- Zuweisung ---------- */

    zuweisen(s, ber) {
      let wert;
      const w = s.wert;
      if (w.k === "pipeline" && w.elemente.length === 1 && w.elemente[0].k === "ausdruck" && !(w.elemente[0].umleitungen || []).length) {
        // Reiner Ausdruck: Wert direkt übernehmen (Arrays bleiben Arrays, auch mit einem Element)
        this.letzterErfolg = true;
        wert = this.auswerten(w.elemente[0].ausdruck, ber);
      } else {
        wert = this.satzWert(w, ber); // Befehle: Ausgabe sammeln (nichts → $null, eins → Objekt, mehrere → Array)
      }
      const ziel = s.ziel;
      if (s.op !== "=") {
        const alt = this.auswerten(ziel.k === "cast" ? ziel.operand : ziel, ber);
        if (s.op === "??=") { if (alt !== null) return; }
        else wert = this.binaerOp(s.op.charAt(0), alt, wert, s);
      }
      this.zuweisenAn(ziel, wert, ber);
    }

    zuweisenAn(ziel, wert, ber) {
      switch (ziel.k) {
        case "var": return this.varSetzen(ziel.name, wert, ziel.bereich, ber);
        case "cast": {
          if (ziel.operand.k !== "var") throw ungueltig("The assignment expression is not valid.");
          const t = typSuchen(ziel.typ);
          const e = this.varEintrag(ziel.operand.name, ziel.operand.bereich, ber, true);
          e.typ = t;
          e.wert = konvertieren(wert, t);
          return;
        }
        case "member": {
          const obj = this.auswerten(ziel.objekt, ber);
          const name = typeof ziel.name === "string" ? ziel.name : textVon(this.auswerten(ziel.name, ber));
          return memberSetzen(obj, name, wert);
        }
        case "index": {
          const obj = this.auswerten(ziel.objekt, ber);
          const index = this.auswerten(ziel.index, ber);
          if (obj instanceof PSHashtable) { obj.setzen(index, wert); return; }
          if (Array.isArray(obj)) {
            let i = zahlWert(nachZahl(index));
            if (i < 0) i += obj.length;
            if (i < 0 || i >= obj.length) throw abbruch({ meldung: "Index was outside the bounds of the array.", art: "IndexOutOfRangeException", kategorie: "OperationStopped", ausnahme: "System.IndexOutOfRangeException" });
            obj[i] = wert;
            return;
          }
          if (obj === null) throw ungueltig("Cannot index into a null array.");
          throw ungueltig("Unable to index into an object of type " + typNameVon(obj) + ".");
        }
        default: throw ungueltig("The assignment expression is not valid.");
      }
    }

    /* ---------- Pipeline ---------- */

    pipelineAusfuehren(p, ber, aus) {
      this.vorherErfolg = this.letzterErfolg; // für $?
      this.letzterErfolg = true;
      let eingabe = null;
      // Ein einzelner Befehl schreibt direkt in die Ausgabe (richtige Reihenfolge mit Fehlern, auch bei Abbruch)
      const direkt = p.elemente.length === 1 && !(p.elemente[0].umleitungen || []).length;
      for (let i = 0; i < p.elemente.length; i++) {
        const el = p.elemente[i];
        const ziel = direkt ? aus : [];
        const umleitungen = el.umleitungen || [];
        const fehlerZiel = umleitungen.find((u) => /^[2*]>/.test(u.op));
        let gesammelteFehler = null;
        if (fehlerZiel) {
          if (fehlerZiel.op.endsWith("&1")) { gesammelteFehler = []; this.fehlerUmleitung.push(gesammelteFehler); }
          else this.fehlerUmleitung.push("verwerfen");
        }
        try {
          if (el.k === "ausdruck" && p.elemente.length === 1 && el.ausdruck.k === "inkrement" && !umleitungen.length) {
            this.auswerten(el.ausdruck, ber); // $i++ als Anweisung gibt nichts aus
          } else if (el.k === "ausdruck") {
            const v = this.auswerten(el.ausdruck, ber);
            if (Array.isArray(v)) v.forEach((x) => ziel.push(x));
            else ziel.push(v);
          } else {
            this.befehlAusfuehren(el, ber, eingabe, ziel);
          }
        } finally {
          if (fehlerZiel) this.fehlerUmleitung.pop();
        }
        if (gesammelteFehler) gesammelteFehler.forEach((f) => ziel.push(f));
        if (fehlerZiel && fehlerZiel.ziel) {
          const z = fehlerZiel.ziel;
          const istNull = z.k === "var" && klein(z.name) === "null";
          if (!istNull) this.inDateiUmleiten(textVon(this.auswerten(z, ber)), [], fehlerZiel.op.includes(">>"), ber);
        }
        const ausUm = umleitungen.find((u) => /^1?>{1,2}$/.test(u.op));
        if (ausUm) {
          const datei = this.auswerten(ausUm.ziel, ber);
          if (!(ausUm.ziel.k === "var" && klein(ausUm.ziel.name) === "null")) this.inDateiUmleiten(textVon(datei), ziel, ausUm.op.endsWith(">>"), ber);
          ziel.length = 0;
        }
        eingabe = ziel;
      }
      if (!direkt) for (const v of eingabe) aus.push(v);
    }

    // > und >> verhalten sich wie Out-File (formatierte Ausgabe, UTF-8)
    inDateiUmleiten(pfad, objekte, anhaengen, ber) {
      const zeilen = formatierenAlsText(objekte, this).split("\n");
      while (zeilen.length && zeilen[zeilen.length - 1] === "") zeilen.pop();
      dateiInhaltSchreiben(this, pfad, zeilen, anhaengen, "Out-File");
    }

    /* ---------- Befehle ---------- */

    befehlFinden(name) {
      const k = klein(name);
      // Funktionen wie «cd\» enthalten einen Backslash und sind trotzdem kein Pfad
      if ((/[\\/]/.test(name) && !CMDLETS[k]) || /\.ps1$/i.test(name)) return { art: "pfad", name: name };
      const alias = ALIASE[k];
      if (alias) {
        const ziel = this.befehlFinden(alias) || { art: "echt", name: alias };
        return Object.assign(ziel, { alias: name });
      }
      if (this.funktionen.has(k)) return { art: "funktion", f: this.funktionen.get(k), name: this.funktionen.get(k).name };
      if (CMDLETS[k] && CMDLETS[k].nurBekannt) return { art: "echt", name: CMDLETS[k].name };
      if (CMDLETS[k]) return { art: "cmdlet", def: CMDLETS[k], name: CMDLETS[k].name };
      if (EXTERN[k] || EXTERN[k.replace(/\.exe$/, "")]) return { art: "extern", def: EXTERN[k] || EXTERN[k.replace(/\.exe$/, "")], name: name };
      if (ECHTE_BEFEHLE.has(k)) return { art: "echt", name: ECHTE_BEFEHLE.get(k) };
      return null;
    }

    befehlAusfuehren(el, ber, eingabe, ziel) {
      let name = el.name;
      let sb = null;
      if (el.nameAusdruck) {
        const v = this.auswerten(el.nameAusdruck, ber);
        if (v instanceof Skriptblock) sb = v;
        else name = textVon(v);
      }
      const argumente = this.argumenteAuswerten(el.argumente, ber);
      if (sb) {
        const neu = el.aufruf === "." ? ber : new Bereich(ber);
        const ergebnis = this.skriptblockAusfuehren(sb, neu, { argumente: argumente.filter((a) => a.art === "wert").map((a) => a.wert), eingabe: eingabe });
        ergebnis.forEach((x) => ziel.push(x));
        return;
      }
      const gefunden = this.befehlFinden(name);
      const posName = { quelle: this.aktuelleQuelle().text, datei: this.aktuelleQuelle().datei, start: el.start, ende: el.nameEnde || el.ende };
      if (!gefunden) throw this.nichtGefunden(name, posName);
      this.befehleDerZeile.push(gefunden.name || name);
      switch (gefunden.art) {
        case "cmdlet": return this.cmdletAusfuehren(gefunden.def, argumente, eingabe, ziel, ber, el);
        case "funktion": return this.funktionAusfuehren(gefunden.f, argumente, eingabe, ziel, ber);
        case "pfad": return this.skriptDateiAusfuehren(name, argumente, eingabe, ziel, ber, posName);
        case "extern": {
          const zeilen = gefunden.def(this, argumente.map((a) => (a.art === "param" ? "-" + a.name : textVon(a.wert))));
          (zeilen || []).forEach((z) => ziel.push(z));
          return;
        }
        case "echt":
          this.hinweis("«" + gefunden.name + "» gibt es in PowerShell, im Simulator ist der Befehl aber nicht nachgebaut. Probier ihn in einer echten PowerShell aus.");
          this.letzterErfolg = false;
          return;
        default: return;
      }
    }

    nichtGefunden(name, pos) {
      const dateiHier = this.welt.knoten(this.orte.C.concat([name]));
      const ds = fehlerAus({
        meldung: "The term '" + name + "' is not recognized as a name of a cmdlet, function, script file, or executable program.\n" +
          "Check the spelling of the name, or if a path was included, verify that the path is correct and try again.",
        befehl: name, kategorie: "ObjectNotFound", ausnahme: "System.Management.Automation.CommandNotFoundException", id: "CommandNotFoundException", ziel: name, pos: pos,
        // pwsh zeigt hier interaktiv einen Vorschlag; der Simulator erklärt es auf Deutsch
        hinweis: dateiHier && this.laufwerk === "C" && !dateiHier.ordner
          ? "[Simulator] «" + name + "» liegt im aktuellen Ordner. Skripte aus dem aktuellen Ordner startest du mit .\\ davor: .\\" + name
          : null,
      });
      return new AbbruchFehler(ds, "anweisung");
    }

    argumenteAuswerten(liste, ber) {
      return liste.map((a) => {
        if (a.art === "param") {
          return { art: "param", name: a.name, wert: a.doppelpunkt ? this.auswerten(a.wert, ber) : undefined, doppelpunkt: a.doppelpunkt, start: a.start, ende: a.ende };
        }
        const w = a.wert;
        const wert = this.auswerten(w, ber);
        return { art: "wert", wert: wert, roh: w.k === "wort" ? w.wert : null, start: a.start, ende: a.ende };
      });
    }

    /* ---------- Cmdlets: Parameter binden und ausführen ---------- */

    cmdletAusfuehren(def, argumente, eingabe, ziel, ber, el) {
      const meta = syntaxMeta(def);
      const pos = this.posVon(el);
      const fehlerBeimBinden = (meldung, id, extra) => new AbbruchFehler(fehlerAus(Object.assign({
        meldung: meldung, befehl: def.name, kategorie: "InvalidArgument", ausnahme: "System.Management.Automation.ParameterBindingException", id: id, pos: pos,
      }, extra || {})), "anweisung");
      const p = parameterBinden(def, meta, argumente, eingabe, fehlerBeimBinden);
      const eaText = p.erroraction !== undefined ? textVon(p.erroraction) : textVon(this.varHolen("ErrorActionPreference", null, ber) || "Continue");
      const ea = klein(eaText);
      const ctx = {
        sitzung: this, welt: this.welt, ber: ber, def: def, p: p, eingabe: eingabe,
        hatEingabe: eingabe !== null,
        aus: (v) => ziel.push(v),
        wert: (n) => p[klein(n)],
        hat: (n) => p[klein(n)] !== undefined,
        schalter: (n) => !!p[klein(n)],
        fehler: (o) => {
          const ds = fehlerAus(Object.assign({ befehl: def.name, pos: pos }, o));
          if (ea === "stop") throw new AbbruchFehler(ds, "skript");
          if (ea === "ignore") return;
          this.fehlerMelden(ds, ea === "silentlycontinue");
        },
        abbruch: (o) => new AbbruchFehler(fehlerAus(Object.assign({ befehl: def.name, pos: pos }, o)), "anweisung"),
        // -WhatIf und -Confirm: true = Aktion ausführen
        sollen: (operation, zielText) => {
          if (p.whatif) { this.hostSchreiben('What if: Performing the operation "' + operation + '" on target "' + zielText + '".'); return false; }
          if (p.confirm) {
            return this.rueckfrage("Confirm\nAre you sure you want to perform this action?\nPerforming the operation \"" + operation + "\" on target \"" + zielText + "\".");
          }
          return true;
        },
        host: (t, f) => this.hostSchreiben(t, f),
        hinweis: (t) => this.hinweis(t),
        warnung: (t) => this.warnung(t),
      };
      const ergebnis = def.run(ctx);
      if (Array.isArray(ergebnis)) ergebnis.forEach((x) => ziel.push(x));
    }

    /* ---------- Funktionen, Skriptblöcke, Skriptdateien ---------- */

    // Parameter einer Funktion oder eines Skripts binden
    paramBinden(param, argumente, neu, name) {
      const liste = param || [];
      const frei = [];
      const extra = []; // unbekannte -Namen landen wie in einfachen Funktionen in $args
      const gesetzt = new Set();
      for (let i = 0; i < argumente.length; i++) {
        const a = argumente[i];
        if (a.art !== "param") { frei.push(a.wert); continue; }
        const kandidaten = liste.filter((p) => klein(p.name).startsWith(klein(a.name)));
        const genau = liste.find((p) => gleichCI(p.name, a.name));
        const p = genau || (kandidaten.length === 1 ? kandidaten[0] : null);
        if (!p) {
          if (kandidaten.length > 1) throw abbruch({ meldung: "Parameter cannot be processed because the parameter name '" + a.name + "' is ambiguous. Possible matches include: " + kandidaten.map((x) => "-" + x.name).join(" ") + ".", befehl: name, kategorie: "InvalidArgument", ausnahme: "System.Management.Automation.ParameterBindingException" });
          extra.push("-" + a.name + (a.doppelpunkt ? ":" : ""));
          if (a.doppelpunkt) extra.push(a.wert);
          continue;
        }
        let wert;
        if (p.schalter) wert = a.doppelpunkt ? alsBool(a.wert) : true;
        else if (a.doppelpunkt) wert = a.wert;
        else if (argumente[i + 1] && argumente[i + 1].art === "wert") wert = argumente[++i].wert;
        else throw abbruch({ meldung: "Missing an argument for parameter '" + p.name + "'. Specify a parameter of type '" + ((typSuchen(p.typ || "object") || T_OBJECT).voll) + "' and try again.", befehl: name, kategorie: "InvalidArgument", ausnahme: "System.Management.Automation.ParameterBindingException" });
        this.paramSetzen(p, wert, neu, name);
        gesetzt.add(klein(p.name));
      }
      const offen = liste.filter((p) => !gesetzt.has(klein(p.name)) && !p.schalter);
      while (frei.length && offen.length) {
        const p = offen.shift();
        this.paramSetzen(p, frei.shift(), neu, name);
        gesetzt.add(klein(p.name));
      }
      const fehlend = liste.filter((p) => p.pflicht && !gesetzt.has(klein(p.name)));
      if (fehlend.length) throw abbruch({ meldung: "Cannot process command because of one or more missing mandatory parameters: " + fehlend.map((p) => p.name).join(" ") + ".", befehl: name, kategorie: "InvalidArgument", ausnahme: "System.Management.Automation.ParameterBindingException", id: "MissingMandatoryParameter" });
      for (const p of liste) {
        if (gesetzt.has(klein(p.name))) continue;
        let w = p.schalter ? false : null;
        if (p.standard) w = this.auswerten(p.standard, neu);
        this.paramSetzen(p, w, neu, name, true);
      }
      neu.vars.set("args", { name: "args", wert: extra.concat(frei), typ: null });
    }

    paramSetzen(p, wert, neu, name, standard) {
      const t = p.typ ? typSuchen(p.typ) : null;
      let w = wert;
      if (t && !(standard && wert === null)) {
        try { w = konvertieren(wert, t); }
        catch (e) {
          if (e instanceof AbbruchFehler) {
            throw abbruch({ meldung: "Cannot process argument transformation on parameter '" + p.name + "'. " + e.datensatz.meldung, befehl: name, kategorie: "InvalidData", ausnahme: "System.Management.Automation.ParameterBindingArgumentTransformationException" });
          }
          throw e;
        }
      }
      neu.vars.set(klein(p.name), { name: p.name, wert: w, typ: t && !t.voll.endsWith("SwitchParameter") ? t : null });
    }

    funktionAusfuehren(f, argumente, eingabe, ziel, ber) {
      if (++this.tiefe > MAX_TIEFE) { this.tiefe = 0; throw abbruch({ meldung: "The script failed due to call depth overflow.", art: "Simulator", ausnahme: "System.Management.Automation.ScriptCallDepthException" }, "skript"); }
      const neu = new Bereich(ber, "funktion");
      try {
        this.quellen.push(f.sb.quelle || this.aktuelleQuelle());
        this.paramBinden(f.sb.knoten.param, argumente, neu, f.name);
        this.rumpfAusfuehren(f.sb.knoten, neu, eingabe, ziel);
      } finally {
        this.quellen.pop();
        this.tiefe--;
      }
    }

    // begin/process/end oder einfacher Rumpf ($input enthält die Pipeline-Eingabe)
    rumpfAusfuehren(k, ber, eingabe, ziel) {
      const lauf = (saetze) => {
        try { this.saetzeAusfuehren(saetze, ber, ziel); }
        catch (e) { if (e instanceof SteuerSignal && e.art === "return") return; throw e; }
      };
      if (k.process) {
        if (k.begin) lauf(k.begin);
        for (const x of eingabe || []) {
          ber.vars.set("_", { name: "_", wert: x, typ: null });
          lauf(k.process);
        }
        if (k.end) lauf(k.end);
        return;
      }
      ber.vars.set("input", { name: "input", wert: eingabe || [], typ: null });
      lauf(k.saetze);
    }

    // Skriptblock aufrufen und Ausgabe zurückgeben. o: { argumente, eingabe, dollarUnter, gleicherBereich }
    skriptblockAusfuehren(sb, ber, o) {
      o = o || {};
      if (++this.tiefe > MAX_TIEFE) { this.tiefe = 0; throw abbruch({ meldung: "The script failed due to call depth overflow.", art: "Simulator" }, "skript"); }
      const aus = [];
      this.quellen.push(sb.quelle || this.aktuelleQuelle());
      try {
        if (o.gleicherBereich) {
          const alt = ber.vars.get("_");
          if (o.dollarUnter !== undefined) ber.vars.set("_", { name: "_", wert: o.dollarUnter, typ: null });
          try {
            this.saetzeAusfuehren(sb.knoten.saetze, ber, aus);
          } catch (e) {
            if (!(e instanceof SteuerSignal && e.art === "return")) throw e;
          } finally {
            if (alt) ber.vars.set("_", alt); else ber.vars.delete("_");
          }
        } else {
          if (o.dollarUnter !== undefined) ber.vars.set("_", { name: "_", wert: o.dollarUnter, typ: null });
          if (sb.knoten.param) this.paramBinden(sb.knoten.param, (o.argumente || []).map((w) => ({ art: "wert", wert: w })), ber, "<ScriptBlock>");
          else ber.vars.set("args", { name: "args", wert: o.argumente || [], typ: null });
          this.rumpfAusfuehren(sb.knoten, ber, o.eingabe, aus);
        }
      } finally {
        this.quellen.pop();
        this.tiefe--;
      }
      return aus;
    }
    skriptblockWert(sb, ber, o) {
      return ausgabeWert(this.skriptblockAusfuehren(sb, ber, Object.assign({ gleicherBereich: true }, o || {})));
    }

    // .\skript.ps1 ausführen (Datei aus dem Spiel-Rechner)
    skriptDateiAusfuehren(name, argumente, eingabe, ziel, ber, pos) {
      const ziel1 = this.pfadAufloesen(name);
      const knoten = ziel1.laufwerk === "C" ? this.welt.knoten(ziel1.teile) : null;
      const voll = this.ortText(ziel1.laufwerk, ziel1.teile);
      const relativ = /^\.{1,2}[\\/]/.test(name) || /^[a-z]:/i.test(name) || name.startsWith("\\") || name.startsWith("~");
      if (!knoten || knoten.ordner || !relativ) throw this.nichtGefunden(name, pos);
      if (!/\.ps1$/i.test(knoten.name)) {
        this.hinweis("«" + knoten.name + "» würde Windows mit dem passenden Programm öffnen. Das kann der Simulator nicht.");
        return;
      }
      const r = klein(effektiveRichtlinie(this.welt));
      if (r === "restricted" || r === "allsigned") {
        throw new AbbruchFehler(fehlerAus({
          meldung: "File " + voll + " cannot be loaded because running scripts is disabled on this system. For more information, see about_Execution_Policies at https://go.microsoft.com/fwlink/?LinkID=135170.",
          befehl: name, kategorie: "SecurityError", ausnahme: "System.Management.Automation.PSSecurityException", id: "UnauthorizedAccess", pos: pos,
        }), "anweisung");
      }
      const text = (knoten.inhalt || "").replace(/\r\n/g, "\n").replace(/\n$/, "");
      let baum;
      try { baum = parsen(text); }
      catch (e) {
        if (e instanceof ParseFehler) throw new AbbruchFehler(parseFehlerDatensatz(e, text, voll), "skript");
        throw e;
      }
      if (++this.tiefe > MAX_TIEFE) { this.tiefe = 0; throw abbruch({ meldung: "The script failed due to call depth overflow.", art: "Simulator" }, "skript"); }
      const neu = new Bereich(this.global, "skript");
      neu.vars.set("psscriptroot", { name: "PSScriptRoot", wert: this.ortText("C", ziel1.teile.slice(0, -1)), typ: null });
      neu.vars.set("pscommandpath", { name: "PSCommandPath", wert: voll, typ: null });
      this.quellen.push({ text: text, datei: voll });
      try {
        this.paramBinden(baum.param, argumente, neu, knoten.name);
        try { this.rumpfAusfuehren(baum, neu, eingabe, ziel); }
        catch (e) { if (!(e instanceof SteuerSignal && e.art === "exit")) throw e; }
      } finally {
        this.quellen.pop();
        this.tiefe--;
      }
    }
  }

  // Passt ein Fehler zu catch [Typ]?
  const AUSNAHME_BASEN = {
    "system.management.automation.itemnotfoundexception": ["System.Management.Automation.SessionStateException", "System.Management.Automation.RuntimeException", "System.SystemException", "System.Exception"],
    "system.management.automation.commandnotfoundexception": ["System.Management.Automation.RuntimeException", "System.SystemException", "System.Exception"],
    "system.management.automation.runtimeexception": ["System.SystemException", "System.Exception"],
    "system.dividebyzeroexception": ["System.ArithmeticException", "System.SystemException", "System.Exception"],
    "system.io.ioexception": ["System.SystemException", "System.Exception"],
    "system.unauthorizedaccessexception": ["System.SystemException", "System.Exception"],
    "system.management.automation.parameterbindingexception": ["System.Management.Automation.RuntimeException", "System.SystemException", "System.Exception"],
    "system.management.automation.psinvalidcastexception": ["System.InvalidCastException", "System.Management.Automation.RuntimeException", "System.SystemException", "System.Exception"],
  };
  function ausnahmePasst(ds, typName) {
    const t = klein(typName).replace(/^system\./, "");
    const kette = [ds.ausnahme].concat(ds.innere ? [ds.innere] : [], AUSNAHME_BASEN[klein(ds.ausnahme)] || ["System.SystemException", "System.Exception"]);
    return kette.some((x) => klein(x).replace(/^system\./, "") === t || klein(x).split(".").pop() === t.split(".").pop() && t.split(".").length === 1);
  }

  function trefferTabelle(m) {
    const h = new PSHashtable(false);
    m.forEach((x, i) => { if (x !== undefined) h.setzen(i, x); });
    if (m.groups) Object.keys(m.groups).forEach((k) => { if (m.groups[k] !== undefined) h.setzen(k, m.groups[k]); });
    return h;
  }

  function parseFehlerDatensatz(e, text, datei) {
    return fehlerAus({ meldung: e.message, art: "ParserError", kategorie: "ParserError", ausnahme: "System.Management.Automation.ParseException",
      id: "ParseError", pos: { quelle: text, datei: datei || null, start: e.pos, ende: e.pos + (e.laenge || 1) }, parser: true });
  }

  /* ---------- Parameterbindung für Cmdlets ---------- */

  const COMMON_PARAMETER = ["Verbose", "Debug", "ErrorAction", "WarningAction", "InformationAction", "ProgressAction", "ErrorVariable", "WarningVariable",
    "InformationVariable", "OutVariable", "OutBuffer", "PipelineVariable"];
  const COMMON_ALIASE = { vb: "Verbose", db: "Debug", ea: "ErrorAction", wa: "WarningAction", infa: "InformationAction", proga: "ProgressAction",
    ev: "ErrorVariable", wv: "WarningVariable", iv: "InformationVariable", ov: "OutVariable", ob: "OutBuffer", pv: "PipelineVariable", wi: "WhatIf", cf: "Confirm" };
  const COMMON_TYPEN = { Verbose: "switch", Debug: "switch", WhatIf: "switch", Confirm: "switch", OutBuffer: "int" };

  // Syntaxzeilen wie "Get-Item [-Path] <string[]> [-Force]" → Parametersätze
  const META_CACHE = new Map();
  function syntaxMeta(def) {
    if (META_CACHE.has(def.name)) return META_CACHE.get(def.name);
    const alle = new Map();
    const saetze = def.syntax.map((zeile) => {
      const params = [];
      const re = /\[\[-(\w+)\]\s+<([^>]+)>\]|\[-(\w+)\]\s+<([^>]+)>|\[-(\w+)\s+<([^>]+)>\]|\[-(\w+)\]|-(\w+)\s+<([^>]+)>|-(\w+)/g;
      let m, pos = 0;
      const rest = zeile.replace(/^\S+\s*/, "").replace(/\[<CommonParameters>\]/, ""); // ohne Befehlsnamen (sonst wäre «-Date» aus «Get-Date» ein Parameter)
      while ((m = re.exec(rest))) {
        let p;
        if (m[1]) p = { name: m[1], typ: m[2], position: pos++, pflicht: false };
        else if (m[3]) p = { name: m[3], typ: m[4], position: pos++, pflicht: true };
        else if (m[5]) p = { name: m[5], typ: m[6], position: null, pflicht: false };
        else if (m[7]) p = { name: m[7], typ: "switch", position: null, pflicht: false };
        else if (m[8]) p = { name: m[8], typ: m[9], position: null, pflicht: true };
        else p = { name: m[10], typ: "switch", position: null, pflicht: true };
        p.schalter = p.typ === "switch";
        params.push(p);
        if (!alle.has(klein(p.name))) alle.set(klein(p.name), { name: p.name, typ: p.typ, schalter: p.schalter });
      }
      return { params: params };
    });
    // Position eines Parameters = grösste Stelle in allen Sätzen (Get-Command: -Name 0, -ArgumentList 1)
    const global = {};
    saetze.forEach((s) => s.params.forEach((p) => { if (p.position !== null) global[klein(p.name)] = Math.max(global[klein(p.name)] || 0, p.position); }));
    saetze.forEach((s) => s.params.forEach((p) => { if (p.position !== null) p.position = global[klein(p.name)]; }));
    const meta = { saetze: saetze, alle: alle };
    META_CACHE.set(def.name, meta);
    return meta;
  }

  function parameterBinden(def, meta, argumente, eingabe, fehler) {
    const gebunden = {};
    const genannt = [];
    const positionell = [];
    const hatWhatIf = meta.alle.has("whatif");
    const befehlsId = "Microsoft.PowerShell.Commands." + def.name.replace("-", "") + "Command";
    // Suchliste in der Reihenfolge von pwsh: eigene Parameter, gemeinsame, WhatIf/Confirm; dynamische getrennt
    const eintrag = (name, aliase, eigen) => ({ name: name, aliase: aliase || [], eigen: eigen });
    const dynamisch = def.dynamisch || [];
    const rang = (p) => { const i = (def.reihenfolge || []).indexOf(p.name); return i < 0 ? 1e6 : i; };
    const statisch = Array.from(meta.alle.values()).filter((p) => !dynamisch.includes(p.name) && !["whatif", "confirm"].includes(klein(p.name)))
      .sort((a, b) => rang(a) - rang(b))
      .map((p) => eintrag(p.name, def.paramAliase && def.paramAliase[p.name], true))
      .concat(COMMON_PARAMETER.map((c) => eintrag(c, Object.keys(COMMON_ALIASE).filter((a) => COMMON_ALIASE[a] === c), false)))
      .concat(hatWhatIf ? [eintrag("WhatIf", ["wi"], false)] : [], meta.alle.has("confirm") ? [eintrag("Confirm", ["cf"], false)] : []);
    const dynListe = dynamisch.filter((d) => meta.alle.has(klein(d))).map((d) => eintrag(d, def.paramAliase && def.paramAliase[d], true));
    // Wie MergedCommandParameterMetadata.GetMatchingParameter in pwsh: genauer Name oder Zweitname gewinnt,
    // sonst alle Namen mit diesem Anfang und danach alle Zweitnamen mit diesem Anfang
    const suchen = (n, liste) => {
      const treffer = [];
      for (const p of liste) {
        if (klein(p.name) === n) return [p];
        if (klein(p.name).startsWith(n)) treffer.push(p);
      }
      for (const p of liste) {
        for (const a of p.aliase) {
          if (klein(a) === n) return [p];
          if (klein(a).startsWith(n) && !treffer.includes(p)) treffer.push(p);
        }
      }
      return treffer;
    };
    // null: kein Parameter passt (pwsh meldet das erst bei der Bindung nach Position)
    const finde = (roh) => {
      const n = klein(roh);
      let treffer = suchen(n, statisch);
      if (!treffer.length && dynListe.length) treffer = suchen(n, statisch.concat(dynListe));
      if (treffer.length > 1) {
        // Eigene Parameter gehen den gemeinsamen vor (-I ist bei Get-ChildItem -Include, nicht -InformationAction)
        const eigen = treffer.filter((p) => p.eigen);
        if (eigen.length === 1) treffer = eigen;
        else throw fehler("Parameter cannot be processed because the parameter name '" + roh + "' is ambiguous. Possible matches include: " + treffer.map((x) => "-" + x.name).join(" ") + ".", "AmbiguousParameter," + befehlsId);
      }
      if (!treffer.length) return null;
      const name = treffer[0].name;
      if (meta.alle.has(klein(name))) return meta.alle.get(klein(name));
      return { name: name, typ: COMMON_TYPEN[name] || "string", schalter: COMMON_TYPEN[name] === "switch", common: true };
    };
    const unbekannt = (roh) => fehler("A parameter cannot be found that matches parameter name '" + roh + "'.", "NamedParameterNotFound," + befehlsId);
    for (let i = 0; i < argumente.length; i++) {
      const a = argumente[i];
      if (a.art !== "param") { positionell.push(a); continue; }
      const p = finde(a.name);
      // Unbekannter Name: Platzhalter in der Reihe der Positionswerte (der folgende Wert bleibt ein Positionswert)
      if (!p) { positionell.push({ art: "unbekannt", name: a.name }); continue; }
      let wert;
      if (p.schalter) wert = a.doppelpunkt ? alsBool(a.wert) : true;
      else if (a.doppelpunkt) wert = a.wert;
      else if (argumente[i + 1] && argumente[i + 1].art === "wert") wert = argumente[++i].wert;
      else throw fehler("Missing an argument for parameter '" + p.name + "'. Specify a parameter of type '" + typVoll(p.typ) + "' and try again.", "MissingArgument");
      if (gebunden[klein(p.name)] !== undefined) {
        throw fehler("Cannot bind parameter because parameter '" + p.name + "' is specified more than once. To provide multiple values to parameters that can accept multiple values, use the array syntax. For example, \"-parameter value1,value2,value3\".", "ParameterAlreadyBound");
      }
      gebunden[klein(p.name)] = p.common ? wert : paramUmwandeln(def, p, wert, fehler);
      if (!p.common) genannt.push(klein(p.name));
    }
    // Parametersatz wählen
    const passend = meta.saetze.filter((s) => genannt.every((n) => s.params.some((p) => klein(p.name) === n)));
    if (!passend.length && genannt.length) throw fehler("Parameter set cannot be resolved using the specified named parameters. One or more parameters issued cannot be used together or an insufficient number of parameters were provided.", "AmbiguousParameterSet");
    const kandidaten = passend.length ? passend : meta.saetze;
    const werte = positionell.filter((a) => a.art !== "unbekannt");
    const freiIn = (s) => s.params.filter((p) => p.position !== null && gebunden[klein(p.name)] === undefined).sort((a, b) => a.position - b.position);
    const kleinstePos = Math.min.apply(null, kandidaten.map((s) => (freiIn(s)[0] ? freiIn(s)[0].position : Infinity)));
    // Passt der Wert zum Typ? (Skriptblock nur an Skriptblock-Parameter, Text nicht an Skriptblock)
    const kompatibel = (p, w) => {
      const t = klein(p.typ || "");
      const sb = w instanceof Skriptblock || (Array.isArray(w) && w.length && w.every((x) => x instanceof Skriptblock));
      if (t.startsWith("scriptblock")) return sb;
      if (sb && (t === "string" || t === "string[]")) return false;
      return true;
    };
    const satzOk = (s) => {
      const pos = freiIn(s);
      if (werte.length > pos.length && !(def.restParameter && pos.length)) return false;
      if (werte.length && pos[0].position !== kleinstePos) return false;
      if (werte.some((a, k) => pos[k] && !kompatibel(pos[k], a.wert))) return false;
      return s.params.every((p) => !p.pflicht || p.position !== null || gebunden[klein(p.name)] !== undefined);
    };
    const satz = kandidaten.find(satzOk) || kandidaten.find((s) => s.params.filter((p) => p.position !== null).length >= werte.length) || kandidaten[0];
    const frei = satz ? satz.params.filter((p) => p.position !== null && gebunden[klein(p.name)] === undefined).sort((a, b) => a.position - b.position) : [];
    const ersterUnbekannt = positionell.find((a) => a.art === "unbekannt");
    if (def.restParameter && ersterUnbekannt) throw unbekannt(ersterUnbekannt.name);
    if (def.restParameter && positionell.length > 1 && gebunden[klein(def.restParameter)] === undefined) {
      // Write-Host 'a' 'b': übrige Argumente gehören zum Rest-Parameter
      gebunden[klein(def.restParameter)] = positionell.map((x) => x.wert);
      gebunden._rest = positionell.map((x) => x.wert);
      positionell.length = 0;
    }
    // Wie pwsh in Reihenfolge: ein unbekannter Name fällt erst hier auf («x y z -foo» meldet zuerst «z»)
    for (const a of positionell) {
      if (a.art === "unbekannt") throw unbekannt(a.name);
      const p = frei.shift();
      if (!p) throw fehler("A positional parameter cannot be found that accepts argument '" + textVon(Array.isArray(a.wert) ? a.wert.map(textVon).join(" ") : a.wert) + "'.", "PositionalParameterNotFound");
      gebunden[klein(p.name)] = paramUmwandeln(def, p, a.wert, fehler);
    }
    if (satz) {
      const pipelineParams = (def.pipeline || []).map(klein);
      const fehlend = satz.params.filter((p) => p.pflicht && gebunden[klein(p.name)] === undefined && !(eingabe !== null && pipelineParams.includes(klein(p.name))) && !p.schalter);
      if (fehlend.length) {
        throw fehler("Cannot process command because of one or more missing mandatory parameters: " + fehlend.map((p) => p.name).join(" ") + ".", "MissingMandatoryParameter");
      }
    }
    gebunden._satz = satz ? meta.saetze.indexOf(satz) : 0;
    return gebunden;
  }

  function typVoll(t) {
    const kurz = String(t || "Object");
    const arr = kurz.endsWith("[]");
    const basis = arr ? kurz.slice(0, -2) : kurz;
    const info = typSuchen(basis);
    const name = klein(basis) === "uint" ? "System.UInt32" : info ? info.voll : basis.includes(".") ? basis : basis.charAt(0).toUpperCase() + basis.slice(1);
    return name + (arr ? "[]" : "");
  }

  // Wert für einen Cmdlet-Parameter umwandeln (int, string[], switch …)
  function paramUmwandeln(def, p, wert, fehler) {
    const t = klein(p.typ || "object");
    try {
      if (p.schalter) return alsBool(wert);
      if (t === "int" || t === "long" || t === "uint") return konvertieren(Array.isArray(wert) && wert.length === 1 ? wert[0] : wert, t === "long" ? T_LONG : T_INT);
      if (t === "int[]" || t === "long[]") return alsListe(wert).map((x) => konvertieren(x, T_INT));
      if (t === "string") return wert === null ? null : Array.isArray(wert) ? wert.map(textImString).join(" ") : wert instanceof Skriptblock ? wert.text : textVon(wert);
      if (t === "string[]") return wert === null ? null : alsListe(wert).map((x) => textVon(x));
      if (t === "char") return textVon(wert).charAt(0);
      if (t === "datetime") {
        if (wert instanceof PSDatum) return wert;
        const d = datumLesen(textVon(wert), true);
        if (!d) throw konvertFehler(wert, "System.DateTime", "String '" + textVon(wert) + "' was not recognized as a valid DateTime.");
        return d;
      }
      if (t === "scriptblock" || t === "scriptblock[]") {
        if (wert instanceof Skriptblock) return t.endsWith("[]") ? [wert] : wert;
        if (Array.isArray(wert) && wert.every((x) => x instanceof Skriptblock)) return wert;
        throw konvertFehler(wert, "System.Management.Automation.ScriptBlock", "Invalid cast from 'System.String' to 'System.Management.Automation.ScriptBlock'.");
      }
      return wert;
    } catch (e) {
      if (e instanceof AbbruchFehler) {
        throw fehler("Cannot bind parameter '" + p.name + "'. " + e.datensatz.meldung, "CannotConvertArgumentNoMessage", { kategorie: "InvalidArgument" });
      }
      throw e;
    }
  }

  /* ---------- Ausdrücke auswerten ---------- */

  // Verzögert berechnete Eigenschaft (z. B. Directory einer Datei)
  class Faul { constructor(fn) { this.fn = fn; } }
  function eig(obj, name) {
    if (!(obj instanceof PSObjekt)) return memberHolen(obj, name);
    if (!obj.hat(name)) return null;
    const w = obj.wert(name);
    return w instanceof Faul ? w.fn() : w;
  }

  Object.assign(Interpreter.prototype, {
    auswerten(e, ber) {
      switch (e.k) {
        case "zahl": return e.wert;
        case "string": case "wort": return e.wert;
        case "xstring": return this.einsetzen(e.teile, ber);
        case "var": return this.varHolen(e.name, e.bereich, ber);
        case "array": return e.elemente.map((x) => this.auswerten(x, ber));
        case "arrayausdruck": {
          const aus = [];
          this.saetzeAusfuehren(e.saetze, ber, aus);
          return aus;
        }
        case "subausdruck": {
          const aus = [];
          this.saetzeAusfuehren(e.saetze, ber, aus);
          return ausgabeWert(aus);
        }
        case "klammer": {
          const s = e.inhalt;
          if (s.k === "pipeline" && s.elemente.length === 1 && s.elemente[0].k === "ausdruck" && !(s.elemente[0].umleitungen || []).length) return this.auswerten(s.elemente[0].ausdruck, ber);
          if (s.k === "zuweisung") { this.zuweisen(s, ber); return this.auswerten(s.ziel.k === "cast" ? s.ziel.operand : s.ziel, ber); }
          return this.satzWert(s, ber);
        }
        case "hash": {
          const h = new PSHashtable(false);
          for (const eintrag of e.eintraege) {
            const k = this.auswerten(eintrag.schluessel, ber);
            const w = eintrag.wert;
            const wert = w.k === "pipeline" && w.elemente.length === 1 && w.elemente[0].k === "ausdruck" ? this.auswerten(w.elemente[0].ausdruck, ber) : this.satzWert(w, ber);
            h.setzen(k, wert);
          }
          return h;
        }
        case "skriptblock": {
          const sb = new Skriptblock(e.wert.knoten, e.wert.text);
          sb.quelle = this.aktuelleQuelle();
          return sb;
        }
        case "binaer": {
          if (e.op === "-and") return alsBool(this.auswerten(e.links, ber)) ? alsBool(this.auswerten(e.rechts, ber)) : false;
          if (e.op === "-or") return alsBool(this.auswerten(e.links, ber)) ? true : alsBool(this.auswerten(e.rechts, ber));
          if (e.op === "??") { const l = this.auswerten(e.links, ber); return l !== null ? l : this.auswerten(e.rechts, ber); }
          return this.binaerOp(e.op, this.auswerten(e.links, ber), this.auswerten(e.rechts, ber), e, ber);
        }
        case "unaer": return this.unaerOp(e.op, this.auswerten(e.operand, ber));
        case "ternaer": return alsBool(this.auswerten(e.bed, ber)) ? this.auswerten(e.ja, ber) : this.auswerten(e.nein, ber);
        case "cast": {
          const t = typSuchen(e.typ);
          if (!t) throw ungueltig("Unable to find type [" + e.typ + "].", { kategorie: "InvalidOperation", ausnahme: "System.Management.Automation.RuntimeException", id: "TypeNotFound" });
          const v = this.auswerten(e.operand, ber);
          if (t === T_ORDERED) {
            if (!(v instanceof PSHashtable)) throw ungueltig("The ordered attribute can be specified only on a hash literal node.");
            const h = v.kopie();
            h.geordnet = true;
            return h;
          }
          return konvertieren(v, t);
        }
        case "typ": {
          const t = typSuchen(e.name);
          if (!t) throw ungueltig("Unable to find type [" + e.name + "].", { id: "TypeNotFound" });
          return new PSTyp(t);
        }
        case "member": return this.memberAuswerten(e, ber);
        case "index": return this.indexAuswerten(e, ber);
        case "inkrement": {
          const alt = this.auswerten(e.ziel, ber);
          const neu = this.binaerOp(e.op === "++" ? "+" : "-", alt === null ? 0 : alt, 1, e, ber);
          this.zuweisenAn(e.ziel, neu, ber);
          return e.praefix ? neu : alt;
        }
        default: throw ungueltig("Unbekannter Ausdruck " + e.k);
      }
    },

    // "Text $x $(…)" einsetzen
    einsetzen(teile, ber) {
      let s = "";
      for (const t of teile) {
        if (t.art === "text") s += t.wert;
        else if (t.art === "var") s += textImString(this.varHolen(t.name, t.bereich, ber));
        else {
          if (!t.baum) {
            const p = new Parser(t.quelle);
            t.baum = p.skript();
          }
          const aus = [];
          this.saetzeAusfuehren(t.baum.saetze, ber, aus);
          s += textImString(aus.length === 1 ? aus[0] : aus);
        }
      }
      return s;
    },

    memberAuswerten(e, ber) {
      const name = typeof e.name === "string" ? e.name : textVon(this.auswerten(e.name, ber));
      const args = e.argumente ? e.argumente.map((a) => this.auswerten(a, ber)) : null;
      if (e.statisch) {
        const t = e.objekt.k === "typ" ? typSuchen(e.objekt.name) : null;
        if (!t) throw ungueltig("Unable to find type [" + (e.objekt.name || "") + "].");
        return statischerZugriff(this, t, name, args);
      }
      const obj = this.auswerten(e.objekt, ber);
      if (e.nullBedingt && obj === null) return null;
      if (args) return this.methodeAufrufen(obj, name, args, ber);
      return memberHolen(obj, name, this);
    },

    indexAuswerten(e, ber) {
      const obj = this.auswerten(e.objekt, ber);
      const index = this.auswerten(e.index, ber);
      return indexHolen(obj, index);
    },

    unaerOp(op, v) {
      switch (op) {
        case "-not": case "!": return !alsBool(v);
        case "-": {
          const z = nachZahl(v);
          return istDouble(z) ? alsDouble(-zahlWert(z)) : -zahlWert(z);
        }
        case "+": return nachZahl(v);
        case "-bnot": return ~zahlWert(nachZahl(v));
        case "-split": return textVon(v).trim().split(/\s+/).filter((x) => x !== "");
        case "-join": return alsListe(v).map(textVon).join("");
        default: throw ungueltig("Unbekannter Operator " + op);
      }
    },

    binaerOp(opRoh, a, b, knoten, ber) {
      let op = klein(opRoh);
      let cs = false;
      if (/^-c(eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|contains|notcontains|in|notin|replace|split)$/.test(op)) { cs = true; op = "-" + op.slice(2); }
      else if (/^-i(eq|ne|gt|ge|lt|le|like|notlike|match|notmatch|contains|notcontains|in|notin|replace|split)$/.test(op)) op = "-" + op.slice(2);
      const vergleich = ["-eq", "-ne", "-gt", "-ge", "-lt", "-le", "-like", "-notlike", "-match", "-notmatch"];
      if (vergleich.includes(op) && Array.isArray(a)) {
        return a.filter((x) => this.vergleichEinzeln(op, x, b, cs, null));
      }
      switch (op) {
        case "+": case "-": case "*": case "/": case "%": return arithmetik(op, a, b);
        case "-eq": case "-ne": case "-gt": case "-ge": case "-lt": case "-le": case "-like": case "-notlike": case "-match": case "-notmatch":
          return this.vergleichEinzeln(op, a, b, cs, ber);
        case "-contains": return alsListe(a).some((x) => gleich(x, b, cs));
        case "-notcontains": return !alsListe(a).some((x) => gleich(x, b, cs));
        case "-in": return alsListe(b).some((x) => gleich(x, a, cs));
        case "-notin": return !alsListe(b).some((x) => gleich(x, a, cs));
        case "-replace": {
          const [muster, ersatz] = Array.isArray(b) ? [b[0], b.length > 1 ? b[1] : ""] : [b, ""];
          const re = regexAus(textVon(muster), cs ? "g" : "gi");
          const ers = textVon(ersatz).replace(/\$0/g, "$$&").replace(/\$\{(\w+)\}/g, "$<$1>");
          const f = (x) => textVon(x).replace(re, ers);
          return Array.isArray(a) ? a.map(f) : f(a);
        }
        case "-split": {
          const [muster, max] = Array.isArray(b) ? [b[0], b[1]] : [b, 0];
          const re = regexAus(textVon(muster), cs ? "" : "i");
          const f = (x) => {
            const teile = textVon(x).split(re);
            const n = zahlWert(nachZahl(max || 0));
            if (n > 0 && teile.length > n) {
              // Rest unverändert lassen
              let rest = textVon(x), out = [];
              for (let i = 0; i < n - 1; i++) {
                const m = re.exec(rest);
                if (!m) break;
                out.push(rest.slice(0, m.index));
                rest = rest.slice(m.index + m[0].length);
              }
              out.push(rest);
              return out;
            }
            return teile.filter((t) => t !== undefined);
          };
          return Array.isArray(a) ? a.flatMap(f) : f(a);
        }
        case "-join": return alsListe(a).map(textImString).join(textVon(b));
        case "-is": case "-isnot": {
          const t = b instanceof PSTyp ? b.info : typSuchen(textVon(b));
          if (!t) throw ungueltig("Unable to find type [" + textVon(b) + "].");
          const ist = istVomTyp(a, t);
          return op === "-is" ? ist : !ist;
        }
        case "-as": {
          const t = b instanceof PSTyp ? b.info : typSuchen(textVon(b));
          try { return konvertieren(a, t); } catch (e) { return null; }
        }
        case "-xor": return alsBool(a) !== alsBool(b);
        case "-band": return zahlWert(nachZahl(a)) & zahlWert(nachZahl(b));
        case "-bor": return zahlWert(nachZahl(a)) | zahlWert(nachZahl(b));
        case "-bxor": return zahlWert(nachZahl(a)) ^ zahlWert(nachZahl(b));
        case "-shl": return zahlWert(nachZahl(a)) << zahlWert(nachZahl(b));
        case "-shr": return zahlWert(nachZahl(a)) >> zahlWert(nachZahl(b));
        case "-f": return formatComposite(textVon(a), alsListe(b));
        case "..": return bereichListe(a, b);
        default: throw ungueltig("Der Operator " + opRoh + " ist im Simulator nicht nachgebaut.");
      }
    },

    vergleichEinzeln(op, a, b, cs, ber) {
      switch (op) {
        case "-eq": return gleich(a, b, cs);
        case "-ne": return !gleich(a, b, cs);
        case "-gt": return vergleichen(a, b, cs) > 0;
        case "-ge": return vergleichen(a, b, cs) >= 0;
        case "-lt": return vergleichen(a, b, cs) < 0;
        case "-le": return vergleichen(a, b, cs) <= 0;
        case "-like": case "-notlike": {
          let re = platzhalterRegex(textVon(b));
          if (cs) re = new RegExp(re.source);
          const r = re.test(textVon(a));
          return op === "-like" ? r : !r;
        }
        case "-match": case "-notmatch": {
          const m = regexAus(textVon(b), cs ? "" : "i").exec(textVon(a));
          if (m && ber && op === "-match") this.varSetzen("Matches", trefferTabelle(m), null, ber);
          return op === "-match" ? !!m : !m;
        }
        default: return false;
      }
    },

    methodeAufrufen(obj, name, args, ber) {
      const n = klein(name);
      if (obj === null || obj === undefined) throw ungueltig("You cannot call a method on a null-valued expression.", { id: "InvokeMethodOnNull" });
      // Gemeinsame Methoden
      if (n === "gettype" && !args.length) return new PSTyp(typVon(obj));
      if (n === "tostring" && !args.length && !(obj instanceof PSDatum) && !istZahl(obj)) return textVon(obj);
      if (n === "equals" && args.length === 1) return obj === args[0] || gleich(obj, args[0], true);
      if (n === "gethashcode") return textVon(obj).length * 7919 % 100003;
      const r = methodeNachTyp(this, obj, n, args, ber);
      if (r !== KEINE_METHODE) return r;
      const typText = Array.isArray(obj) ? "System.Object[]" : typNameVon(obj);
      const bekannt = memberListe(obj).some((m) => m[1] === "Method" && gleichCI(m[0], name));
      if (bekannt) {
        this.hinweis("Die Methode «" + name + "» gibt es, im Simulator ist sie aber nicht nachgebaut.");
        return null;
      }
      throw ungueltig("Method invocation failed because [" + typText + "] does not contain a method named '" + name + "'.", { id: "MethodNotFound" });
    },
  });

  const KEINE_METHODE = {};

  function regexAus(muster, flags) {
    try { return new RegExp(muster.replace(/\(\?<(\w+)>/g, "(?<$1>"), flags); }
    catch (e) {
      throw ungueltig("The regular expression pattern " + muster + " is not valid.", { kategorie: "InvalidOperation", id: "InvalidRegularExpression" });
    }
  }

  function bereichListe(a, b) {
    if (typeof a === "string" && typeof b === "string" && a.length === 1 && b.length === 1 && !/\d/.test(a + b)) {
      const x = a.charCodeAt(0), y = b.charCodeAt(0), s = x <= y ? 1 : -1, out = [];
      for (let i = x; s > 0 ? i <= y : i >= y; i += s) out.push(String.fromCharCode(i));
      return out;
    }
    const x = konvertieren(a, T_INT), y = konvertieren(b, T_INT);
    if (Math.abs(y - x) > MAX_ELEMENTE) throw ungueltig("Der Bereich " + x + ".." + y + " ist für den Simulator zu gross (höchstens " + MAX_ELEMENTE + " Zahlen).");
    const out = [];
    const s = x <= y ? 1 : -1;
    for (let i = x; s > 0 ? i <= y : i >= y; i += s) out.push(i);
    return out;
  }

  // Grenzen für Arrays und Strings: schützen den Browser-Tab vor übergrossen Ergebnissen
  const MAX_ELEMENTE = 100000;
  const MAX_TEXTLAENGE = 10000000;
  function elementeGrenze(n) {
    if (n > MAX_ELEMENTE) throw ungueltig("Das Array hätte " + n + " Elemente und ist für den Simulator zu gross (höchstens " + MAX_ELEMENTE + ").");
  }
  function textGrenze(n) {
    if (n > MAX_TEXTLAENGE) throw ungueltig("Der String hätte " + n + " Zeichen und ist für den Simulator zu gross (höchstens " + MAX_TEXTLAENGE + ").");
  }

  // + - * / % wie PowerShell (der linke Typ entscheidet)
  function arithmetik(op, a, b) {
    const opName = { "+": "op_Addition", "-": "op_Subtraction", "*": "op_Multiply", "/": "op_Division", "%": "op_Modulus" }[op];
    const kannNicht = (x) => ungueltig("Method invocation failed because [" + (Array.isArray(x) ? "System.Object[]" : typNameVon(x)) + "] does not contain a method named '" + opName + "'.", { id: "MethodNotFound" });
    if (op === "+") {
      if (a === null) return b;
      if (Array.isArray(a)) { elementeGrenze(a.length + (Array.isArray(b) ? b.length : 1)); return a.concat(Array.isArray(b) ? b : [b]); }
      if (a instanceof PSHashtable) {
        if (!(b instanceof PSHashtable)) throw ungueltig("A hash table can only be added to another hash table.");
        const h = a.kopie();
        b.eintraege().forEach((e) => {
          if (h.hat(e.k)) throw ungueltig("Item has already been added. Key in dictionary: '" + textVon(e.k) + "'  Key being added: '" + textVon(e.k) + "'");
          h.setzen(e.k, e.w);
        });
        return h;
      }
      if (typeof a === "string") { const rechts = textImString(b); textGrenze(a.length + rechts.length); return a + rechts; }
      if (a instanceof PSDatum && b instanceof PSZeitspanne) return new PSDatum(a.ms + b.ms);
      if (a instanceof PSZeitspanne && b instanceof PSZeitspanne) return new PSZeitspanne(a.ms + b.ms);
    }
    if (op === "-") {
      if (a instanceof PSDatum && b instanceof PSDatum) return new PSZeitspanne(a.ms - b.ms);
      if (a instanceof PSDatum && b instanceof PSZeitspanne) return new PSDatum(a.ms - b.ms);
      if (a instanceof PSZeitspanne && b instanceof PSZeitspanne) return new PSZeitspanne(a.ms - b.ms);
    }
    if (op === "*") {
      if (typeof a === "string") {
        const n = Math.min(zahlWert(konvertieren(b, T_INT)), MAX_ELEMENTE);
        if (n <= 0) return "";
        textGrenze(a.length * n);
        return a.repeat(n);
      }
      if (Array.isArray(a)) {
        const n = zahlWert(konvertieren(b, T_INT));
        if (n <= 0 || !a.length) return [];
        elementeGrenze(a.length * n);
        // in einem Schritt füllen statt concat in der Schleife (sonst quadratische Laufzeit)
        const out = new Array(a.length * n);
        for (let i = 0; i < out.length; i++) out[i] = a[i % a.length];
        return out;
      }
    }
    if (Array.isArray(a) || a instanceof PSHashtable || a instanceof PSObjekt || a instanceof PSDatum || a instanceof Skriptblock || a instanceof PSZeitspanne) throw kannNicht(a);
    if (a === null) a = 0;
    const x = nachZahl(a);
    if (Array.isArray(b) || b instanceof PSHashtable || b instanceof PSObjekt) {
      throw abbruch({ meldung: 'Cannot convert the "' + textVon(b) + '" value of type "' + (Array.isArray(b) ? "System.Object[]" : typNameVon(b)) + '" to type "' + typVon(x).voll + '".', art: "InvalidArgument", kategorie: "InvalidArgument" });
    }
    const y = nachZahl(b === null ? 0 : b, typVon(x));
    const xw = zahlWert(x), yw = zahlWert(y);
    const double = istDouble(x) || istDouble(y);
    if ((op === "/" || op === "%") && yw === 0) {
      throw abbruch({ meldung: "Attempted to divide by zero.", art: "RuntimeException", kategorie: "NotSpecified", ausnahme: "System.Management.Automation.RuntimeException", innere: "System.DivideByZeroException", id: "RuntimeException" });
    }
    switch (op) {
      case "+": return ganzOderDouble(xw + yw, double);
      case "-": return ganzOderDouble(xw - yw, double);
      case "*": return ganzOderDouble(xw * yw, double);
      case "/": { const r = xw / yw; return double || !Number.isInteger(r) ? alsDouble(r) : r; }
      case "%": return ganzOderDouble(xw % yw, double);
    }
    return null;
  }

  function istVomTyp(v, t) {
    if (v === null) return false;
    const voll = klein(t.voll);
    if (voll === "system.object" || voll === "system.management.automation.psobject") return true;
    if (voll === "system.array" || voll === "system.object[]") return Array.isArray(v);
    if (voll === "system.valuetype") return typeof v === "boolean" || istZahl(v) || v instanceof PSDatum || v instanceof PSZeitspanne || v instanceof PSEnum;
    if (voll === CUSTOM.toLowerCase()) return v instanceof PSObjekt && v.typen.includes(CUSTOM);
    if (voll === "system.collections.hashtable") return v instanceof PSHashtable && !v.geordnet;
    if (voll === "system.collections.idictionary") return v instanceof PSHashtable;
    if (voll === "system.io.filesysteminfo") return v instanceof PSObjekt && /^System\.IO\.(File|Directory)Info$/.test(v.typ);
    if (v instanceof PSObjekt) return v.typen.some((x) => klein(x) === voll);
    const eigen = typVon(v);
    return !!eigen && klein(eigen.voll) === voll;
  }

  // Composite-Format "{0,-10} {1:N2}" -f …
  function formatComposite(fmt, args) {
    return fmt.replace(/\{\{|\}\}|\{(\d+)(?:\s*,\s*(-?\d+))?(?::([^}]*))?\}/g, (m, i, ausr, f) => {
      if (m === "{{") return "{";
      if (m === "}}") return "}";
      const idx = Number(i);
      if (idx >= args.length) {
        throw abbruch({ meldung: "Error formatting a string: Index (zero based) must be greater than or equal to zero and less than the size of the argument list..", art: "InvalidOperation", kategorie: "InvalidOperation", ausnahme: "System.FormatException" });
      }
      let s = wertMitFormat(args[idx], f);
      if (ausr) { const n = Number(ausr); s = n < 0 ? links(s, -n) : rechts(s, n); }
      return s;
    });
  }
  function wertMitFormat(v, f) {
    if (f && istZahl(v)) return zahlFormat(v, f);
    if (f && v instanceof PSDatum) return datumFormat(v, f);
    if (f && v instanceof PSZeitspanne) return zeitspanneText(v);
    return textVon(v);
  }

  /* ---------- Eigenschaften lesen und setzen ---------- */

  function datumEigenschaft(d, n) {
    const p = datumTeile(d);
    switch (n) {
      case "day": return p.t;
      case "month": return p.m;
      case "year": return p.j;
      case "hour": return p.h;
      case "minute": return p.min;
      case "second": return p.s;
      case "millisecond": return p.ms;
      case "microsecond": case "nanosecond": return 0;
      case "dayofweek": return new PSEnum("System.DayOfWeek", TAGE_EN[p.wt], p.wt);
      case "dayofyear": return Math.floor((d.ms - Date.UTC(p.j, 0, 1)) / 86400000) + 1;
      case "date": return datumAus(p.j, p.m, p.t);
      case "timeofday": return new PSZeitspanne(d.ms - Date.UTC(p.j, p.m - 1, p.t));
      case "ticks": return d.ms * 10000 + TICKS_1970;
      case "kind": return new PSEnum("System.DateTimeKind", "Unspecified", 0);
      case "datetime": return datumLang(d);
      case "displayhint": return d._hinweis ? new PSEnum("Microsoft.PowerShell.Commands.DisplayHintType", "DateTime", 2) : null;
      default: return undefined;
    }
  }
  function zeitEigenschaft(z, n) {
    const ms = z.ms, abs = Math.abs(ms), vz = ms < 0 ? -1 : 1;
    switch (n) {
      case "days": return vz * Math.floor(abs / 86400000);
      case "hours": return vz * Math.floor((abs % 86400000) / 3600000);
      case "minutes": return vz * Math.floor((abs % 3600000) / 60000);
      case "seconds": return vz * Math.floor((abs % 60000) / 1000);
      case "milliseconds": return vz * Math.floor(abs % 1000);
      case "ticks": return ms * 10000;
      case "totaldays": return alsDouble(ms / 86400000);
      case "totalhours": return alsDouble(ms / 3600000);
      case "totalminutes": return alsDouble(ms / 60000);
      case "totalseconds": return alsDouble(ms / 1000);
      case "totalmilliseconds": return alsDouble(ms);
      default: return undefined;
    }
  }

  function fehlerEigenschaft(ds, n) {
    switch (n) {
      case "exception": return new PSObjekt([ds.ausnahme], [["Message", ds.meldung.replace(/\n/g, " ")], ["InnerException", null], ["Source", null], ["HResult", -2146233087]],
        { Message: "Property", InnerException: "Property", Source: "Property", HResult: "Property" });
      case "categoryinfo": return kategorieInfo(ds);
      case "fullyqualifiederrorid": return ds.id + (ds.befehl && CMDLETS[klein(ds.befehl)] ? "," + "Microsoft.PowerShell.Commands." + ds.befehl.replace("-", "") + "Command" : "");
      case "targetobject": return ds.ziel;
      case "invocationinfo": return ds.pos ? neuesObjekt([["ScriptName", ds.pos.datei || ""], ["Line", zeileVon(ds.pos.quelle, ds.pos.start).text]]) : null;
      case "scriptstacktrace": return "at <ScriptBlock>, " + (ds.pos && ds.pos.datei ? ds.pos.datei : "<No file>") + ": line " + (ds.pos ? zeileVon(ds.pos.quelle, ds.pos.start).nr : 1);
      case "errordetails": return null;
      default: return undefined;
    }
  }
  function kategorieInfo(ds) {
    const grund = ds.ausnahme.split(".").pop();
    const o = neuesObjekt([["Category", ds.kategorie], ["Activity", ds.befehl || ""], ["Reason", grund], ["TargetName", ds.ziel === null ? "" : textVon(ds.ziel)], ["TargetType", ds.ziel === null ? "" : typVon(ds.ziel) ? typVon(ds.ziel).name : ""]],
      "System.Management.Automation.ErrorCategoryInfo");
    o._text = () => ds.kategorie + ": (" + (ds.ziel === null ? "" : textVon(ds.ziel) + ":" + (typVon(ds.ziel) ? typVon(ds.ziel).name : "")) + ") [" + (ds.befehl || "") + "], " + grund;
    return o;
  }

  // obj.Name lesen. Fehlende Eigenschaften ergeben $null (wie ohne Strict-Mode).
  function memberHolen(obj, name, sitzung) {
    const n = klein(name);
    if (obj === null || obj === undefined) return n === "count" || n === "length" ? 0 : null;
    if (obj instanceof PSObjekt) {
      if (obj.hat(name)) return eig(obj, name);
      if (n === "count" || n === "length") return 1;
      if (n === "pstypenames") return obj.typen.slice();
      return null;
    }
    if (obj instanceof PSHashtable) {
      if (obj.hat(name)) return obj.hole(name);
      if (n === "count") return obj.anzahl;
      if (n === "keys") return obj.eintraege().map((e) => e.k);
      if (n === "values") return obj.eintraege().map((e) => e.w);
      if (obj._version && n === "psversion") return obj.hole("PSVersion");
      return null;
    }
    if (Array.isArray(obj)) {
      if (n === "count" || n === "length" || n === "longlength") return obj.length;
      if (n === "rank") return 1;
      if (n === "isfixedsize" || n === "isreadonly") return n === "isfixedsize";
      // Member-Aufzählung: $dateien.Name
      const out = [];
      obj.forEach((x) => { const w = memberHolen(x, name, sitzung); if (w !== null && w !== undefined) { if (Array.isArray(w)) w.forEach((y) => out.push(y)); else out.push(w); } });
      return out.length === 0 ? null : out.length === 1 && obj.length === 1 ? out[0] : out;
    }
    if (typeof obj === "string") {
      if (n === "length") return obj.length;
      if (n === "count") return 1;
      return null;
    }
    if (obj instanceof PSDatum) { const w = datumEigenschaft(obj, n); return w === undefined ? (n === "count" || n === "length" ? 1 : null) : w; }
    if (obj instanceof PSZeitspanne) { const w = zeitEigenschaft(obj, n); return w === undefined ? null : w; }
    if (obj instanceof FehlerDatensatz) { const w = fehlerEigenschaft(obj, n); return w === undefined ? null : w; }
    if (obj instanceof PSEnum) { if (n === "value__") return obj.wert; return null; }
    if (obj instanceof PSTyp) {
      switch (n) {
        case "name": return obj.info.name;
        case "fullname": return obj.info.voll;
        case "basetype": return obj.info.basis ? new PSTyp(typSuchen(obj.info.basis) || typ(null, obj.info.basis, "System.Object")) : null;
        case "ispublic": case "isserial": return true;
        case "namespace": return obj.info.voll.split(".").slice(0, -1).join(".");
        default: return null;
      }
    }
    if (obj instanceof Skriptblock) { if (n === "ast") return null; return null; }
    if (n === "count" || n === "length") return 1;
    return null;
  }

  function memberSetzen(obj, name, wert) {
    if (obj instanceof PSHashtable) { obj.setzen(name, wert); return; }
    if (obj instanceof PSObjekt) {
      const frei = obj.typen.includes(CUSTOM) || obj.typen.some((t) => t.startsWith("Selected.")) || obj.art(name) === "NoteProperty";
      if (obj.hat(name) && frei) { obj.setzen(obj.echterName(name), wert); return; }
      if (obj.hat(name) && obj._setzen && obj._setzen(name, wert)) return;
      if (obj.hat(name)) throw ungueltig("'" + obj.echterName(name) + "' is a ReadOnly property.", { id: "PropertyAssignmentException" });
    }
    if (Array.isArray(obj) && obj.length) { obj.forEach((x) => memberSetzen(x, name, wert)); return; }
    throw ungueltig("The property '" + name + "' cannot be found on this object. Verify that the property exists and can be set.", { id: "PropertyAssignmentException" });
  }

  function indexHolen(obj, index) {
    if (obj === null || obj === undefined) throw ungueltig("Cannot index into a null array.", { id: "NullArray" });
    if (Array.isArray(index)) return index.map((i) => indexHolen(obj, i)).filter((x) => x !== null);
    if (obj instanceof PSHashtable) return obj.hole(index);
    if (Array.isArray(obj) || typeof obj === "string") {
      let i = zahlWert(nachZahl(index));
      if (i < 0) i += obj.length;
      if (i < 0 || i >= obj.length) return null;
      return typeof obj === "string" ? obj.charAt(i) : obj[i];
    }
    if (obj instanceof PSObjekt && typeof index === "string") return eig(obj, index);
    const i = zahlWert(nachZahl(index));
    return i === 0 || i === -1 ? obj : null;
  }

  /* ---------- Methoden ---------- */

  function argZahl(args, i, standard) { return args.length > i ? zahlWert(nachZahl(args[i])) : standard; }
  function argText(args, i, standard) { return args.length > i ? textVon(args[i]) : standard; }
  function ausnahmeBeiAufruf(name, args, meldung) {
    return abbruch({ meldung: 'Exception calling "' + name + '" with "' + args.length + '" argument(s): "' + meldung + '"', art: "MethodInvocationException", kategorie: "NotSpecified", ausnahme: "System.Management.Automation.MethodInvocationException" });
  }

  function methodeNachTyp(sitzung, obj, n, args, ber) {
    if (typeof obj === "string") return stringMethode(obj, n, args);
    if (istZahl(obj)) {
      if (n === "tostring") return args.length ? zahlFormat(obj, textVon(args[0])) : zahlText(obj);
      if (n === "compareto") return vergleichen(obj, args[0]);
      return KEINE_METHODE;
    }
    if (typeof obj === "boolean") { if (n === "tostring") return textVon(obj); if (n === "compareto") return vergleichen(obj, args[0]); return KEINE_METHODE; }
    if (obj instanceof PSDatum) {
      const add = { adddays: 86400000, addhours: 3600000, addminutes: 60000, addseconds: 1000, addmilliseconds: 1 };
      if (add[n]) return new PSDatum(obj.ms + Math.round(argZahl(args, 0, 0) * add[n]));
      if (n === "addmonths") return monateAddieren(obj, argZahl(args, 0, 0));
      if (n === "addyears") return monateAddieren(obj, 12 * argZahl(args, 0, 0));
      if (n === "tostring") return args.length ? datumFormat(obj, textVon(args[0])) : datumKurz(obj);
      if (n === "toshortdatestring") return datumFormat(obj, "d");
      if (n === "tolongdatestring") return datumFormat(obj, "D");
      if (n === "toshorttimestring") return datumFormat(obj, "t");
      if (n === "tolongtimestring") return datumFormat(obj, "T");
      if (n === "subtract") return args[0] instanceof PSDatum ? new PSZeitspanne(obj.ms - args[0].ms) : new PSDatum(obj.ms - (args[0] instanceof PSZeitspanne ? args[0].ms : 0));
      if (n === "compareto") return vergleichen(obj, args[0]);
      if (n === "add") return new PSDatum(obj.ms + (args[0] instanceof PSZeitspanne ? args[0].ms : 0));
      return KEINE_METHODE;
    }
    if (obj instanceof PSZeitspanne) {
      if (n === "tostring") return zeitspanneText(obj);
      if (n === "add") return new PSZeitspanne(obj.ms + args[0].ms);
      if (n === "subtract") return new PSZeitspanne(obj.ms - args[0].ms);
      return KEINE_METHODE;
    }
    if (Array.isArray(obj)) {
      if (n === "contains") return obj.some((x) => x === args[0] || gleich(x, args[0], true));
      if (n === "indexof") return obj.findIndex((x) => gleich(x, args[0], true));
      if (n === "foreach") {
        const sb = args[0];
        if (sb instanceof Skriptblock) {
          const out = [];
          obj.forEach((x) => sitzung.skriptblockAusfuehren(sb, ber, { gleicherBereich: true, dollarUnter: x }).forEach((y) => out.push(y)));
          return out;
        }
        return obj.map((x) => memberHolen(x, textVon(sb), sitzung));
      }
      if (n === "where") {
        const sb = args[0];
        return obj.filter((x) => alsBool(sitzung.skriptblockWert(sb, ber, { dollarUnter: x })));
      }
      if (n === "clone") return obj.slice();
      return KEINE_METHODE;
    }
    if (obj instanceof PSHashtable) {
      switch (n) {
        case "containskey": case "contains": return obj.hat(args[0]);
        case "containsvalue": return obj.eintraege().some((e) => gleich(e.w, args[0], true));
        case "add":
          if (obj.hat(args[0])) throw ausnahmeBeiAufruf("Add", args, "Item has already been added. Key in dictionary: '" + textVon(args[0]) + "'  Key being added: '" + textVon(args[0]) + "'");
          obj.setzen(args[0], args.length > 1 ? args[1] : null);
          return KEIN_WERT;
        case "remove": obj.entfernen(args[0]); return KEIN_WERT;
        case "clear": obj._m.clear(); return KEIN_WERT;
        case "clone": return obj.kopie();
        case "getenumerator": return obj.eintraege().map((e) => eintragObjekt(e.k, e.w));
        default: return KEINE_METHODE;
      }
    }
    if (obj instanceof PSObjekt && obj._methoden) {
      const f = obj._methoden[n];
      if (f) { const r = f(args, sitzung); return r === undefined ? KEIN_WERT : r; }
    }
    if (obj instanceof FehlerDatensatz && n === "tostring") return obj.meldung;
    if (obj instanceof PSEnum && n === "tostring") return obj.name;
    return KEINE_METHODE;
  }
  const KEIN_WERT = null; // Methoden mit void geben nichts aus

  function eintragObjekt(k, w) {
    const o = new PSObjekt(["System.Collections.DictionaryEntry"], [["Name", k], ["Key", k], ["Value", w]], { Name: "AliasProperty", Key: "Property", Value: "Property" });
    return o;
  }

  function stringMethode(s, n, args) {
    const t = (i) => argText(args, i, "");
    switch (n) {
      case "toupper": case "toupperinvariant": return s.toUpperCase();
      case "tolower": case "tolowerinvariant": return s.toLowerCase();
      case "trim": return args.length ? trimZeichen(s, t(0), true, true) : s.trim();
      case "trimstart": return args.length ? trimZeichen(s, t(0), true, false) : s.replace(/^\s+/, "");
      case "trimend": return args.length ? trimZeichen(s, t(0), false, true) : s.replace(/\s+$/, "");
      case "replace": return s.split(t(0)).join(t(1));
      case "split": {
        if (!args.length) return s.split(/\s/);
        const trenner = Array.isArray(args[0]) ? args[0].map(textVon) : t(0).length > 1 && !(args.length > 1 && istZahl(args[1])) ? [t(0)] : [t(0)];
        let teile = [s];
        trenner.forEach((tr) => { teile = teile.flatMap((x) => (tr === "" ? [x] : x.split(tr))); });
        if (args.length > 1 && textVon(args[1]) === "RemoveEmptyEntries") teile = teile.filter((x) => x !== "");
        return teile;
      }
      case "startswith": return args.length > 1 && /ignorecase/i.test(t(1)) ? s.toLowerCase().startsWith(t(0).toLowerCase()) : s.startsWith(t(0));
      case "endswith": return args.length > 1 && /ignorecase/i.test(t(1)) ? s.toLowerCase().endsWith(t(0).toLowerCase()) : s.endsWith(t(0));
      case "contains": return args.length > 1 && /ignorecase/i.test(t(1)) ? s.toLowerCase().includes(t(0).toLowerCase()) : s.includes(t(0));
      case "indexof": return s.indexOf(t(0), argZahl(args, 1, 0));
      case "lastindexof": return s.lastIndexOf(t(0));
      case "substring": {
        const a = argZahl(args, 0, 0);
        const l = args.length > 1 ? argZahl(args, 1, 0) : s.length - a;
        if (a < 0 || a > s.length || l < 0 || a + l > s.length) {
          throw ausnahmeBeiAufruf("Substring", args, a > s.length ? "startIndex cannot be larger than length of string. (Parameter 'startIndex')" : "Index and length must refer to a location within the string. (Parameter 'length')");
        }
        return s.substr(a, l);
      }
      case "padleft": return s.padStart(argZahl(args, 0, 0), args.length > 1 ? t(1) : " ");
      case "padright": return s.padEnd(argZahl(args, 0, 0), args.length > 1 ? t(1) : " ");
      case "insert": return s.slice(0, argZahl(args, 0, 0)) + t(1) + s.slice(argZahl(args, 0, 0));
      case "remove": { const a = argZahl(args, 0, 0); return args.length > 1 ? s.slice(0, a) + s.slice(a + argZahl(args, 1, 0)) : s.slice(0, a); }
      case "tochararray": return s.split("");
      case "tostring": return s;
      case "compareto": return vergleichen(s, args[0]);
      case "normalize": return s.normalize();
      case "clone": return s;
      default: return KEINE_METHODE;
    }
  }
  function trimZeichen(s, zeichen, vorne, hinten) {
    const set = new Set(zeichen.split(""));
    let a = 0, b = s.length;
    if (vorne) while (a < b && set.has(s.charAt(a))) a++;
    if (hinten) while (b > a && set.has(s.charAt(b - 1))) b--;
    return s.slice(a, b);
  }

  /* ---------- Statische Member: [math]::Round(…) ---------- */

  function rundenStellen(w, stellen) {
    const f = Math.pow(10, stellen);
    const v = w * f;
    const unten = Math.floor(v), diff = v - unten;
    let r;
    if (Math.abs(diff - 0.5) < 1e-9) r = unten % 2 === 0 ? unten : unten + 1;
    else r = Math.round(v);
    return r / f;
  }

  function statischerZugriff(sitzung, t, name, args) {
    const n = klein(name);
    const voll = t.voll;
    const fehltMethode = () => ungueltig("Method invocation failed because [" + voll + "] does not contain a method named '" + name + "'.", { id: "MethodNotFound" });
    const zahlArg = (i) => zahlWert(nachZahl(args[i]));
    if (voll === "System.Math") {
      if (!args) {
        if (n === "pi") return Math.PI;
        if (n === "e") return Math.E;
        return null;
      }
      switch (n) {
        case "round": return alsDouble(args.length > 1 && istZahl(args[1]) ? rundenStellen(zahlArg(0), zahlArg(1)) : rundenStellen(zahlArg(0), 0));
        case "floor": return alsDouble(Math.floor(zahlArg(0)));
        case "ceiling": return alsDouble(Math.ceil(zahlArg(0)));
        case "truncate": return alsDouble(Math.trunc(zahlArg(0)));
        case "abs": { const z = nachZahl(args[0]); return istDouble(z) ? alsDouble(Math.abs(zahlWert(z))) : Math.abs(zahlWert(z)); }
        case "max": case "min": {
          const a = nachZahl(args[0]), b = nachZahl(args[1]);
          const r = Math[n](zahlWert(a), zahlWert(b));
          return istDouble(a) || istDouble(b) ? alsDouble(r) : r;
        }
        case "pow": return alsDouble(Math.pow(zahlArg(0), zahlArg(1)));
        case "sqrt": return alsDouble(Math.sqrt(zahlArg(0)));
        case "log": return alsDouble(args.length > 1 ? Math.log(zahlArg(0)) / Math.log(zahlArg(1)) : Math.log(zahlArg(0)));
        case "log10": return alsDouble(Math.log10(zahlArg(0)));
        case "exp": return alsDouble(Math.exp(zahlArg(0)));
        case "sign": return Math.sign(zahlArg(0));
        default: throw fehltMethode();
      }
    }
    if (voll === "System.Int32" || voll === "System.Int64") {
      if (!args) { if (n === "maxvalue") return voll === "System.Int32" ? INT32_MAX : 9223372036854775807; if (n === "minvalue") return voll === "System.Int32" ? INT32_MIN : -9223372036854775808; return null; }
      if (n === "parse") return konvertieren(args[0], t);
      throw fehltMethode();
    }
    if (voll === "System.Double") {
      if (!args) return n === "maxvalue" ? alsDouble(Number.MAX_VALUE) : n === "nan" ? NaN : null;
      if (n === "parse") return konvertieren(args[0], t);
      throw fehltMethode();
    }
    if (voll === "System.DateTime") {
      if (!args) {
        if (n === "now") return new PSDatum(JETZT.ms);
        if (n === "today") { const p = datumTeile(new PSDatum(JETZT.ms)); return datumAus(p.j, p.m, p.t); }
        return null;
      }
      if (n === "parse") { const d = datumLesen(textVon(args[0]), true); if (!d) throw ausnahmeBeiAufruf("Parse", args, "String '" + textVon(args[0]) + "' was not recognized as a valid DateTime."); return d; }
      if (n === "daysinmonth") return new Date(Date.UTC(zahlArg(0), zahlArg(1), 0)).getUTCDate();
      if (n === "isleapyear") { const j = zahlArg(0); return (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0; }
      throw fehltMethode();
    }
    if (voll === "System.String") {
      if (!args) return n === "empty" ? "" : null;
      if (n === "isnullorempty") return args[0] === null || textVon(args[0]) === "";
      if (n === "isnullorwhitespace") return args[0] === null || textVon(args[0]).trim() === "";
      if (n === "join") return (args.length === 2 ? alsListe(args[1]) : args.slice(1)).map(textImString).join(textVon(args[0]));
      if (n === "format") return formatComposite(textVon(args[0]), args.length === 2 && Array.isArray(args[1]) ? args[1] : args.slice(1));
      if (n === "concat") return args.map(textVon).join("");
      throw fehltMethode();
    }
    if (voll === "System.Environment") {
      if (!args) {
        if (n === "username") return sitzung.welt.benutzer;
        if (n === "machinename") return sitzung.welt.computer;
        if (n === "newline") return "\r\n";
        if (n === "currentdirectory") return sitzung.ortText("C");
        if (n === "processorcount") return 8;
        return null;
      }
      if (n === "getenvironmentvariable") return sitzung.welt.envHolen(textVon(args[0]));
      throw fehltMethode();
    }
    if (voll === "System.IO.Path") {
      if (!args) return n === "directoryseparatorchar" ? "\\" : null;
      const p = textVon(args[0]);
      const name = p.split(/[\\/]/).pop();
      switch (n) {
        case "getfilename": return name;
        case "getextension": { const i = name.lastIndexOf("."); return i > 0 ? name.slice(i) : ""; }
        case "getfilenamewithoutextension": { const i = name.lastIndexOf("."); return i > 0 ? name.slice(0, i) : name; }
        case "getdirectoryname": { const i = p.search(/[\\/][^\\/]*$/); return i > 0 ? p.slice(0, i) : null; }
        case "combine": return args.map(textVon).reduce((a, b) => (/^[a-z]:|^\\/i.test(b) ? b : a.replace(/\\$/, "") + "\\" + b));
        default: throw fehltMethode();
      }
    }
    if (voll === "System.Array" || voll === "System.Object[]") {
      if (args && n === "indexof") return alsListe(args[0]).findIndex((x) => gleich(x, args[1], true));
      if (args && n === "reverse") { if (Array.isArray(args[0])) args[0].reverse(); return KEIN_WERT; }
    }
    if (!args) return null;
    throw fehltMethode();
  }

  /* ======================================================================
     7. Formatierer: Objekte → Zeilen wie pwsh 7 (Fensterbreite 120)
     Eine Zeile ist ein Array von Teilen [Text, Klasse]. Klassen färben die Konsole:
       kopf (Tabellenkopf, grün), fehler (rot), warnung (gelb), hinweis (Simulator),
       ordner, programm, skript, archiv (Dateinamen), host-<farbe> (Write-Host)
     ====================================================================== */

  const zeile = (text, klasse) => [[text, klasse || null]];
  const zeilenText = (z) => z.map((t) => t[0]).join("").replace(/\s+$/, "");

  function istEinfach(v) {
    return typeof v === "string" || typeof v === "boolean" || istZahl(v) || v instanceof PSEnum || v instanceof Skriptblock;
  }

  // Wert für eine Tabellenzelle (Doubles mit zwei Nachkommastellen wie pwsh 7)
  function zelle(v, tabelle) {
    if (v instanceof Faul) v = v.fn();
    if (v === null || v === undefined) return "";
    if (istZahl(v)) return istDouble(v) && tabelle ? festText(zahlWert(v), 2, false) : zahlText(v);
    if (Array.isArray(v)) return aufzaehlungText(v);
    if (v instanceof PSHashtable) return aufzaehlungText(v.eintraege().map((e) => "[" + textVon(e.k) + ", " + textVon(e.w) + "]"));
    if (v instanceof PSObjekt && v.typen.includes("System.IO.DirectoryInfo") && v._kurz) return v._kurz;
    return textVon(v).replace(/\r?\n/g, " ");
  }
  function aufzaehlungText(liste) {
    const grenze = 4;
    const teile = liste.slice(0, grenze).map((x) => (typeof x === "string" ? x : textVon(x)));
    return "{" + teile.join(", ") + (liste.length > grenze ? AUSLASSUNG : "") + "}";
  }
  const rechtsBuendig = (v) => istZahl(v) || typeof v === "boolean" || v instanceof PSEnum;

  /* ---------- Tabellen ---------- */

  // spalten: [{ kopf, rechts, breite (fest) oder null, kopf2 (zweite Kopfzeile) }]
  // zeilenWerte: Array von Arrays mit Zelltexten. Gibt { kopf: [Zeilen], zeilen: [Zeilen] } zurück.
  function tabelle(spalten, zeilenWerte, o) {
    o = o || {};
    const n = spalten.length;
    const breiten = spalten.map((s, i) => {
      if (s.breite) return s.breite;
      let b = s.kopf.length;
      if (s.kopf2) b = Math.max(b, s.kopf2.length);
      zeilenWerte.forEach((z) => { b = Math.max(b, String(z[i] === undefined ? "" : z[i]).split("\n")[0].length); });
      return b;
    });
    // Letzte Spalte füllt den Rest; zu breite Tabellen werden gekürzt
    let summe = 0;
    for (let i = 0; i < n; i++) {
      const rest = BREITE - summe - (i > 0 ? 1 : 0);
      if (i === n - 1) {
        if (spalten[i].fuellen) breiten[i] = rest;
        else breiten[i] = Math.min(breiten[i], rest);
      } else if (breiten[i] > rest) breiten[i] = rest;
      summe += breiten[i] + (i > 0 ? 1 : 0);
    }
    let sichtbar = n;
    while (sichtbar > 1 && breiten[sichtbar - 1] <= 0) sichtbar--;
    const zeileBauen = (werte, klasse, istKopf) => {
      const teile = [];
      for (let i = 0; i < sichtbar; i++) {
        const s = spalten[i];
        let t = kuerzen(String(werte[i] === undefined || werte[i] === null ? "" : werte[i]), breiten[i]);
        const letzte = i === sichtbar - 1;
        t = s.rechts ? rechts(t, breiten[i]) : letzte ? t : links(t, breiten[i]);
        if (i > 0) teile.push([" ", istKopf ? klasse : null]);
        teile.push([t, typeof klasse === "function" ? klasse(i, werte) : klasse]);
      }
      return teile;
    };
    const kopf = [];
    if (!o.ohneKopf) {
      kopf.push(zeileBauen(spalten.map((s) => s.kopf), "kopf", true));
      if (spalten.some((s) => s.kopf2)) kopf.push(zeileBauen(spalten.map((s) => s.kopf2 || ""), "kopf", true));
      kopf.push(zeileBauen(spalten.map((s) => "-".repeat(s.kopf.length)).map((t, i) => (spalten[i].strich ? spalten[i].strich : t)), "kopf", true));
    }
    const zeilen = zeilenWerte.map((w) => zeileBauen(w, o.klasse || null, false));
    return { kopf: kopf, zeilen: zeilen, breiten: breiten };
  }

  /* ---------- Listen ---------- */

  function listeZeilen(paare) {
    const breite = paare.reduce((m, p) => Math.max(m, p[0].length), 0);
    const zeilen = [];
    paare.forEach(([name, wert]) => {
      const label = links(name, breite) + " : ";
      const einzug = " ".repeat(label.length);
      const platz = BREITE - label.length;
      const stuecke = [];
      String(wert).split(/\r?\n/).forEach((teil) => {
        if (platz <= 0 || teil.length <= platz) { stuecke.push(teil); return; }
        for (let i = 0; i < teil.length; i += platz) stuecke.push(teil.slice(i, i + platz));
      });
      stuecke.forEach((s, i) => zeilen.push(i === 0 ? [[label, "kopf"], [s, null]] : [[einzug + s, null]]));
    });
    return zeilen;
  }
  const listenWert = (v) => {
    if (v instanceof Faul) v = v.fn();
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return aufzaehlungText(v);
    if (v instanceof PSHashtable) return aufzaehlungText(v.eintraege().map((e) => "[" + textVon(e.k) + ", " + textVon(e.w) + "]"));
    if (istZahl(v)) return zahlText(v);
    return textVon(v);
  };

  /* ---------- Standardansichten je Typ ---------- */

  const MODE = (k) => (k.ordner ? "d" : "-") + (k.ordner ? "-" : "a") + (k.nurLesen ? "r" : "-") + (k.versteckt ? "h" : "-") + "-";
  function dateiKlasse(o) {
    const name = textVon(eig(o, "Name"));
    if (o.typ === "System.IO.DirectoryInfo") return "ordner";
    if (/\.(exe|com|bat|cmd)$/i.test(name)) return "programm";
    if (/\.(ps1|psm1|psd1|ps1xml)$/i.test(name)) return "skript";
    if (/\.(zip|tgz|gz|tar|nupkg|cab|7z)$/i.test(name)) return "archiv";
    return null;
  }
  const datumSpalte = (d) => datumFormat(d, "dd.MM.yyyy") + " " + rechts(datumFormat(d, "HH:mm"), 8);

  // Ansicht für ein Objekt: { schluessel, art: "tabelle"|"liste"|"datum"|"fertig", … }
  function ansichtFuer(v) {
    if (v instanceof PSDatum) return { schluessel: "datum", art: "datum" };
    if (v instanceof PSZeitspanne) return { schluessel: "zeitspanne", art: "liste", eigenschaften: ["Days", "Hours", "Minutes", "Seconds", "Milliseconds", "Ticks", "TotalDays", "TotalHours", "TotalMinutes", "TotalSeconds", "TotalMilliseconds"] };
    if (v instanceof PSHashtable) return { schluessel: "hash", art: "tabelle", ansicht: "hash" };
    if (v instanceof PSTyp) return { schluessel: "typ", art: "tabelle", ansicht: "typ" };
    if (v instanceof PSObjekt) {
      if (v._zeilen) return { schluessel: "format", art: "fertig" };
      const t = v.typ;
      const fest = ANSICHTEN[t];
      if (fest) return Object.assign({ schluessel: fest.ansicht === "datei" || fest.ansicht === "befehl" ? fest.ansicht : t }, fest);
      const namen = v.namen().filter((n) => !v._versteckt || !v._versteckt.includes(n));
      return { schluessel: v.typen.some((x) => x.startsWith("Selected.")) ? v.typ : v.typen.includes(CUSTOM) ? CUSTOM : t,
        art: namen.length <= 4 ? "tabelle" : "liste", ansicht: "auto" };
    }
    return { schluessel: "?", art: "liste", ansicht: "auto" };
  }

  // Feste Ansichten (Spaltenbreiten aus den Formatdateien von pwsh 7)
  const ANSICHTEN = {
    "System.IO.FileInfo": { art: "tabelle", ansicht: "datei", gruppe: "Directory" },
    "System.IO.DirectoryInfo": { art: "tabelle", ansicht: "datei", gruppe: "Directory" },
    "System.Diagnostics.Process": { art: "tabelle", ansicht: "prozess" },
    "System.ServiceProcess.ServiceController": { art: "tabelle", ansicht: "dienst" },
    "System.Collections.DictionaryEntry": { art: "tabelle", ansicht: "hash" },
    "Microsoft.PowerShell.Commands.GroupInfo": { art: "tabelle", ansicht: "gruppe" },
    "Microsoft.PowerShell.Commands.GroupInfoNoElement": { art: "tabelle", ansicht: "gruppeOhne" },
    "Microsoft.PowerShell.Commands.GenericMeasureInfo": { art: "liste", eigenschaften: ["Count", "Average", "Sum", "Maximum", "Minimum", "StandardDeviation", "Property"] },
    "System.Management.Automation.CmdletInfo": { art: "tabelle", ansicht: "befehl" },
    "System.Management.Automation.AliasInfo": { art: "tabelle", ansicht: "befehl" },
    "System.Management.Automation.FunctionInfo": { art: "tabelle", ansicht: "befehl" },
    "System.Management.Automation.PSDriveInfo": { art: "tabelle", ansicht: "laufwerk" },
    "Microsoft.PowerShell.Commands.HistoryInfo": { art: "tabelle", ansicht: "verlauf" },
    "Microsoft.PowerShell.Commands.MemberDefinition": { art: "tabelle", ansicht: "member", gruppe: "TypeName" },
    "Microsoft.PowerShell.Commands.TestConnectionCommand+PingStatus": { art: "tabelle", ansicht: "ping", gruppe: "Destination" },
    "Microsoft.Win32.RegistryKey": { art: "tabelle", ansicht: "registry", gruppe: "Hive" },
    "System.Management.Automation.PathInfo": { art: "tabelle", ansicht: "pfad" },
  };

  function gruppenKopf(ansicht, o) {
    if (ansicht.gruppe === "Directory") return "    Directory: " + (o._elternText || "");
    if (ansicht.gruppe === "TypeName") return "   TypeName: " + textVon(eig(o, "TypeName"));
    if (ansicht.gruppe === "Destination") return "   Destination: " + textVon(eig(o, "Destination"));
    if (ansicht.gruppe === "Hive") return "    Hive: " + textVon(eig(o, "Hive"));
    return null;
  }

  // Spalten und Zellwerte einer Tabellenansicht
  function tabellenDefinition(ansicht, objekte) {
    const e = (o, n) => eig(o, n);
    switch (ansicht.ansicht) {
      case "datei": return {
        spalten: [{ kopf: "Mode", breite: 7 }, { kopf: "LastWriteTime", breite: 26, rechts: true }, { kopf: "Length", breite: 14, rechts: true }, { kopf: "Name" }],
        werte: (o) => [e(o, "Mode"), datumSpalte(e(o, "LastWriteTime")), o.typ === "System.IO.FileInfo" ? String(e(o, "Length")) : "", e(o, "Name")],
        klasse: (o) => (i) => (i === 3 ? dateiKlasse(o) : null),
      };
      case "prozess": return {
        spalten: [{ kopf: "NPM(K)", breite: 7, rechts: true }, { kopf: "PM(M)", breite: 8, rechts: true }, { kopf: "WS(M)", breite: 10, rechts: true },
          { kopf: "CPU(s)", breite: 10, rechts: true }, { kopf: "Id", breite: 7, rechts: true }, { kopf: "SI", breite: 3, rechts: true }, { kopf: "ProcessName" }],
        werte: (o) => [String(Math.round(zahlWert(e(o, "NPM")) / 1024)), festText(zahlWert(e(o, "PM")) / 1048576, 2, true), festText(zahlWert(e(o, "WS")) / 1048576, 2, true),
          festText(zahlWert(e(o, "CPU") || 0), 2, true), String(e(o, "Id")), String(e(o, "SI")), e(o, "ProcessName")],
      };
      case "dienst": return {
        spalten: [{ kopf: "Status", breite: 8 }, { kopf: "Name", breite: 18 }, { kopf: "DisplayName", breite: 38 }],
        werte: (o) => [textVon(e(o, "Status")), textVon(e(o, "Name")), textVon(e(o, "DisplayName"))],
      };
      case "hash": return {
        spalten: [{ kopf: "Name", breite: 30 }, { kopf: "Value" }],
        zeilenVon: (o) => (o instanceof PSHashtable ? o.eintraege().map((x) => [textVon(x.k), zelle(x.w, true)]) : [[textVon(e(o, "Name")), zelle(e(o, "Value"), true)]]),
      };
      case "typ": return {
        spalten: [{ kopf: "IsPublic", breite: 8 }, { kopf: "IsSerial", breite: 8 }, { kopf: "Name", breite: 40 }, { kopf: "BaseType" }],
        werte: (o) => ["True", "True", o.info.name, o.info.basis || ""],
      };
      case "gruppe": return {
        spalten: [{ kopf: "Count", breite: 5, rechts: true }, { kopf: "Name", breite: 25 }, { kopf: "Group" }],
        werte: (o) => [String(e(o, "Count")), textVon(e(o, "Name")), aufzaehlungText(e(o, "Group") || [])],
      };
      case "gruppeOhne": return {
        spalten: [{ kopf: "Count", breite: 5, rechts: true }, { kopf: "Name" }],
        werte: (o) => [String(e(o, "Count")), textVon(e(o, "Name"))],
      };
      case "befehl": return {
        spalten: [{ kopf: "CommandType", breite: 15 }, { kopf: "Name", breite: 50 }, { kopf: "Version", breite: 10 }, { kopf: "Source" }],
        werte: (o) => [textVon(e(o, "CommandType")), e(o, "CommandType") && textVon(e(o, "CommandType")) === "Alias" ? textVon(e(o, "DisplayName")) : textVon(e(o, "Name")), textVon(e(o, "Version") || ""), textVon(e(o, "Source") || "")],
      };
      case "laufwerk": return {
        spalten: [{ kopf: "Name", breite: 10 }, { kopf: "Used (GB)", breite: 13, rechts: true }, { kopf: "Free (GB)", breite: 13, rechts: true },
          { kopf: "Provider", breite: 13 }, { kopf: "Root", breite: 35 }, { kopf: "CurrentLocation", rechts: true, fuellen: true }],
        werte: (o) => [textVon(e(o, "Name")), e(o, "Used") === null ? "" : festText(zahlWert(e(o, "Used")) / 1073741824, 2, false),
          e(o, "Free") === null ? "" : festText(zahlWert(e(o, "Free")) / 1073741824, 2, false), textVon(e(o, "ProviderName")), textVon(e(o, "Root")), textVon(e(o, "CurrentLocation"))],
      };
      case "verlauf": return {
        spalten: [{ kopf: "Id", breite: 4, rechts: true }, { kopf: "Duration", breite: 12, rechts: true }, { kopf: "CommandLine" }],
        werte: (o) => [String(e(o, "Id")), festText(zahlWert(e(o, "DurationSeconds")), 3, false), textVon(e(o, "CommandLine"))],
      };
      case "ping": return {
        spalten: [{ kopf: "Ping", breite: 4, rechts: true }, { kopf: "Source", breite: 16 }, { kopf: "Address", breite: 25 },
          { kopf: "Latency", kopf2: "(ms)", breite: 7, rechts: true, strich: "-------" }, { kopf: "BufferSize", kopf2: "(B)", breite: 10, rechts: true, strich: "----------" }, { kopf: "Status", breite: 16 }],
        werte: (o) => [String(e(o, "Ping")), textVon(e(o, "Source")), textVon(e(o, "Address")), e(o, "Latency") === null ? "*" : String(e(o, "Latency")), e(o, "Latency") === null ? "*" : "32", textVon(e(o, "Status"))],
      };
      case "registry": return {
        spalten: [{ kopf: "Name", breite: 30 }, { kopf: "Property" }],
        zeilenVon: (o) => {
          const werte = e(o, "Werte") || [];
          if (!werte.length) return [[textVon(e(o, "PSChildName")), ""]];
          const b = werte.reduce((m, w) => Math.max(m, w[0].length), 0);
          return werte.map((w, i) => [i === 0 ? textVon(e(o, "PSChildName")) : "", links(w[0], b) + " : " + textVon(w[1])]);
        },
      };
      case "pfad": return { spalten: [{ kopf: "Path" }], werte: (o) => [textVon(e(o, "Path"))] };
      case "member": return {
        spalten: [{ kopf: "Name" }, { kopf: "MemberType" }, { kopf: "Definition" }],
        werte: (o) => [textVon(e(o, "Name")), textVon(e(o, "MemberType")), textVon(e(o, "Definition"))],
      };
      default: {
        // Automatische Tabelle: Eigenschaften des ersten Objekts, rechtsbündig bei Zahlen, Bool, Enum
        const erstes = objekte[0];
        const namen = erstes.namen().filter((n) => !erstes._versteckt || !erstes._versteckt.includes(n));
        return {
          spalten: namen.map((n) => ({ kopf: n, rechts: rechtsBuendig(eig(erstes, n)) })),
          werte: (o) => namen.map((n) => (o instanceof PSObjekt && o.hat(n) ? zelle(eig(o, n), true) : "")),
        };
      }
    }
  }

  function listePaare(ansicht, o) {
    if (o instanceof PSDatum) return ["DisplayHint", "Date", "Day", "DayOfWeek", "DayOfYear", "Hour", "Kind", "Millisecond", "Microsecond", "Nanosecond", "Minute", "Month", "Second", "Ticks", "TimeOfDay", "Year", "DateTime"]
      .map((n) => [n, n === "DisplayHint" ? "DateTime" : listenWert(memberHolen(o, n))]);
    const namen = ansicht.eigenschaften || (o instanceof PSObjekt ? o.namen().filter((n) => !o._versteckt || !o._versteckt.includes(n)) : []);
    return namen.map((n) => [n, listenWert(o instanceof PSObjekt ? eig(o, n) : memberHolen(o, n))]);
  }

  // Ausgabe eines Fehlers wie pwsh 7 ($ErrorView = ConciseView)
  function fehlerZeilen(ds) {
    const k = "fehler";
    const praefix = ds.befehl || ds.art || ds.ausnahme.split(".").pop();
    const p = ds.pos;
    if (p && (p.datei || ds.art === "ParserError")) {
      const z = zeileVon(p.quelle, p.start);
      const out = [zeile(praefix + ": " + (p.datei ? p.datei + ":" + z.nr : ""), k), zeile("Line |", k)];
      const nr = rechts(String(z.nr), 4);
      out.push(zeile(nr + " |  " + z.text, k));
      const bis = Math.min(p.ende, z.ende);
      const laenge = Math.max(1, bis - p.start);
      out.push(zeile("     |  " + " ".repeat(Math.max(0, p.start - z.anfang)) + "~".repeat(laenge), k));
      umbrechen(ds.meldung.replace(/\n/g, " "), BREITE - 7).forEach((t) => out.push(zeile("     | " + t, k)));
      if (ds.hinweis) ds.hinweis.split("\n").forEach((t) => out.push(zeile(t, "hinweis")));
      return out;
    }
    const out = (praefix + ": " + ds.meldung).split("\n").map((t) => zeile(t, k));
    if (ds.hinweis) ds.hinweis.split("\n").forEach((t) => out.push(zeile(t, "hinweis")));
    return out;
  }
  function zeileVon(quelle, pos) {
    const text = quelle || "";
    const anfang = text.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
    let ende = text.indexOf("\n", pos);
    if (ende < 0) ende = text.length;
    return { nr: text.slice(0, anfang).split("\n").length, text: text.slice(anfang, ende).replace(/\r$/, ""), anfang: anfang, ende: ende };
  }
  function umbrechen(text, breite) {
    const out = [];
    let rest = text;
    while (rest.length > breite) {
      let i = rest.lastIndexOf(" ", breite);
      if (i <= 0) i = breite;
      out.push(rest.slice(0, i));
      rest = rest.slice(i).replace(/^ /, "");
    }
    out.push(rest);
    return out;
  }

  // Strom einer Eingabezeile → Gruppen von Zeilen { quelle: Index im Strom (-1 = Abschluss), zeilen }
  function formatieren(strom, optionen) {
    optionen = optionen || {};
    const gruppen = [];
    let fortsetzen = null; // Write-Host -NoNewline: nächster Text auf derselben Zeile
    let zustand = null;
    const flach = [];
    strom.forEach((s, i) => {
      if (s.art === "objekt" && Array.isArray(s.wert)) s.wert.forEach((x) => flach.push({ art: "objekt", wert: x, i: i }));
      else flach.push(Object.assign({ i: i }, s));
    });
    const schliessen = (i) => {
      if (zustand && zustand.art !== "liste") gruppen.push({ quelle: i, zeilen: [zeile("")] });
      if (zustand && zustand.art === "liste") gruppen.push({ quelle: i, zeilen: [zeile("")] });
      zustand = null;
    };
    for (let j = 0; j < flach.length; j++) {
      const s = flach[j];
      const z = [];
      switch (s.art) {
        case "host": {
          const klasse = s.farbe ? "host-" + klein(s.farbe) : null;
          s.text.split("\n").forEach((t, k) => {
            if (k === 0 && fortsetzen) fortsetzen.push([t, klasse]);
            else z.push(zeile(t, klasse));
          });
          const letzte = z.length ? z[z.length - 1] : fortsetzen;
          fortsetzen = s.ohneUmbruch ? letzte : null;
          gruppen.push({ quelle: s.i, zeilen: z });
          continue;
        }
        case "fehler": fehlerZeilen(s.datensatz).forEach((x) => z.push(x)); break;
        case "warnung": umbrechen("WARNING: " + s.text, BREITE).forEach((t) => z.push(zeile(t, "warnung"))); break;
        case "hinweis": z.push(zeile("[Simulator] " + s.text, "hinweis")); break;
        case "rueckfrage": s.text.split("\n").forEach((t, k) => z.push(zeile(t, k === 0 ? "kopf" : null)));
          z.push(zeile('[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"): ' + s.antwort)); break;
        case "leeren": schliessen(s.i); z.push("LEEREN"); break;
        case "objekt": objektZeilen(s.wert, j, z); break;
        default: break;
      }
      fortsetzen = null;
      gruppen.push({ quelle: s.i, zeilen: z });
    }
    if (zustand) schliessen(-1);
    return gruppen;

    function objektZeilen(v, j, z) {
      if (v === null || v === undefined) return;
      if (v instanceof FehlerDatensatz) { fehlerZeilen(v).forEach((x) => z.push(x)); return; }
      if (istEinfach(v)) { textVon(v).split(/\r?\n/).forEach((t) => z.push(zeile(t))); return; }
      const a = ansichtFuer(v);
      if (a.art === "fertig") { v._zeilen.forEach((x) => z.push(x)); return; }
      if (zustand && zustand.schluessel !== a.schluessel) {
        // Anderer Typ als die laufende Tabelle: als Liste wie pwsh 7
        z.push(zeile(""));
        listeZeilen(listePaare(a.art === "liste" ? a : {}, v)).forEach((x) => z.push(x));
        return;
      }
      if (a.art === "datum") {
        if (!zustand) { zustand = { schluessel: "datum", art: "datum" }; z.push(zeile("")); }
        const hinweisArt = v._anzeige ? klein(v._anzeige) : "datetime";
        z.push(zeile(hinweisArt === "date" ? datumFormat(v, "D") : hinweisArt === "time" ? datumFormat(v, "T") : datumLang(v)));
        return;
      }
      if (a.art === "liste") {
        zustand = zustand || { schluessel: a.schluessel, art: "liste" };
        const kopf = a.gruppe ? gruppenKopf(a, v) : null;
        z.push(zeile(""));
        if (kopf && kopf !== zustand.gruppe) { zustand.gruppe = kopf; z.push(zeile(kopf)); z.push(zeile("")); }
        listeZeilen(listePaare(a, v)).forEach((x) => z.push(x));
        return;
      }
      // Tabelle: beim ersten Objekt Breiten aus allen gleichartigen Objekten bestimmen
      if (!zustand) {
        const gleiche = [];
        for (let k = j; k < flach.length; k++) {
          const x = flach[k];
          if (x.art !== "objekt" || x.wert === null || x.wert === undefined || istEinfach(x.wert)) continue;
          if (ansichtFuer(x.wert).schluessel === a.schluessel) gleiche.push(x.wert);
        }
        const def = tabellenDefinition(a, gleiche);
        if (optionen.autosize) def.spalten = def.spalten.map((sp) => Object.assign({}, sp, { breite: null, fuellen: false }));
        const alleWerte = [];
        gleiche.forEach((o) => (def.zeilenVon ? def.zeilenVon(o) : [def.werte(o)]).forEach((w) => alleWerte.push(w)));
        const t = tabelle(def.spalten, alleWerte);
        zustand = { schluessel: a.schluessel, art: "tabelle", def: def, t: t, gruppe: null, ansicht: a };
      }
      const kopfText = a.gruppe ? gruppenKopf(a, v) : null;
      if (zustand.gruppe === null || (kopfText && kopfText !== zustand.gruppe)) {
        z.push(zeile(""));
        if (kopfText) { z.push(zeile(kopfText)); z.push(zeile("")); }
        zustand.t.kopf.forEach((x) => z.push(x));
        zustand.gruppe = kopfText || "";
      }
      const def = zustand.def;
      const werte = def.zeilenVon ? def.zeilenVon(v) : [def.werte(v)];
      werte.forEach((w) => {
        const einzel = tabelle(def.spalten.map((s, i) => Object.assign({}, s, { breite: zustand.t.breiten[i], fuellen: false })), [w], { ohneKopf: true, klasse: def.klasse ? def.klasse(v) : null });
        einzel.zeilen.forEach((x) => z.push(x));
      });
    }
  }

  // Formatierte Ausgabe als reiner Text (für Out-File, >, Out-String und ausfuehren())
  function formatierenAlsText(objekte) {
    const gruppen = formatieren(objekte.map((o) => ({ art: "objekt", wert: o })));
    const zeilen = [];
    gruppen.forEach((g) => g.zeilen.forEach((z) => { if (z !== "LEEREN") zeilen.push(zeilenText(z)); }));
    return zeilen.join("\n");
  }

  // Format-Table, Format-List, Format-Wide: fertige Zeilen als «Formatobjekte»
  const FORMAT_KLASSEN = [
    ["Microsoft.PowerShell.Commands.Internal.Format.FormatStartData", "033ecb2bc07a4d43b5ef94ed5a35d280"],
    ["Microsoft.PowerShell.Commands.Internal.Format.GroupStartData", "9e210fe47d09416682b841769c78b8a3"],
    ["Microsoft.PowerShell.Commands.Internal.Format.FormatEntryData", "27c87ef9bbda4f709f6b4002fa4af63c"],
    ["Microsoft.PowerShell.Commands.Internal.Format.GroupEndData", "4ec4f0187cb04f4cb6973460dfe252df"],
    ["Microsoft.PowerShell.Commands.Internal.Format.FormatEndData", "cf522b78d86c486691226b40aa69e95c"],
  ];
  function formatObjekte(zeilen, anzahl, tabellarisch) {
    const liste = [];
    const neu = (k, extra) => {
      const [typName, id] = FORMAT_KLASSEN[k];
      const o = new PSObjekt([typName], [["ClassId2e4f51ef21dd47e99d3c952918aff9cd", id], ["pageHeaderEntry", null], ["pageFooterEntry", null],
        ["autosizeInfo", null], ["shapeInfo", k === 0 ? (tabellarisch ? "Microsoft.PowerShell.Commands.Internal.Format.TableHeaderInfo" : "Microsoft.PowerShell.Commands.Internal.Format.ListViewHeaderInfo") : null],
        ["groupingEntry", k === 1 ? "Microsoft.PowerShell.Commands.Internal.Format.GroupingEntry" : null]].concat(extra || []), {});
      o._zeilen = [];
      return o;
    };
    const start = neu(0);
    start._zeilen = zeilen;
    liste.push(start, neu(1));
    for (let i = 0; i < anzahl; i++) liste.push(neu(2, [["formatEntryInfo", "Microsoft.PowerShell.Commands.Internal.Format.TableRowEntry"], ["outOfBand", false], ["writeStream", "None"]]));
    liste.push(neu(3), neu(4));
    return liste;
  }

  /* ======================================================================
     8. Cmdlet-Tabelle
     Jedes Cmdlet: { name, modul, syntax (echte Syntaxzeilen aus pwsh 7.6), pipeline (Parameter,
     die Pipeline-Eingabe annehmen), run(ctx) → Ausgabeobjekte }. Reihenfolge, Zweitnamen (paramAliase) und dynamische
     Parameter (dynamisch) kommen aus PARAMETER_PWSH und DYNAMISCHE_PARAMETER. nurBekannt: echtes Cmdlet, das
     Get-Command auflistet, das der Simulator aber nicht nachbaut (Aufruf → Hinweis).
     ctx: p (gebundene Parameter, Namen klein), eingabe (Pipeline), aus(), fehler(), abbruch(),
          sollen(operation, ziel) für -WhatIf/-Confirm, host(), hinweis(), warnung()
     ====================================================================== */

  const CMDLETS = {};
  const MODUL = { M: "Microsoft.PowerShell.Management", U: "Microsoft.PowerShell.Utility", C: "Microsoft.PowerShell.Core", S: "Microsoft.PowerShell.Security" };
  function cmdlet(name, modul, def) {
    def.name = name;
    def.modul = MODUL[modul] || "";
    def.version = modul === "C" ? "7.6.0.500" : modul === "F" ? "" : "7.0.0.0";
    def.art = modul === "F" ? "Function" : "Cmdlet";
    def.syntax = def.syntax || SYNTAX[name] || [name + " [<CommonParameters>]"];
    // "Path LiteralPath=PSPath,LP" → reihenfolge ["Path", "LiteralPath"], paramAliase { LiteralPath: ["PSPath", "LP"] }
    def.paramAliase = {};
    def.reihenfolge = [];
    (PARAMETER_PWSH[name] || "").split(" ").filter(Boolean).forEach((t) => {
      const [p, a] = t.split("=");
      def.reihenfolge.push(p);
      if (a) def.paramAliase[p] = a.split(",");
    });
    def.dynamisch = DYNAMISCHE_PARAMETER[name] ? DYNAMISCHE_PARAMETER[name].split(",") : [];
    CMDLETS[klein(name)] = def;
    return def;
  }

  /* ---------- Fehler des Dateisystems ---------- */

  const nichtGefunden = (pfad) => ({ meldung: "Cannot find path '" + pfad + "' because it does not exist.", kategorie: "ObjectNotFound",
    ausnahme: "System.Management.Automation.ItemNotFoundException", id: "PathNotFound", ziel: pfad });
  const teilFehlt = (pfad) => ({ meldung: "Could not find a part of the path '" + pfad + "'.", kategorie: "WriteError",
    ausnahme: "System.IO.DirectoryNotFoundException", id: "NewItemIOError", ziel: pfad });
  const keinZugriff = (pfad) => ({ meldung: "Access to the path '" + pfad + "' is denied.", kategorie: "PermissionDenied",
    ausnahme: "System.UnauthorizedAccessException", id: "UnauthorizedAccess", ziel: pfad });
  const gibtsSchon = () => ({ meldung: "Cannot create a file when that file already exists.", kategorie: "WriteError", ausnahme: "System.IO.IOException", id: "MoveFileInfoItemIOError" });

  // Geschützte Systemordner (nur mit Adminrechten änderbar)
  const istGeschuetzt = (teile) => teile.length === 0 || ["windows", "program files"].includes(klein(teile[0])) || (klein(teile[0]) === "users" && teile.length <= 1);

  /* ---------- Objekte für Dateien, Ordner, Umgebungsvariablen, Registry ---------- */

  function dateiObjekt(s, teile, k) {
    const ordner = !!k.ordner;
    const voll = s.ortText("C", teile);
    const elternText = teile.length ? s.ortText("C", teile.slice(0, -1)) : "";
    const name = teile.length ? teile[teile.length - 1] : "C:\\";
    const punkt = name.lastIndexOf(".");
    const endung = punkt > 0 ? name.slice(punkt) : "";
    const mode = MODE(k);
    const attribute = [k.nurLesen ? "ReadOnly" : null, k.versteckt ? "Hidden" : null, ordner ? "Directory" : "Archive"].filter(Boolean);
    const attrWert = (k.nurLesen ? 1 : 0) + (k.versteckt ? 2 : 0) + (ordner ? 16 : 32);
    const zeit = new PSDatum(k.zeit), erstellt = new PSDatum(k.erstellt === undefined ? k.zeit : k.erstellt);
    const utc = (d) => new PSDatum(nachUtc(d.ms));
    const ps = "Microsoft.PowerShell.Core\\FileSystem::";
    const paare = [
      ["PSPath", ps + voll], ["PSParentPath", teile.length ? ps + elternText : ""], ["PSChildName", name], ["PSDrive", "C"],
      ["PSProvider", "Microsoft.PowerShell.Core\\FileSystem"], ["PSIsContainer", ordner], ["Mode", mode], ["ModeWithoutHardLink", mode],
      ["BaseName", ordner ? name : punkt > 0 ? name.slice(0, punkt) : name], ["ResolvedTarget", voll], ["Target", null], ["LinkType", null], ["Name", name],
    ];
    if (ordner) {
      paare.push(["FullName", voll], ["Parent", new Faul(() => (teile.length ? ordnerObjekt(s, teile.slice(0, -1)) : null))], ["Exists", true],
        ["Root", new Faul(() => ordnerObjekt(s, []))], ["Extension", endung]);
    } else {
      paare.push(["Length", k.groesse], ["DirectoryName", elternText], ["Directory", new Faul(() => ordnerObjekt(s, teile.slice(0, -1)))],
        ["IsReadOnly", !!k.nurLesen], ["Exists", true], ["FullName", voll], ["Extension", endung]);
    }
    paare.push(["CreationTime", erstellt], ["CreationTimeUtc", utc(erstellt)], ["LastAccessTime", zeit], ["LastAccessTimeUtc", utc(zeit)],
      ["LastWriteTime", zeit], ["LastWriteTimeUtc", utc(zeit)], ["LinkTarget", null], ["UnixFileMode", -1],
      ["Attributes", new PSEnum("System.IO.FileAttributes", attribute.join(", "), attrWert)]);
    const arten = {};
    paare.forEach(([n]) => {
      arten[n] = /^PS/.test(n) ? "NoteProperty" : ["Mode", "ModeWithoutHardLink", "LinkType", "ResolvedTarget"].includes(n) ? "CodeProperty"
        : n === "Target" ? "AliasProperty" : n === "BaseName" ? "ScriptProperty" : "Property";
    });
    const o = new PSObjekt([ordner ? "System.IO.DirectoryInfo" : "System.IO.FileInfo", "System.IO.FileSystemInfo", "System.MarshalByRefObject", "System.Object"], paare, arten);
    o._elternText = elternText;
    o._knoten = k;
    o._teile = teile;
    o._text = () => voll;
    o._kurz = voll;
    o._setzen = (n, w) => {
      if (gleichCI(n, "LastWriteTime")) { k.zeit = konvertieren(w, T_DATUM).ms; o.setzen("LastWriteTime", new PSDatum(k.zeit)); return true; }
      if (gleichCI(n, "IsReadOnly") && !ordner) { k.nurLesen = alsBool(w); o.setzen("IsReadOnly", k.nurLesen); return true; }
      return false;
    };
    o._methoden = {
      delete: () => { entfernenKnoten(s, teile); },
      refresh: () => undefined,
      copyto: (args) => { kopierenKnoten(s, teile, s.pfadAufloesen(textVon(args[0])).teile, true); return dateiObjektPfad(s, s.pfadAufloesen(textVon(args[0])).teile); },
      moveto: (args) => { const z = s.pfadAufloesen(textVon(args[0])).teile; verschiebenKnoten(s, teile, z); },
      getfiles: () => s.welt.kinderSortiert(k).filter((x) => !x.ordner && !x.versteckt).map((x) => dateiObjekt(s, teile.concat([x.name]), x)),
      getdirectories: () => s.welt.kinderSortiert(k).filter((x) => x.ordner && !x.versteckt).map((x) => dateiObjekt(s, teile.concat([x.name]), x)),
      createsubdirectory: (args) => { const z = teile.concat([textVon(args[0])]); s.welt.ordnerAnlegen(z, s.welt.zeit); return ordnerObjekt(s, z); },
    };
    return o;
  }
  const ordnerObjekt = (s, teile) => { const k = s.welt.knoten(teile); return k ? dateiObjekt(s, teile, k) : null; };
  const dateiObjektPfad = (s, teile) => { const k = s.welt.knoten(teile); return k ? dateiObjekt(s, echteTeile(s, teile), k) : null; };
  // Gross/Klein wie gespeichert für den letzten Teil, die übrigen wie eingegeben
  function echteTeile(s, teile) {
    if (!teile.length) return teile;
    const eltern = s.welt.knoten(teile.slice(0, -1));
    const k = eltern && eltern.kinder ? eltern.kinder.find((x) => gleichCI(x.name, teile[teile.length - 1])) : null;
    return k ? teile.slice(0, -1).concat([k.name]) : teile;
  }

  function envObjekt(name, wert) {
    const o = new PSObjekt(["System.Collections.DictionaryEntry"], [["PSPath", "Microsoft.PowerShell.Core\\Environment::" + name], ["PSDrive", "Env"],
      ["PSProvider", "Microsoft.PowerShell.Core\\Environment"], ["PSIsContainer", false], ["Name", name], ["Key", name], ["Value", wert]],
      { Name: "AliasProperty", Key: "Property", Value: "Property" });
    o._versteckt = ["PSPath", "PSDrive", "PSProvider", "PSIsContainer"];
    return o;
  }

  function registryObjekt(teile, knoten) {
    const voll = "HKEY_CURRENT_USER" + (teile.length ? "\\" + teile.join("\\") : "");
    const werte = (knoten.werte || []).slice();
    const o = new PSObjekt(["Microsoft.Win32.RegistryKey"], [["Property", werte.map((w) => w[0])], ["PSPath", "Microsoft.PowerShell.Core\\Registry::" + voll],
      ["PSParentPath", "Microsoft.PowerShell.Core\\Registry::HKEY_CURRENT_USER" + (teile.length > 1 ? "\\" + teile.slice(0, -1).join("\\") : "")],
      ["PSChildName", teile.length ? teile[teile.length - 1] : "HKEY_CURRENT_USER"], ["PSDrive", "HKCU"], ["PSProvider", "Microsoft.PowerShell.Core\\Registry"],
      ["PSIsContainer", true], ["SubKeyCount", Object.keys(knoten.kinder || {}).length], ["View", "Default"], ["Handle", "Microsoft.Win32.SafeHandles.SafeRegistryHandle"],
      ["ValueCount", werte.length], ["Name", voll], ["Werte", werte], ["Hive", "HKEY_CURRENT_USER" + (teile.length > 1 ? "\\" + teile.slice(0, -1).join("\\") : "")]]);
    o._versteckt = ["Werte", "Hive"];
    o._text = () => voll;
    return o;
  }

  /* ---------- Pfade mit Platzhaltern auflösen ---------- */

  // → { treffer: [{ laufwerk, teile, knoten }], voll, platzhalter }
  function pfadeFinden(s, text, o) {
    o = o || {};
    const roh = String(text === null || text === undefined ? "." : text);
    const r = s.pfadAufloesen(roh);
    const platzhalter = !o.literal && r.teile.some(hatPlatzhalter);
    const voll = s.ortText(r.laufwerk, r.teile);
    const treffer = [];
    if (r.laufwerk === "C") {
      if (!platzhalter) {
        const k = s.welt.knoten(r.teile);
        if (k) treffer.push({ laufwerk: "C", teile: echteTeile(s, r.teile), knoten: k });
      } else {
        let kand = [{ teile: [], knoten: s.welt.c }];
        r.teile.forEach((seg) => {
          const neu = [];
          kand.forEach((c) => {
            if (!c.knoten.ordner) return;
            if (hatPlatzhalter(seg)) {
              s.welt.kinderSortiert(c.knoten).forEach((kind) => {
                if (passt(kind.name, seg) && (o.force || !kind.versteckt)) neu.push({ teile: c.teile.concat([kind.name]), knoten: kind });
              });
            } else {
              const kind = c.knoten.kinder.find((x) => gleichCI(x.name, seg));
              if (kind) neu.push({ teile: c.teile.concat([seg]), knoten: kind });
            }
          });
          kand = neu;
        });
        kand.forEach((c) => treffer.push({ laufwerk: "C", teile: c.teile, knoten: c.knoten }));
      }
    } else if (r.laufwerk === "ENV") {
      if (!r.teile.length) treffer.push({ laufwerk: "ENV", teile: [], knoten: { ordner: true } });
      else {
        const muster = r.teile.join("\\");
        s.welt.env.slice().sort((a, b) => ordinalCI(a[0], b[0])).forEach((e) => {
          if (platzhalter ? passt(e[0], muster) : gleichCI(e[0], muster)) treffer.push({ laufwerk: "ENV", teile: [e[0]], knoten: { ordner: false, name: e[0], wert: e[1] } });
        });
      }
    } else {
      const k = s.welt.registryKnoten(r.teile);
      if (k) treffer.push({ laufwerk: "HKCU", teile: r.teile, knoten: Object.assign({ ordner: true, registry: true }, k) });
    }
    return { treffer: treffer, voll: voll, platzhalter: platzhalter, laufwerk: r.laufwerk, teile: r.teile };
  }

  function objektFuerTreffer(s, t) {
    if (t.laufwerk === "C") return dateiObjekt(s, t.teile, t.knoten);
    if (t.laufwerk === "ENV") return envObjekt(t.knoten.name, t.knoten.wert);
    return registryObjekt(t.teile, t.knoten);
  }

  // Pfade aus -Path oder aus der Pipeline (Strings oder Objekte mit PSPath/FullName)
  function pfadeAusCtx(ctx, name, standard) {
    const p = ctx.wert(name || "Path");
    const lit = ctx.wert("LiteralPath");
    if (lit !== undefined) return alsListe(lit).map((x) => ({ text: textVon(x), literal: true }));
    if (p !== undefined && p !== null) return alsListe(p).map((x) => ({ text: textVon(x), literal: false }));
    if (ctx.hatEingabe && ctx.eingabe.length) {
      return ctx.eingabe.filter((x) => x !== null).map((x) => {
        if (x instanceof PSObjekt && x.hat("PSPath")) return { text: textVon(eig(x, "PSPath")), literal: true };
        if (x instanceof PSObjekt && x.hat("FullName")) return { text: textVon(eig(x, "FullName")), literal: true };
        return { text: textVon(x), literal: false };
      });
    }
    return standard === undefined ? [] : [{ text: standard, literal: false }];
  }

  /* ---------- Dateisystem ändern ---------- */

  function knotenEntfernen(s, teile) {
    const eltern = s.welt.knoten(teile.slice(0, -1));
    if (!eltern) return;
    eltern.kinder = eltern.kinder.filter((x) => !gleichCI(x.name, teile[teile.length - 1]));
    eltern.zeit = s.welt.zeit;
  }
  const entfernenKnoten = knotenEntfernen;
  function kopie(k) { return Object.assign({}, k, k.kinder ? { kinder: k.kinder.map(kopie) } : {}); }
  function kopierenKnoten(s, von, nach, rekursiv) {
    const k = s.welt.knoten(von);
    const ziel = s.welt.elternUndName(nach);
    if (!k || !ziel.eltern) return null;
    let neu = kopie(k);
    neu.name = ziel.name;
    neu.erstellt = s.welt.zeit;
    if (k.ordner && !rekursiv) neu.kinder = [];
    if (k.ordner) neu.zeit = s.welt.zeit;
    ziel.eltern.kinder = ziel.eltern.kinder.filter((x) => !gleichCI(x.name, ziel.name));
    ziel.eltern.kinder.push(neu);
    ziel.eltern.zeit = s.welt.zeit;
    return neu;
  }
  function verschiebenKnoten(s, von, nach) {
    const k = s.welt.knoten(von);
    const ziel = s.welt.elternUndName(nach);
    if (!k || !ziel.eltern) return null;
    knotenEntfernen(s, von);
    k.name = ziel.name;
    ziel.eltern.kinder = ziel.eltern.kinder.filter((x) => !gleichCI(x.name, ziel.name));
    ziel.eltern.kinder.push(k);
    ziel.eltern.zeit = s.welt.zeit;
    return k;
  }

  // Zeilen in eine Datei schreiben (Set-Content, Add-Content, Out-File, >)
  function dateiInhaltSchreiben(s, pfad, zeilen, anhaengen, befehl, ohneUmbruch) {
    const r = s.pfadAufloesen(pfad);
    const voll = s.ortText(r.laufwerk, r.teile);
    if (r.laufwerk === "ENV") { s.welt.envSetzen(r.teile.join("\\"), zeilen.join("")); return true; }
    if (r.laufwerk !== "C") throw abbruch({ meldung: "Der Simulator kann nur Dateien auf Laufwerk C: schreiben.", befehl: befehl });
    const eltern = s.welt.knoten(r.teile.slice(0, -1));
    if (!eltern || !eltern.ordner) throw abbruch(Object.assign(teilFehlt(voll), { befehl: befehl }));
    const alt = s.welt.knoten(r.teile);
    if (alt && alt.ordner) throw abbruch({ meldung: "Access to the path '" + voll + "' is denied.", befehl: befehl, kategorie: "PermissionDenied", ausnahme: "System.UnauthorizedAccessException" });
    if (istGeschuetzt(r.teile.slice(0, -1)) && !s.welt.admin) throw abbruch(Object.assign(keinZugriff(voll), { befehl: befehl }));
    const neuText = ohneUmbruch ? zeilen.join("") : zeilenAlsInhalt(zeilen);
    const inhalt = anhaengen && alt ? (alt.inhalt || "") + neuText : neuText;
    s.welt.dateiSchreiben(echteTeile(s, r.teile), inhalt, {});
    return true;
  }

  function inhaltZeilen(k) {
    if (k.inhalt === null || k.inhalt === undefined) return null;
    const z = k.inhalt.split(/\r?\n/);
    if (z.length && z[z.length - 1] === "") z.pop();
    return z;
  }

  /* ---------- Get-ChildItem, Get-Item, Test-Path, Join-Path ---------- */

  cmdlet("Get-ChildItem", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      const force = ctx.schalter("Force");
      const filter = ctx.wert("Filter");
      const incl = ctx.wert("Include"), excl = ctx.wert("Exclude");
      const tiefe = ctx.hat("Depth") ? zahlWert(ctx.wert("Depth")) : ctx.schalter("Recurse") ? Infinity : 0;
      const nurName = ctx.schalter("Name");
      const out = { push: (v) => ctx.aus(v) };
      const nameOk = (k, wurzel) => {
        if (filter && !passt(k.name, filter)) return false;
        if (incl && (wurzel || tiefe > 0) && !alsListe(incl).some((m) => passt(k.name, m))) return false;
        if (excl && alsListe(excl).some((m) => passt(k.name, m))) return false;
        if (ctx.schalter("Directory") && !k.ordner) return false;
        if (ctx.schalter("File") && k.ordner) return false;
        if (ctx.schalter("Hidden") && !k.versteckt) return false;
        return true;
      };
      const sichtbar = (k) => force || ctx.schalter("Hidden") || !k.versteckt;
      const ausgeben = (teile, k, basis) => out.push(nurName ? teile.slice(basis.length).join("\\") : dateiObjekt(s, teile, k));
      const auflisten = (teile, k, stufe, basis) => {
        const kinder = s.welt.kinderSortiert(k).filter(sichtbar);
        kinder.forEach((kind) => { if (nameOk(kind, true)) ausgeben(teile.concat([kind.name]), kind, basis); });
        if (stufe < tiefe) kinder.filter((kind) => kind.ordner && (force || !kind.versteckt)).forEach((kind) => auflisten(teile.concat([kind.name]), kind, stufe + 1, basis));
      };
      for (const p of pfadeAusCtx(ctx, "Path", ".")) {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: force });
        if (incl && !f.platzhalter && !ctx.schalter("Recurse") && !ctx.hat("Depth")) continue;
        if (!f.treffer.length) {
          if (!f.platzhalter) ctx.fehler(nichtGefunden(f.voll));
          continue;
        }
        for (const t of f.treffer) {
          if (t.laufwerk === "ENV") {
            if (!t.teile.length) s.welt.env.slice().sort((a, b) => ordinalCI(a[0], b[0])).forEach((e) => out.push(nurName ? e[0] : envObjekt(e[0], e[1])));
            else out.push(nurName ? t.knoten.name : envObjekt(t.knoten.name, t.knoten.wert));
            continue;
          }
          if (t.laufwerk === "HKCU") {
            Object.keys(t.knoten.kinder || {}).sort(ordinalCI).forEach((n) => {
              const kk = Object.assign({ name: n }, t.knoten.kinder[n]);
              if (!filter || passt(n, filter)) out.push(nurName ? n : registryObjekt(t.teile.concat([n]), kk));
            });
            continue;
          }
          if (!t.knoten.ordner) {
            if (nameOk(t.knoten, true)) ausgeben(t.teile, t.knoten, t.teile.slice(0, -1));
            continue;
          }
          if (!force && t.knoten.versteckt && !f.platzhalter && !p.literal) { /* versteckter Ordner explizit: erlaubt */ }
          if (f.platzhalter && !ctx.schalter("Recurse")) {
            if (nameOk(t.knoten, true)) ausgeben(t.teile, t.knoten, t.teile.slice(0, -1));
            continue;
          }
          auflisten(t.teile, t.knoten, 0, t.teile);
        }
      }
      return [];
    },
  });

  cmdlet("Get-Item", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      const out = { push: (v) => ctx.aus(v) };
      for (const p of pfadeAusCtx(ctx, "Path")) {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: ctx.schalter("Force") });
        if (!f.treffer.length) { if (!f.platzhalter) ctx.fehler(nichtGefunden(f.voll)); continue; }
        f.treffer.forEach((t) => {
          if (t.laufwerk === "C" && t.knoten.versteckt && !ctx.schalter("Force")) {
            ctx.fehler({ meldung: "Could not find item " + s.ortText("C", t.teile) + ".", kategorie: "ObjectNotFound", ausnahme: "System.IO.IOException", id: "ItemNotFound", ziel: s.ortText("C", t.teile) });
            return;
          }
          if (t.laufwerk === "ENV" && !t.teile.length) { out.push(neuesObjekt([["Name", "Env"], ["Root", ""]], "System.Management.Automation.PSDriveInfo")); return; }
          out.push(objektFuerTreffer(s, t));
        });
      }
      return [];
    },
  });

  cmdlet("Test-Path", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      const art = klein(textVon(ctx.wert("PathType") || "Any"));
      return pfadeAusCtx(ctx, "Path").map((p) => {
        if (ctx.schalter("IsValid")) return !/[<>"|]/.test(p.text);
        let f;
        try { f = pfadeFinden(s, p.text, { literal: p.literal, force: true }); } catch (e) { return false; }
        return f.treffer.some((t) => {
          if (art === "container" && !t.knoten.ordner) return false;
          if (art === "leaf" && t.knoten.ordner) return false;
          if (t.laufwerk === "C" && ctx.hat("OlderThan") && !(t.knoten.zeit < ctx.wert("OlderThan").ms)) return false;
          if (t.laufwerk === "C" && ctx.hat("NewerThan") && !(t.knoten.zeit > ctx.wert("NewerThan").ms)) return false;
          return true;
        });
      });
    },
  });

  cmdlet("Join-Path", "M", {
    pipeline: ["Path"],
    run(ctx) {
      const kinder = alsListe(ctx.wert("ChildPath")).concat(alsListe(ctx.wert("AdditionalChildPath") || []));
      return alsListe(ctx.wert("Path")).map((basis) => {
        let p = textVon(basis);
        kinder.forEach((k) => {
          const t = textVon(k).replace(/\//g, "\\");
          p = p.replace(/[\\/]+$/, "") + "\\" + t.replace(/^[\\/]+/, "");
        });
        if (ctx.schalter("Resolve")) {
          const f = pfadeFinden(ctx.sitzung, p, {});
          if (!f.treffer.length) { ctx.fehler(nichtGefunden(f.voll)); return null; }
          return ctx.sitzung.ortText(f.treffer[0].laufwerk, f.treffer[0].teile);
        }
        return p;
      }).filter((x) => x !== null);
    },
  });

  cmdlet("Split-Path", "M", {
    pipeline: ["Path"],
    run(ctx) {
      return alsListe(ctx.wert("Path")).map((x) => {
        const p = textVon(x).replace(/\//g, "\\").replace(/\\+$/, "");
        const i = p.lastIndexOf("\\");
        const blatt = i >= 0 ? p.slice(i + 1) : p;
        if (ctx.schalter("Leaf")) return blatt;
        if (ctx.schalter("LeafBase")) { const j = blatt.lastIndexOf("."); return j > 0 ? blatt.slice(0, j) : blatt; }
        if (ctx.schalter("Extension")) { const j = blatt.lastIndexOf("."); return j > 0 ? blatt.slice(j) : ""; }
        if (ctx.schalter("Qualifier")) { const m = /^([A-Za-z]+:)/.exec(p); return m ? m[1] : ""; }
        if (ctx.schalter("NoQualifier")) return p.replace(/^[A-Za-z]+:/, "");
        if (ctx.schalter("IsAbsolute")) return /^[A-Za-z]+:\\|^\\/.test(textVon(x));
        if (i < 0) return "";
        return /^[A-Za-z]:$/.test(p.slice(0, i)) ? p.slice(0, i) + "\\" : p.slice(0, i);
      });
    },
  });

  cmdlet("Resolve-Path", "M", {
    pipeline: ["Path"],
    run(ctx) {
      const s = ctx.sitzung;
      const out = [];
      pfadeAusCtx(ctx, "Path").forEach((p) => {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: true });
        if (!f.treffer.length) { ctx.fehler(nichtGefunden(f.voll)); return; }
        f.treffer.forEach((t) => {
          const voll = s.ortText(t.laufwerk, t.teile);
          if (ctx.schalter("Relative")) {
            const basis = s.ort;
            out.push(voll.toLowerCase().startsWith(basis.toLowerCase() + "\\") ? "." + voll.slice(basis.length) : voll);
          } else out.push(new PSObjekt(["System.Management.Automation.PathInfo"], [["Drive", t.laufwerk === "ENV" ? "Env" : t.laufwerk], ["Provider", "FileSystem"], ["ProviderPath", voll], ["Path", voll]]));
        });
      });
      return out;
    },
  });

  /* ---------- Ort ---------- */

  cmdlet("Get-Location", "M", { run: (ctx) => [ctx.sitzung.pfadInfo()] });

  cmdlet("Set-Location", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      let ziel = ctx.hat("LiteralPath") ? textVon(ctx.wert("LiteralPath")) : ctx.hat("Path") ? textVon(ctx.wert("Path")) : (ctx.hatEingabe && ctx.eingabe.length ? textVon(ctx.eingabe[0]) : "~");
      if (ziel === "-" || ziel === "+") {
        const stapel = ziel === "-" ? (s._zurueck = s._zurueck || []) : (s._vor = s._vor || []);
        if (!stapel.length) return [];
        const z = stapel.pop();
        (ziel === "-" ? (s._vor = s._vor || []) : s._zurueck).push({ laufwerk: s.laufwerk, teile: s.orte[s.laufwerk].slice() });
        s.laufwerk = z.laufwerk;
        s.orte[z.laufwerk] = z.teile;
        return ctx.schalter("PassThru") ? [s.pfadInfo()] : [];
      }
      if (/^[A-Za-z][A-Za-z0-9]*:$/.test(ziel)) {
        const r = s.pfadAufloesen(ziel);
        (s._zurueck = s._zurueck || []).push({ laufwerk: s.laufwerk, teile: s.orte[s.laufwerk].slice() });
        s.laufwerk = r.laufwerk;
        return ctx.schalter("PassThru") ? [s.pfadInfo()] : [];
      }
      const f = pfadeFinden(s, ziel, { literal: ctx.hat("LiteralPath"), force: true });
      const t = f.treffer.find((x) => x.knoten.ordner);
      if (!t) {
        if (f.treffer.length) throw ctx.abbruch({ meldung: "Cannot find path '" + f.voll + "' because it does not exist.", kategorie: "ObjectNotFound", ausnahme: "System.Management.Automation.ItemNotFoundException", id: "PathNotFound", ziel: f.voll });
        throw ctx.abbruch(nichtGefunden(f.voll));
      }
      (s._zurueck = s._zurueck || []).push({ laufwerk: s.laufwerk, teile: s.orte[s.laufwerk].slice() });
      s._vor = [];
      s.laufwerk = t.laufwerk;
      s.orte[t.laufwerk] = t.teile.slice();
      return ctx.schalter("PassThru") ? [s.pfadInfo()] : [];
    },
  });

  /* ---------- Anlegen, kopieren, verschieben, umbenennen, löschen ---------- */

  cmdlet("New-Item", "M", {
    pipeline: ["Path", "Value"],
    run(ctx) {
      const s = ctx.sitzung;
      const art = klein(textVon(ctx.wert("ItemType") || "File"));
      const ordner = ["directory", "dir", "d", "container", "folder"].includes(art) || "directory".startsWith(art) && art.length > 1;
      const datei = ["file", "f"].includes(art) || "file".startsWith(art);
      if (!ordner && !datei) throw ctx.abbruch({ meldung: "Der Simulator kennt bei New-Item nur -ItemType File und Directory.", kategorie: "InvalidArgument" });
      const basis = ctx.hat("Path") ? alsListe(ctx.wert("Path")).map(textVon) : ["."];
      const out = [];
      basis.forEach((b) => {
        const pfad = ctx.hat("Name") ? b.replace(/[\\/]+$/, "") + "\\" + textVon(ctx.wert("Name")) : b;
        const r = s.pfadAufloesen(pfad);
        const voll = s.ortText(r.laufwerk, r.teile);
        if (r.laufwerk === "ENV") {
          if (!ctx.sollen("New Item", "Item: " + r.teile.join("\\") + " Value: " + textVon(ctx.wert("Value")))) return;
          s.welt.envSetzen(r.teile.join("\\"), textVon(ctx.wert("Value")));
          out.push(envObjekt(r.teile.join("\\"), textVon(ctx.wert("Value"))));
          return;
        }
        if (r.laufwerk !== "C") throw ctx.abbruch({ meldung: "Der Simulator legt nur auf C: und Env: neue Elemente an." });
        const alt = s.welt.knoten(r.teile);
        if (alt && !ctx.schalter("Force")) {
          ctx.fehler(alt.ordner && ordner
            ? { meldung: "An item with the specified name " + voll + " already exists.", kategorie: "ResourceExists", ausnahme: "System.IO.IOException", id: "DirectoryExist", ziel: voll }
            : { meldung: "The file '" + voll + "' already exists.", kategorie: "WriteError", ausnahme: "System.IO.IOException", id: "NewItemIOError", ziel: voll });
          return;
        }
        const eltern = s.welt.knoten(r.teile.slice(0, -1));
        if (!eltern && !ctx.schalter("Force")) { ctx.fehler(teilFehlt(voll)); return; }
        if (istGeschuetzt(r.teile.slice(0, -1)) && !s.welt.admin) { ctx.fehler(keinZugriff(voll)); return; }
        if (!ctx.sollen(ordner ? "Create Directory" : "Create File", "Destination: " + voll)) return;
        if (ordner) {
          if (!(alt && alt.ordner)) s.welt.ordnerAnlegen(r.teile, s.welt.zeit);
        } else {
          const w = ctx.wert("Value");
          s.welt.dateiSchreiben(r.teile, w === undefined || w === null ? "" : alsListe(w).map(textVon).join(""), {});
        }
        const k = s.welt.knoten(r.teile);
        out.push(dateiObjekt(s, echteTeile(s, r.teile), k));
      });
      return out;
    },
  });

  // mkdir ist in pwsh eine Funktion: New-Item -ItemType Directory
  cmdlet("mkdir", "F", {
    syntax: ["mkdir [-Path] <string[]> [-Name <string>] [-Value <Object>] [-Force] [-WhatIf] [-Confirm] [<CommonParameters>]"],
    run(ctx) {
      ctx.p.itemtype = "Directory";
      return CMDLETS["new-item"].run(ctx);
    },
  });

  // Ziel für Copy-Item und Move-Item bestimmen (in einen Ordner oder als neuer Name)
  function zielBestimmen(s, quelleTeile, zielText) {
    const r = s.pfadAufloesen(zielText === undefined || zielText === null ? "." : zielText);
    const k = s.welt.knoten(r.teile);
    if (k && k.ordner) return r.teile.concat([quelleTeile[quelleTeile.length - 1]]);
    return r.teile;
  }

  cmdlet("Copy-Item", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      const out = [];
      for (const p of pfadeAusCtx(ctx, "Path")) {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: true });
        if (!f.treffer.length) { if (!f.platzhalter) ctx.fehler(nichtGefunden(f.voll)); continue; }
        for (const t of f.treffer) {
          if (t.laufwerk !== "C") { ctx.hinweis("Copy-Item kann im Simulator nur Dateien und Ordner kopieren."); continue; }
          if (ctx.hat("Filter") && !t.knoten.ordner && !passt(t.knoten.name, ctx.wert("Filter"))) continue;
          if (ctx.hat("Include") && !alsListe(ctx.wert("Include")).some((m) => passt(t.knoten.name, m))) continue;
          if (ctx.hat("Exclude") && alsListe(ctx.wert("Exclude")).some((m) => passt(t.knoten.name, m))) continue;
          const ziel = zielBestimmen(s, t.teile, ctx.wert("Destination"));
          const quelle = s.ortText("C", t.teile), zielText = s.ortText("C", ziel);
          if (!s.welt.knoten(ziel.slice(0, -1))) { ctx.fehler(teilFehlt(zielText)); continue; }
          if (istGeschuetzt(ziel.slice(0, -1)) && !s.welt.admin) { ctx.fehler(keinZugriff(zielText)); continue; }
          if (klein(quelle) === klein(zielText)) { ctx.fehler({ meldung: "Cannot overwrite the item " + quelle + " with itself.", kategorie: "WriteError", ausnahme: "System.IO.IOException", id: "CopyError" }); continue; }
          if (!ctx.sollen(t.knoten.ordner ? "Copy Directory" : "Copy File", "Item: " + quelle + " Destination: " + zielText)) continue;
          kopierenKnoten(s, t.teile, ziel, ctx.schalter("Recurse"));
          if (ctx.schalter("PassThru")) out.push(dateiObjektPfad(s, ziel));
        }
      }
      return out;
    },
  });

  cmdlet("Move-Item", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      const out = [];
      for (const p of pfadeAusCtx(ctx, "Path")) {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: true });
        if (!f.treffer.length) { if (!f.platzhalter) ctx.fehler(nichtGefunden(f.voll)); continue; }
        for (const t of f.treffer) {
          if (t.laufwerk !== "C") { ctx.hinweis("Move-Item kann im Simulator nur Dateien und Ordner verschieben."); continue; }
          if (ctx.hat("Filter") && !passt(t.knoten.name, ctx.wert("Filter"))) continue;
          if (ctx.hat("Include") && !alsListe(ctx.wert("Include")).some((m) => passt(t.knoten.name, m))) continue;
          if (ctx.hat("Exclude") && alsListe(ctx.wert("Exclude")).some((m) => passt(t.knoten.name, m))) continue;
          const ziel = zielBestimmen(s, t.teile, ctx.wert("Destination"));
          const quelle = s.ortText("C", t.teile), zielText = s.ortText("C", ziel);
          if ((istGeschuetzt(t.teile.slice(0, -1)) || istGeschuetzt(ziel.slice(0, -1))) && !s.welt.admin) { ctx.fehler(keinZugriff(quelle)); continue; }
          if (!s.welt.knoten(ziel.slice(0, -1))) { ctx.fehler(teilFehlt(zielText)); continue; }
          const vorhanden = s.welt.knoten(ziel);
          if (vorhanden && klein(quelle) !== klein(zielText) && !ctx.schalter("Force")) { ctx.fehler(gibtsSchon()); continue; }
          if (klein(zielText).startsWith(klein(quelle) + "\\")) { ctx.fehler({ meldung: "Destination path cannot be a subdirectory of the source: " + zielText + ".", kategorie: "WriteError", ausnahme: "System.IO.IOException" }); continue; }
          if (!ctx.sollen(t.knoten.ordner ? "Move Directory" : "Move File", "Item: " + quelle + " Destination: " + zielText)) continue;
          verschiebenKnoten(s, t.teile, ziel);
          if (ctx.schalter("PassThru")) out.push(dateiObjektPfad(s, ziel));
        }
      }
      return out;
    },
  });

  cmdlet("Rename-Item", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      const pfad = pfadeAusCtx(ctx, "Path")[0];
      const neu = textVon(ctx.wert("NewName"));
      if (!pfad) throw ctx.abbruch({ meldung: "Cannot process command because of one or more missing mandatory parameters: Path.", kategorie: "InvalidArgument" });
      const f = pfadeFinden(s, pfad.text, { literal: true, force: true });
      if (!f.treffer.length) { ctx.fehler(nichtGefunden(f.voll)); return []; }
      const t = f.treffer[0];
      if (t.laufwerk !== "C") { ctx.hinweis("Rename-Item kann im Simulator nur Dateien und Ordner umbenennen."); return []; }
      if (/[\\/]/.test(neu)) { ctx.fehler({ meldung: "Cannot rename the specified target, because it represents a path or device name.", kategorie: "InvalidArgument", ausnahme: "System.Management.Automation.PSArgumentException", id: "Argument" }); return []; }
      const ziel = t.teile.slice(0, -1).concat([neu]);
      const quelle = s.ortText("C", t.teile), zielText = s.ortText("C", ziel);
      if (istGeschuetzt(t.teile.slice(0, -1)) && !s.welt.admin) { ctx.fehler(keinZugriff(quelle)); return []; }
      const vorhanden = s.welt.knoten(ziel);
      if (vorhanden && klein(quelle) !== klein(zielText)) { ctx.fehler(Object.assign(gibtsSchon(), { id: "RenameItemIOError" })); return []; }
      if (!ctx.sollen(t.knoten.ordner ? "Rename Directory" : "Rename File", "Item: " + quelle + " Destination: " + zielText)) return [];
      verschiebenKnoten(s, t.teile, ziel);
      return ctx.schalter("PassThru") ? [dateiObjektPfad(s, ziel)] : [];
    },
  });

  cmdlet("Remove-Item", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      for (const p of pfadeAusCtx(ctx, "Path")) {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: true });
        if (!f.treffer.length) { if (!f.platzhalter) ctx.fehler(nichtGefunden(f.voll)); continue; }
        for (const t of f.treffer) {
          if (t.laufwerk === "ENV") {
            if (!ctx.sollen("Remove Item", "Item: " + t.knoten.name)) continue;
            s.welt.envSetzen(t.knoten.name, null);
            continue;
          }
          if (t.laufwerk !== "C") { ctx.hinweis("Remove-Item kann im Simulator nur Dateien, Ordner und Umgebungsvariablen löschen."); continue; }
          const k = t.knoten;
          if (ctx.hat("Filter") && !passt(k.name, ctx.wert("Filter"))) continue;
          if (ctx.hat("Include") && !alsListe(ctx.wert("Include")).some((m) => passt(k.name, m))) continue;
          if (ctx.hat("Exclude") && alsListe(ctx.wert("Exclude")).some((m) => passt(k.name, m))) continue;
          const voll = s.ortText("C", t.teile);
          if (klein(voll) === klein(s.ortText("C")) || klein(s.ortText("C")).startsWith(klein(voll) + "\\")) {
            ctx.fehler({ meldung: "Cannot remove the item at '" + voll + "' because it is in use.", kategorie: "WriteError", ausnahme: "System.IO.IOException", id: "RemoveItemIOError" });
            continue;
          }
          if (istGeschuetzt(t.teile.slice(0, -1)) && !s.welt.admin || istGeschuetzt(t.teile)) { ctx.fehler(keinZugriff(voll)); continue; }
          if ((k.versteckt || k.nurLesen) && !ctx.schalter("Force")) {
            ctx.fehler({ meldung: "You do not have sufficient access rights to perform this operation or the item is hidden, system, or read only.", kategorie: "PermissionDenied", ausnahme: "System.IO.IOException", id: "RemoveFileSystemItemUnAuthorizedAccess", ziel: voll });
            continue;
          }
          if (!ctx.sollen(k.ordner ? "Remove Directory" : "Remove File", voll)) continue;
          if (k.ordner && k.kinder.length && !ctx.schalter("Recurse") && !ctx.p.whatif) {
            const ok = s.rueckfrage("Confirm\nThe item at " + voll + " has children and the Recurse parameter was not specified. If you continue, all children will be removed with the item. Are you sure you want to continue?");
            if (!ok) continue;
          }
          knotenEntfernen(s, t.teile);
        }
      }
      return [];
    },
  });

  /* ---------- Inhalte lesen und schreiben ---------- */

  cmdlet("Get-Content", "M", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      const out = { push: (v) => ctx.aus(v) };
      for (const p of pfadeAusCtx(ctx, "Path")) {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: true });
        if (!f.treffer.length) { if (!f.platzhalter) ctx.fehler(nichtGefunden(f.voll)); continue; }
        for (const t of f.treffer) {
          if (t.laufwerk === "ENV") { if (t.teile.length) out.push(t.knoten.wert); continue; }
          if (t.knoten.ordner) {
            const voll = s.ortText(t.laufwerk, t.teile);
            ctx.fehler({ meldung: "Unable to get content because it is a directory: '" + voll + "'. Please use 'Get-ChildItem' instead.", kategorie: "InvalidOperation", ausnahme: "System.UnauthorizedAccessException", id: "GetContentReaderUnauthorizedAccessError", ziel: voll });
            continue;
          }
          let zeilen = inhaltZeilen(t.knoten);
          if (zeilen === null) {
            ctx.hinweis("Für «" + t.knoten.name + "» ist im Simulator kein Inhalt hinterlegt (nur Name, Grösse und Datum).");
            continue;
          }
          if (ctx.schalter("Raw")) { out.push(t.knoten.inhalt); continue; }
          if (ctx.hat("TotalCount") && zahlWert(ctx.wert("TotalCount")) >= 0) zeilen = zeilen.slice(0, zahlWert(ctx.wert("TotalCount")));
          if (ctx.hat("Tail")) zeilen = zahlWert(ctx.wert("Tail")) > 0 ? zeilen.slice(-zahlWert(ctx.wert("Tail"))) : [];
          zeilen.forEach((z) => out.push(z));
        }
      }
      return [];
    },
  });

  // Gemeinsam für Set-Content und Add-Content
  function inhaltSetzen(ctx, anhaengen) {
    const s = ctx.sitzung;
    const werte = ctx.hat("Value") ? alsListe(ctx.wert("Value")) : ctx.hatEingabe ? ctx.eingabe : [];
    const zeilen = werte.map((w) => textVon(w));
    for (const p of alsListe(ctx.wert("Path") || ctx.wert("LiteralPath")).map(textVon)) {
      const f = pfadeFinden(s, p, { force: true });
      const ziele = f.platzhalter ? f.treffer.map((t) => s.ortText(t.laufwerk, t.teile)) : [f.voll];
      if (f.platzhalter && !ziele.length) { ctx.fehler(nichtGefunden(f.voll)); continue; }
      for (const z of ziele) {
        if (!ctx.sollen(anhaengen ? "Add Content" : "Set Content", "Path: " + z)) continue;
        try { dateiInhaltSchreiben(s, z, zeilen, anhaengen, ctx.def.name, ctx.schalter("NoNewline")); }
        catch (e) { if (e instanceof AbbruchFehler) { ctx.fehler(e.datensatz); continue; } throw e; }
      }
    }
    return ctx.schalter("PassThru") ? werte : [];
  }
  cmdlet("Set-Content", "M", { pipeline: ["Value"], run: (ctx) => inhaltSetzen(ctx, false) });
  cmdlet("Add-Content", "M", { pipeline: ["Value"], run: (ctx) => inhaltSetzen(ctx, true) });

  cmdlet("Clear-Content", "M", {
    pipeline: ["Path"],
    run(ctx) {
      const s = ctx.sitzung;
      for (const p of pfadeAusCtx(ctx, "Path")) {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: true });
        if (!f.treffer.length) { ctx.fehler(nichtGefunden(f.voll)); continue; }
        f.treffer.forEach((t) => { if (!t.knoten.ordner && ctx.sollen("Clear Content", "Item: " + s.ortText("C", t.teile))) { t.knoten.inhalt = ""; t.knoten.groesse = 0; t.knoten.zeit = s.welt.zeit; } });
      }
      return [];
    },
  });

  cmdlet("Out-File", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const objekte = ctx.hat("InputObject") ? alsListe(ctx.wert("InputObject")) : ctx.eingabe || [];
      const pfad = textVon(ctx.wert("FilePath") || ctx.wert("LiteralPath"));
      const r = s.pfadAufloesen(pfad);
      if (ctx.schalter("NoClobber") && s.welt.knoten(r.teile)) {
        ctx.fehler({ meldung: "The file '" + s.ortText("C", r.teile) + "' already exists.", kategorie: "ResourceExists", ausnahme: "System.IO.IOException", id: "NoClobber" });
        return [];
      }
      if (!ctx.sollen("Output to File", s.ortText(r.laufwerk, r.teile))) return [];
      const zeilen = formatierenAlsText(objekte).split("\n");
      while (zeilen.length && zeilen[zeilen.length - 1] === "") zeilen.pop();
      try { dateiInhaltSchreiben(s, pfad, zeilen, ctx.schalter("Append"), "Out-File", ctx.schalter("NoNewline")); }
      catch (e) { if (e instanceof AbbruchFehler) ctx.fehler(e.datensatz); else throw e; }
      return [];
    },
  });

  /* ---------- Hilfen für Eigenschaften in der Pipeline ---------- */

  // Wert einer Eigenschaft: Name, Skriptblock oder berechnete Eigenschaft @{ Name=…; Expression=… }
  function berechneteTeile(h) {
    let name = null, ausdruck = null, extra = {};
    h.eintraege().forEach((e) => {
      const k = klein(textVon(e.k));
      if ("name".startsWith(k) || "label".startsWith(k)) name = textVon(e.w);
      else if ("expression".startsWith(k)) ausdruck = e.w;
      else extra[k] = e.w;
    });
    return { name: name, ausdruck: ausdruck, extra: extra };
  }
  function eigenschaftWert(s, obj, spec, ber) {
    if (spec instanceof Skriptblock) return s.skriptblockWert(spec, ber, { dollarUnter: obj });
    if (spec instanceof PSHashtable) {
      const t = berechneteTeile(spec);
      return eigenschaftWert(s, obj, t.ausdruck, ber);
    }
    if (spec === null || spec === undefined) return obj;
    return obj instanceof PSObjekt ? eig(obj, textVon(spec)) : memberHolen(obj, textVon(spec), s);
  }
  function eingabeVon(ctx) {
    if (ctx.hat("InputObject")) return alsListe(ctx.wert("InputObject"));
    return ctx.eingabe || [];
  }
  const sichtbareNamen = (o) => (o instanceof PSObjekt ? o.namen().filter((n) => !o._versteckt || !o._versteckt.includes(n)) : []);
  function namenExpandieren(o, specs) {
    const namen = [];
    specs.forEach((spec) => {
      if (typeof spec === "string" && hatPlatzhalter(spec)) {
        sichtbareNamen(o).forEach((n) => { if (passt(n, spec) && !namen.some((x) => gleichCI(x.name, n))) namen.push({ name: n, spec: n }); });
      } else if (spec instanceof PSHashtable) {
        const t = berechneteTeile(spec);
        namen.push({ name: t.name || (t.ausdruck instanceof Skriptblock ? t.ausdruck.text.trim() : textVon(t.ausdruck)), spec: spec, extra: t.extra });
      } else if (spec instanceof Skriptblock) {
        namen.push({ name: spec.text.trim(), spec: spec });
      } else {
        const n = textVon(spec);
        const echt = o instanceof PSObjekt && o.hat(n) ? o.echterName(n) : n;
        namen.push({ name: echt, spec: n });
      }
    });
    return namen;
  }

  /* ---------- Where-Object, ForEach-Object ---------- */

  const WHERE_OPS = ["EQ", "CEQ", "NE", "CNE", "GT", "CGT", "LT", "CLT", "GE", "CGE", "LE", "CLE", "Like", "CLike", "NotLike", "CNotLike", "Match", "CMatch",
    "NotMatch", "CNotMatch", "Contains", "CContains", "NotContains", "CNotContains", "In", "CIn", "NotIn", "CNotIn", "Is", "IsNot", "Not"];
  cmdlet("Where-Object", "C", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const eingabe = eingabeVon(ctx);
      const sb = ctx.wert("FilterScript");
      if (sb) return eingabe.filter((x) => alsBool(s.skriptblockWert(sb, ctx.ber, { dollarUnter: x })));
      const prop = textVon(ctx.wert("Property"));
      const wert = ctx.wert("Value");
      const op = WHERE_OPS.find((o) => ctx.schalter(o));
      return eingabe.filter((x) => {
        const w = eigenschaftWert(s, x, prop, ctx.ber);
        if (!op) return alsBool(w);
        if (op === "Not") return !alsBool(w);
        return alsBool(s.binaerOp("-" + klein(op), w, wert === undefined ? null : wert, null, ctx.ber));
      });
    },
  });

  cmdlet("ForEach-Object", "C", {
    pipeline: ["InputObject"],
    restParameter: "Process",
    run(ctx) {
      const s = ctx.sitzung;
      const eingabe = eingabeVon(ctx);
      const out = [];
      const lauf = (sb, x) => { if (sb) s.skriptblockAusfuehren(sb, ctx.ber, { gleicherBereich: true, dollarUnter: x }).forEach((y) => out.push(y)); };
      if (ctx.hat("MemberName")) {
        const name = textVon(ctx.wert("MemberName"));
        const args = alsListe(ctx.wert("ArgumentList") || []);
        eingabe.forEach((x) => {
          const hatEig = x instanceof PSObjekt ? x.hat(name) : memberHolen(x, name, s) !== null;
          const w = hatEig && !args.length ? memberHolen(x, name, s) : s.methodeAufrufen(x, name, args, ctx.ber);
          if (Array.isArray(w)) w.forEach((y) => out.push(y)); else if (w !== null || hatEig) out.push(w);
        });
        return out;
      }
      if (ctx.hat("Parallel")) { ctx.hinweis("ForEach-Object -Parallel (nur pwsh 7) läuft im Simulator nacheinander."); }
      let blocks = alsListe(ctx.wert("Process") || ctx.wert("Parallel") || []).concat(alsListe(ctx.wert("RemainingScripts") || []));
      let begin = ctx.wert("Begin") || null, ende = ctx.wert("End") || null;
      if (!begin && !ende && blocks.length >= 3) { begin = blocks[0]; ende = blocks[blocks.length - 1]; blocks = blocks.slice(1, -1); }
      else if (!begin && blocks.length === 2) { begin = blocks[0]; blocks = [blocks[1]]; }
      lauf(begin, null);
      eingabe.forEach((x) => blocks.forEach((b) => lauf(b, x)));
      lauf(ende, null);
      return out;
    },
  });

  /* ---------- Sort-Object, Select-Object ---------- */

  cmdlet("Sort-Object", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const eingabe = eingabeVon(ctx).slice();
      const specs = ctx.hat("Property") ? alsListe(ctx.wert("Property")) : [null];
      const absteigend = ctx.schalter("Descending");
      const cs = ctx.schalter("CaseSensitive");
      const regeln = specs.map((spec) => {
        let ab = absteigend;
        if (spec instanceof PSHashtable) {
          spec.eintraege().forEach((e) => {
            const k = klein(textVon(e.k));
            if ("descending".startsWith(k) && k.length > 1) ab = alsBool(e.w);
            if ("ascending".startsWith(k) && k.length > 1) ab = !alsBool(e.w);
          });
        }
        return { spec: spec, ab: ab };
      });
      const schluessel = eingabe.map((x) => regeln.map((r) => {
        const v = r.spec === null ? x : eigenschaftWert(s, x, r.spec, ctx.ber);
        return v instanceof PSObjekt && r.spec === null ? textVon(v) : v;
      }));
      const vergleich = (a, b) => {
        for (let i = 0; i < regeln.length; i++) {
          let c;
          try { c = vergleichen(a[i], b[i], cs); } catch (e) { c = Math.sign(kulturVergleich(textVon(a[i]), textVon(b[i]))); }
          if (c !== 0) return regeln[i].ab ? -c : c;
        }
        return 0;
      };
      let idx = eingabe.map((_, i) => i).sort((i, j) => vergleich(schluessel[i], schluessel[j]));
      if (ctx.schalter("Unique")) idx = idx.filter((i, n) => n === 0 || vergleich(schluessel[idx[n - 1]], schluessel[i]) !== 0);
      let out = idx.map((i) => eingabe[i]);
      if (ctx.hat("Top")) out = out.slice(0, zahlWert(ctx.wert("Top")));
      if (ctx.hat("Bottom")) out = out.slice(-zahlWert(ctx.wert("Bottom")));
      return out;
    },
  });

  function auswahlObjekt(s, x, namen, ctx) {
    const typen = x instanceof PSObjekt ? ["Selected." + x.typ, CUSTOM] : ["Selected." + (typVon(x) ? typVon(x).voll : "System.Object"), CUSTOM];
    const o = new PSObjekt(typen);
    namen.forEach((n) => {
      if (o.hat(n.name)) return;
      let w;
      if (n.spec instanceof PSHashtable || n.spec instanceof Skriptblock) w = eigenschaftWert(s, x, n.spec, ctx.ber);
      else w = x instanceof PSObjekt ? eig(x, n.spec) : memberHolen(x, n.spec, s);
      o.setzen(n.name, w, "NoteProperty");
    });
    return o;
  }

  cmdlet("Select-Object", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      let liste = eingabeVon(ctx).slice();
      if (ctx.hat("Index")) liste = alsListe(ctx.wert("Index")).map((i) => liste[zahlWert(i)]).filter((x) => x !== undefined);
      if (ctx.hat("SkipIndex")) { const weg = alsListe(ctx.wert("SkipIndex")).map(zahlWert); liste = liste.filter((_, i) => !weg.includes(i)); }
      if (ctx.hat("Skip")) liste = liste.slice(zahlWert(ctx.wert("Skip")));
      if (ctx.hat("SkipLast")) liste = liste.slice(0, Math.max(0, liste.length - zahlWert(ctx.wert("SkipLast"))));
      if (ctx.hat("First") || ctx.hat("Last")) {
        const erste = ctx.hat("First") ? liste.slice(0, zahlWert(ctx.wert("First"))) : [];
        const letzte = ctx.hat("Last") ? liste.slice(Math.max(0, liste.length - zahlWert(ctx.wert("Last")))) : [];
        liste = ctx.hat("First") && ctx.hat("Last") ? erste.concat(letzte) : ctx.hat("First") ? erste : letzte;
      }
      const specs = ctx.hat("Property") ? alsListe(ctx.wert("Property")) : null;
      const ohne = alsListe(ctx.wert("ExcludeProperty") || []).map(textVon);
      if (specs || ohne.length) {
        liste = liste.map((x) => {
          let namen = namenExpandieren(x, specs || ["*"]);
          if (ohne.length) namen = namen.filter((n) => !ohne.some((m) => passt(n.name, m)));
          return auswahlObjekt(s, x, namen, ctx);
        });
      }
      if (ctx.hat("ExpandProperty")) {
        const name = textVon(ctx.wert("ExpandProperty"));
        const out = [];
        eingabeVon(ctx).length; // Eingabe bereits verarbeitet
        liste.forEach((x, i) => {
          const quelle = specs ? x : x;
          const hat = quelle instanceof PSObjekt ? quelle.hat(name) : memberHolen(quelle, name, s) !== null;
          if (!hat) { ctx.fehler({ meldung: 'Property "' + name + '" cannot be found.', kategorie: "InvalidArgument", ausnahme: "System.Management.Automation.PSArgumentException", id: "ExpandPropertyNotFound", ziel: quelle }); return; }
          const w = quelle instanceof PSObjekt ? eig(quelle, name) : memberHolen(quelle, name, s);
          if (Array.isArray(w)) w.forEach((y) => out.push(y)); else out.push(w);
        });
        liste = out;
      }
      if (ctx.schalter("Unique")) {
        const gesehen = [];
        liste = liste.filter((x) => {
          const k = x instanceof PSObjekt ? x.namen().map((n) => textVon(eig(x, n))).join("\u0001") : textVon(x);
          const schl = ctx.schalter("CaseInsensitive") ? klein(k) : k;
          if (gesehen.includes(schl)) return false;
          gesehen.push(schl);
          return true;
        });
      }
      return liste;
    },
  });

  /* ---------- Measure-Object, Group-Object ---------- */

  cmdlet("Measure-Object", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const eingabe = eingabeVon(ctx);
      if (ctx.schalter("Line") || ctx.schalter("Word") || ctx.schalter("Character")) {
        const text = eingabe.map(textVon);
        const o = new PSObjekt(["Microsoft.PowerShell.Commands.TextMeasureInfo"]);
        if (ctx.schalter("Line")) o.setzen("Lines", text.reduce((n, t) => n + t.split("\n").length, 0), "Property");
        if (ctx.schalter("Word")) o.setzen("Words", text.reduce((n, t) => n + t.split(/\s+/).filter(Boolean).length, 0), "Property");
        if (ctx.schalter("Character")) o.setzen("Characters", text.reduce((n, t) => n + (ctx.schalter("IgnoreWhiteSpace") ? t.replace(/\s/g, "").length : t.length), 0), "Property");
        o.setzen("Property", null, "Property");
        return [o];
      }
      const alle = ctx.schalter("AllStats");
      const props = ctx.hat("Property") ? alsListe(ctx.wert("Property")) : [null];
      const out = [];
      props.forEach((prop) => {
        let werte = [];
        let anzahl = 0;
        eingabe.forEach((x) => {
          if (prop === null) { if (x !== null) { anzahl++; werte.push(x); } return; }
          const hat = x instanceof PSObjekt ? x.hat(textVon(prop)) : memberHolen(x, textVon(prop), s) !== null;
          if (!hat) return;
          anzahl++;
          werte.push(eigenschaftWert(s, x, prop, ctx.ber));
        });
        if (prop !== null && !anzahl && eingabe.length) {
          ctx.fehler({ meldung: 'The property "' + textVon(prop) + '" cannot be found in the input for any objects.', kategorie: "InvalidArgument", ausnahme: "System.Management.Automation.PSArgumentException", id: "GenericMeasurePropertyNotFound" });
          return;
        }
        const brauchtZahl = alle || ctx.schalter("Sum") || ctx.schalter("Average") || ctx.schalter("StandardDeviation");
        const zahlen = [];
        if (brauchtZahl || ctx.schalter("Maximum") || ctx.schalter("Minimum")) {
          for (const w of werte) {
            if (w === null) continue;
            let z;
            try { z = zahlWert(nachZahl(w)); } catch (e) { z = null; }
            if (z === null && brauchtZahl) {
              ctx.fehler({ meldung: 'Input object "' + textVon(w) + '" is not numeric.', kategorie: "InvalidType", ausnahme: "System.Management.Automation.PSInvalidOperationException", id: "NonNumericInputObject", ziel: w });
              continue;
            }
            zahlen.push(z === null ? w : z);
          }
        }
        const nur = zahlen.filter((z) => typeof z === "number");
        const keineZahl = brauchtZahl && !nur.length;
        const summe = nur.reduce((a, b) => a + b, 0);
        const mittel = nur.length ? summe / nur.length : null;
        const groesste = zahlen.length ? zahlen.reduce((a, b) => (vergleichen(b, a) > 0 ? b : a)) : null;
        const kleinste = zahlen.length ? zahlen.reduce((a, b) => (vergleichen(b, a) < 0 ? b : a)) : null;
        const sd = nur.length > 1 ? Math.sqrt(nur.reduce((a, b) => a + (b - mittel) * (b - mittel), 0) / (nur.length - 1)) : nur.length === 1 ? 0 : null;
        const d = (v) => (v === null ? null : typeof v === "number" ? alsDouble(v) : v);
        out.push(new PSObjekt(["Microsoft.PowerShell.Commands.GenericMeasureInfo"], [
          ["Count", anzahl], ["Average", alle || ctx.schalter("Average") ? d(mittel) : null], ["Sum", (alle || ctx.schalter("Sum")) && !keineZahl ? alsDouble(summe) : null],
          ["Maximum", alle || ctx.schalter("Maximum") ? d(groesste) : null], ["Minimum", alle || ctx.schalter("Minimum") ? d(kleinste) : null],
          ["StandardDeviation", alle || ctx.schalter("StandardDeviation") ? d(sd) : null], ["Property", prop === null ? null : textVon(prop)],
        ], { Count: "Property", Average: "Property", Sum: "Property", Maximum: "Property", Minimum: "Property", StandardDeviation: "Property", Property: "Property" }));
      });
      return out;
    },
  });

  cmdlet("Group-Object", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const eingabe = eingabeVon(ctx);
      const specs = ctx.hat("Property") ? alsListe(ctx.wert("Property")) : [null];
      const cs = ctx.schalter("CaseSensitive");
      const gruppen = [];
      eingabe.forEach((x) => {
        const werte = specs.map((sp) => eigenschaftWert(s, x, sp, ctx.ber));
        const name = werte.map((w) => textVon(w)).join(", ");
        const k = cs ? name : klein(name);
        let g = gruppen.find((y) => y.k === k);
        if (!g) { g = { k: k, name: name, werte: werte, gruppe: [] }; gruppen.push(g); }
        g.gruppe.push(x);
      });
      gruppen.sort((a, b) => {
        for (let i = 0; i < specs.length; i++) {
          let c;
          try { c = vergleichen(a.werte[i], b.werte[i], cs); } catch (e) { c = Math.sign(kulturVergleich(textVon(a.werte[i]), textVon(b.werte[i]))); }
          if (c) return c;
        }
        return 0;
      });
      if (ctx.schalter("AsHashTable")) {
        const h = new PSHashtable(false);
        gruppen.forEach((g) => h.setzen(ctx.schalter("AsString") ? g.name : g.werte.length === 1 ? g.werte[0] : g.name, g.gruppe));
        return [h];
      }
      return gruppen.map((g) => {
        if (ctx.schalter("NoElement")) return new PSObjekt(["Microsoft.PowerShell.Commands.GroupInfoNoElement", "Microsoft.PowerShell.Commands.GroupInfo"],
          [["Values", g.werte], ["Count", g.gruppe.length], ["Name", g.name]], { Values: "Property", Count: "Property", Name: "Property" });
        const o = new PSObjekt(["Microsoft.PowerShell.Commands.GroupInfo"], [["Values", g.werte], ["Count", g.gruppe.length], ["Group", g.gruppe], ["Name", g.name]],
          { Values: "Property", Count: "Property", Group: "Property", Name: "Property" });
        o._text = () => "Microsoft.PowerShell.Commands.GroupInfo";
        return o;
      });
    },
  });

  /* ---------- Format-Table, Format-List, Format-Wide ---------- */

  function spaltenAusSpecs(s, objekte, specs, ctx) {
    const erstes = objekte.find((x) => x !== null) || null;
    const namen = namenExpandieren(erstes, specs);
    return namen.map((n) => {
      const extra = n.extra || {};
      let breite = null, rechtsB = null, format = null;
      Object.keys(extra).forEach((k) => {
        if ("width".startsWith(k)) breite = zahlWert(nachZahl(extra[k]));
        if ("alignment".startsWith(k)) rechtsB = gleichCI(textVon(extra[k]), "right");
        if ("formatstring".startsWith(k)) format = textVon(extra[k]);
      });
      const wertVon = (o) => (o instanceof PSObjekt || n.spec instanceof Skriptblock || n.spec instanceof PSHashtable ? eigenschaftWert(s, o, n.spec, ctx.ber) : memberHolen(o, n.spec, s));
      const probe = erstes === null ? null : wertVon(erstes);
      return { kopf: n.name, breite: breite, rechts: rechtsB === null ? rechtsBuendig(probe) : rechtsB, wertVon: wertVon, format: format };
    });
  }

  cmdlet("Format-Table", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const objekte = eingabeVon(ctx).filter((x) => x !== null);
      if (!objekte.length) return [];
      let zeilen;
      const a = ansichtFuer(objekte[0]);
      if (!ctx.hat("Property") && a.art === "tabelle") {
        const gruppen = formatieren(objekte.map((o) => ({ art: "objekt", wert: o })), { autosize: ctx.schalter("AutoSize") });
        zeilen = [];
        gruppen.forEach((g) => g.zeilen.forEach((z) => zeilen.push(z)));
        if (ctx.schalter("HideTableHeaders")) zeilen = zeilen.filter((z) => !z.some((t) => t[1] === "kopf"));
      } else {
        const specs = ctx.hat("Property") ? alsListe(ctx.wert("Property")) : sichtbareNamen(objekte[0]);
        const spalten = spaltenAusSpecs(s, objekte, specs.length ? specs : ["*"], ctx);
        const werte = objekte.map((o) => spalten.map((sp) => {
          const v = sp.wertVon(o);
          return sp.format ? wertMitFormat(v, sp.format) : zelle(v, true);
        }));
        const t = tabelle(spalten, werte, { ohneKopf: ctx.schalter("HideTableHeaders") });
        zeilen = [zeile("")].concat(t.kopf, t.zeilen, [zeile("")]);
      }
      return formatObjekte(zeilen, objekte.length, true);
    },
  });

  const LISTEN_STANDARD = {
    "System.IO.FileInfo": ["Name", "Length", "CreationTime", "LastWriteTime", "LastAccessTime", "Mode", "LinkType", "Target"],
    "System.IO.DirectoryInfo": ["Name", "CreationTime", "LastWriteTime", "LastAccessTime", "Mode", "LinkType", "Target"],
    "System.Diagnostics.Process": ["Id", "Handles", "CPU", "SI", "Name"],
    "System.ServiceProcess.ServiceController": ["Name", "DisplayName", "Status", "DependentServices", "ServicesDependedOn", "CanPauseAndContinue", "CanShutdown", "CanStop", "ServiceType"],
  };

  cmdlet("Format-List", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const objekte = eingabeVon(ctx).filter((x) => x !== null);
      const zeilen = [];
      let gruppe = null;
      objekte.forEach((o) => {
        let paare;
        if (o instanceof PSHashtable && !ctx.hat("Property")) {
          o.eintraege().forEach((e) => { zeilen.push(zeile("")); listeZeilen([["Name", textVon(e.k)], ["Value", listenWert(e.w)]]).forEach((z) => zeilen.push(z)); });
          return;
        }
        if (ctx.hat("Property")) {
          const namen = namenExpandieren(o, alsListe(ctx.wert("Property")));
          paare = namen.map((n) => [n.name, listenWert(n.spec instanceof PSHashtable || n.spec instanceof Skriptblock ? eigenschaftWert(s, o, n.spec, ctx.ber) : o instanceof PSObjekt ? eig(o, n.spec) : memberHolen(o, n.spec, s))]);
        } else if (o instanceof PSObjekt && LISTEN_STANDARD[o.typ]) {
          paare = LISTEN_STANDARD[o.typ].map((n) => [n, listenWert(eig(o, n))]);
        } else if (istEinfach(o)) {
          zeilen.push(zeile(textVon(o)));
          return;
        } else paare = listePaare(ansichtFuer(o), o);
        const kopf = o instanceof PSObjekt && /^System\.IO\.(File|Directory)Info$/.test(o.typ) && !ctx.hat("Property") ? "    Directory: " + o._elternText : null;
        zeilen.push(zeile(""));
        if (kopf && kopf !== gruppe) { gruppe = kopf; zeilen.push(zeile(kopf)); zeilen.push(zeile("")); }
        listeZeilen(paare).forEach((z) => zeilen.push(z));
      });
      if (objekte.length) zeilen.push(zeile(""));
      return formatObjekte(zeilen, objekte.length, false);
    },
  });

  cmdlet("Format-Wide", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const objekte = eingabeVon(ctx).filter((x) => x !== null);
      const spec = ctx.hat("Property") ? ctx.wert("Property") : null;
      const text = (o) => {
        if (spec !== null) return textVon(eigenschaftWert(s, o, spec, ctx.ber));
        if (o instanceof PSObjekt && /^System\.IO\.(File|Directory)Info$/.test(o.typ)) return textVon(eig(o, "Name"));
        if (o instanceof PSObjekt && o.typ === "System.Diagnostics.Process") return textVon(eig(o, "ProcessName"));
        if (o instanceof PSObjekt && o.typ === "System.ServiceProcess.ServiceController") return textVon(eig(o, "Name"));
        if (o instanceof PSObjekt && !o.typen.includes(CUSTOM)) return textVon(o);
        if (o instanceof PSObjekt) return textVon(eig(o, o.namen()[0]));
        return textVon(o);
      };
      let spalten = ctx.hat("Column") ? Math.max(1, zahlWert(ctx.wert("Column"))) : 2;
      const texte = objekte.map(text);
      if (ctx.schalter("AutoSize")) {
        const b = texte.reduce((m, t) => Math.max(m, t.length), 1) + 2;
        spalten = Math.max(1, Math.floor(BREITE / b));
      }
      const breite = Math.floor(BREITE / spalten);
      const zeilen = [];
      let gruppe = null, reihe = [];
      // Erste Spalte ist ein Zeichen breiter (wie pwsh 7: 61 / 41 + 40 + 40 …)
      const leeren = () => { if (reihe.length) { zeilen.push(zeile(reihe.map((t, i) => { const b = i === 0 ? breite + 1 : breite; return i < reihe.length - 1 ? links(kuerzen(t, b - 1), b) : kuerzen(t, b - 1); }).join(""))); reihe = []; } };
      objekte.forEach((o, i) => {
        const kopf = o instanceof PSObjekt && /^System\.IO\.(File|Directory)Info$/.test(o.typ) ? "    Directory: " + o._elternText : null;
        if (i === 0 || (kopf && kopf !== gruppe)) {
          leeren();
          zeilen.push(zeile(""));
          if (kopf) { zeilen.push(zeile(kopf)); zeilen.push(zeile("")); }
          gruppe = kopf;
        }
        reihe.push(texte[i]);
        if (reihe.length === spalten) leeren();
      });
      leeren();
      if (objekte.length) zeilen.push(zeile(""));
      return formatObjekte(zeilen, objekte.length, false);
    },
  });

  /* ---------- CSV ---------- */

  function csvZeilen(objekte, trenner, o) {
    o = o || {};
    const liste = objekte.filter((x) => x !== null && x !== undefined);
    if (!liste.length) return [];
    const erstes = liste[0];
    const namen = erstes instanceof PSObjekt ? sichtbareNamen(erstes) : erstes instanceof PSHashtable ? ["IsReadOnly", "IsFixedSize", "IsSynchronized", "Keys", "Values", "SyncRoot", "Count"] : ["Length"];
    const quoten = klein(o.quotes || "always");
    const q = (v) => {
      if (v === null || v === undefined) return "";
      const t = textVon(v);
      if (quoten === "never") return t;
      if (quoten === "asneeded" && !/[",\r\n]/.test(t) && !t.includes(trenner)) return t;
      return '"' + t.replace(/"/g, '""') + '"';
    };
    const out = [];
    if (o.typ) out.push("#TYPE " + (erstes instanceof PSObjekt ? erstes.typ : typNameVon(erstes)));
    if (!o.ohneKopf) out.push(namen.map((n) => q(n)).join(trenner));
    liste.forEach((x) => out.push(namen.map((n) => q(x instanceof PSObjekt ? eig(x, n) : memberHolen(x, n))).join(trenner)));
    return out;
  }
  const trennerVon = (ctx) => (ctx.schalter("UseCulture") ? ";" : ctx.hat("Delimiter") ? textVon(ctx.wert("Delimiter")).charAt(0) || "," : ",");

  function csvLesen(zeilen, trenner, kopf) {
    const felder = (z) => {
      const out = [];
      let i = 0, f = "", inQ = false, quoted = false;
      for (; i < z.length; i++) {
        const c = z.charAt(i);
        if (inQ) {
          if (c === '"' && z.charAt(i + 1) === '"') { f += '"'; i++; }
          else if (c === '"') inQ = false;
          else f += c;
        } else if (c === '"') { inQ = true; quoted = true; }
        else if (c === trenner) { out.push(f); f = ""; quoted = false; }
        else f += c;
      }
      out.push(f);
      return out;
    };
    const rest = zeilen.filter((z) => z.trim() !== "" && !/^#TYPE /.test(z));
    if (!rest.length) return [];
    const namen = kopf ? kopf.map(textVon) : felder(rest.shift());
    return rest.map((z) => {
      const f = felder(z);
      return neuesObjekt(namen.map((n, i) => [n || "H" + (i + 1), f[i] === undefined ? null : f[i]]));
    });
  }

  cmdlet("Export-Csv", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const pfad = textVon(ctx.wert("Path") || ctx.wert("LiteralPath") || "");
      if (!pfad) throw ctx.abbruch({ meldung: "Cannot perform operation because the path resolved to more than one file. This command cannot operate on multiple files.", kategorie: "InvalidArgument" });
      const r = s.pfadAufloesen(pfad);
      const alt = s.welt.knoten(r.teile);
      if (ctx.schalter("NoClobber") && alt) { ctx.fehler({ meldung: "The file '" + s.ortText("C", r.teile) + "' already exists.", kategorie: "ResourceExists", ausnahme: "System.IO.IOException" }); return []; }
      if (!ctx.sollen("Export-Csv", s.ortText(r.laufwerk, r.teile))) return [];
      const anhaengen = ctx.schalter("Append") && alt && alt.inhalt;
      const zeilen = csvZeilen(eingabeVon(ctx), trennerVon(ctx), { typ: ctx.schalter("IncludeTypeInformation"), quotes: ctx.wert("UseQuotes"), ohneKopf: ctx.schalter("NoHeader") || anhaengen });
      dateiInhaltSchreiben(s, pfad, zeilen, !!anhaengen, "Export-Csv");
      return [];
    },
  });
  cmdlet("ConvertTo-Csv", "U", {
    pipeline: ["InputObject"],
    run: (ctx) => csvZeilen(eingabeVon(ctx), trennerVon(ctx), { typ: ctx.schalter("IncludeTypeInformation"), quotes: ctx.wert("UseQuotes"), ohneKopf: ctx.schalter("NoHeader") }),
  });
  cmdlet("Import-Csv", "U", {
    pipeline: ["Path", "LiteralPath"],
    run(ctx) {
      const s = ctx.sitzung;
      const out = [];
      for (const p of pfadeAusCtx(ctx, "Path")) {
        const f = pfadeFinden(s, p.text, { literal: p.literal, force: true });
        if (!f.treffer.length) {
          ctx.fehler({ meldung: "Could not find file '" + f.voll + "'.", kategorie: "OpenError", ausnahme: "System.IO.FileNotFoundException", id: "FileOpenFailure", ziel: f.voll });
          continue;
        }
        f.treffer.forEach((t) => {
          const z = inhaltZeilen(t.knoten);
          if (z === null) { ctx.hinweis("Für «" + t.knoten.name + "» ist im Simulator kein Inhalt hinterlegt."); return; }
          csvLesen(z, trennerVon(ctx), ctx.wert("Header")).forEach((o) => out.push(o));
        });
      }
      return out;
    },
  });
  cmdlet("ConvertFrom-Csv", "U", {
    pipeline: ["InputObject"],
    run: (ctx) => csvLesen(eingabeVon(ctx).map(textVon).join("\n").split(/\r?\n/), trennerVon(ctx), ctx.wert("Header")),
  });

  /* ---------- JSON ---------- */

  function jsonText(v, tiefe, maxTiefe, o, abgeschnitten) {
    if (v instanceof Faul) v = v.fn();
    if (v === null || v === undefined) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (istZahl(v)) { const w = zahlWert(v); if (!Number.isFinite(w)) return '"' + g15(w) + '"'; return v instanceof PSDouble ? w + ".0" : String(w); }
    if (typeof v === "string") return JSON.stringify(v);
    if (v instanceof PSDatum) return '"' + datumFormat(v, "yyyy'-'MM'-'dd'T'HH':'mm':'ss") + '"';
    if (v instanceof PSEnum) return o.enumsAlsText ? JSON.stringify(v.name) : String(v.wert);
    if (v instanceof Skriptblock) return JSON.stringify(v.text);
    if (v instanceof PSZeitspanne) v = neuesObjekt(["Ticks", "Days", "Hours", "Milliseconds", "Minutes", "Seconds", "TotalDays", "TotalHours", "TotalMilliseconds", "TotalMinutes", "TotalSeconds"].map((n) => [n, memberHolen(v, n)]));
    const einzug = o.kompakt ? "" : "\n" + "  ".repeat(tiefe + 1);
    const schluss = o.kompakt ? "" : "\n" + "  ".repeat(tiefe);
    const doppel = o.kompakt ? ":" : ": ";
    if (tiefe > maxTiefe) { abgeschnitten.ja = true; return JSON.stringify(textVon(v)); }
    if (Array.isArray(v)) {
      if (!v.length) return "[]";
      return "[" + v.map((x) => einzug + jsonText(x, tiefe + 1, maxTiefe, o, abgeschnitten)).join(",") + schluss + "]";
    }
    let paare;
    if (v instanceof PSHashtable) paare = v.eintraege().map((e) => [textVon(e.k), e.w]);
    else if (v instanceof PSObjekt) paare = sichtbareNamen(v).map((n) => [n, v.wert(n)]);
    else if (v instanceof FehlerDatensatz) paare = [["Exception", v.meldung], ["TargetObject", v.ziel], ["FullyQualifiedErrorId", v.id]];
    else return JSON.stringify(textVon(v));
    if (!paare.length) return "{}";
    return "{" + paare.map(([k, w]) => einzug + JSON.stringify(k) + doppel + jsonText(w, tiefe + 1, maxTiefe, o, abgeschnitten)).join(",") + schluss + "}";
  }

  cmdlet("ConvertTo-Json", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const eingabe = eingabeVon(ctx);
      const tiefe = ctx.hat("Depth") ? zahlWert(ctx.wert("Depth")) : 2;
      const v = eingabe.length === 1 && !ctx.schalter("AsArray") ? eingabe[0] : eingabe;
      const ab = { ja: false };
      const text = jsonText(v, 0, tiefe, { kompakt: ctx.schalter("Compress"), enumsAlsText: ctx.schalter("EnumsAsStrings") }, ab);
      if (ab.ja) ctx.warnung("Resulting JSON is truncated as serialization has exceeded the set depth of " + tiefe + ".");
      return [text];
    },
  });

  // Kleiner JSON-Parser, der Ganzzahlen und Kommazahlen unterscheidet
  function jsonLesen(text, alsHash) {
    let i = 0;
    const fehler = (was) => abbruch({ meldung: "Conversion from JSON failed with error: " + was + " Path '', line 1, position " + i + ".", befehl: "ConvertFrom-Json",
      kategorie: "ParserError", ausnahme: "System.ArgumentException", id: "System.ArgumentException,Microsoft.PowerShell.Commands.ConvertFromJsonCommand" });
    const leer = () => { while (/\s/.test(text.charAt(i))) i++; };
    const wert = () => {
      leer();
      const c = text.charAt(i);
      if (c === "{") {
        i++;
        const h = alsHash ? new PSHashtable(true) : null;
        const o = alsHash ? null : neuesObjekt([]);
        leer();
        if (text.charAt(i) === "}") { i++; return h || o; }
        for (;;) {
          leer();
          if (text.charAt(i) !== '"') throw fehler("Invalid property identifier character: " + text.charAt(i) + ".");
          const k = zeichenkette();
          leer();
          if (text.charAt(i) !== ":") throw fehler("Invalid character after parsing property name. Expected ':' but got: " + text.charAt(i) + ".");
          i++;
          const w = wert();
          if (h) h.setzen(k, w); else o.setzen(k, w);
          leer();
          if (text.charAt(i) === ",") { i++; continue; }
          if (text.charAt(i) === "}") { i++; return h || o; }
          throw fehler("After parsing a value an unexpected character was encountered: " + text.charAt(i) + ".");
        }
      }
      if (c === "[") {
        i++;
        const a = [];
        leer();
        if (text.charAt(i) === "]") { i++; return a; }
        for (;;) {
          a.push(wert());
          leer();
          if (text.charAt(i) === ",") { i++; continue; }
          if (text.charAt(i) === "]") { i++; return a; }
          throw fehler("After parsing a value an unexpected character was encountered: " + text.charAt(i) + ".");
        }
      }
      if (c === '"') {
        const s = zeichenkette();
        const d = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) ? datumLesen(s.replace(/\.\d+$/, ""), false) : null;
        return d || s;
      }
      const m = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(i));
      if (m) { i += m[0].length; return m[1] || m[2] ? alsDouble(Number(m[0])) : Number(m[0]); }
      if (text.startsWith("true", i)) { i += 4; return true; }
      if (text.startsWith("false", i)) { i += 5; return false; }
      if (text.startsWith("null", i)) { i += 4; return null; }
      throw fehler("Unexpected character encountered while parsing value: " + (c || "") + ".");
    };
    const zeichenkette = () => {
      let s = "";
      i++;
      for (;;) {
        const c = text.charAt(i++);
        if (c === "") throw fehler("Unterminated string.");
        if (c === '"') return s;
        if (c === "\\") {
          const e = text.charAt(i++);
          if (e === "u") { s += String.fromCharCode(parseInt(text.substr(i, 4), 16)); i += 4; }
          else s += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f" }[e] || e;
        } else s += c;
      }
    };
    const v = wert();
    leer();
    if (i < text.length) throw fehler("Additional text encountered after finished reading JSON content: " + text.charAt(i) + ".");
    return v;
  }

  cmdlet("ConvertFrom-Json", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const text = eingabeVon(ctx).map(textVon).join("\n");
      const v = jsonLesen(text, ctx.schalter("AsHashtable"));
      return Array.isArray(v) && !ctx.schalter("NoEnumerate") ? v : [v];
    },
  });

  /* ---------- ConvertTo-Html ---------- */

  const htmlEsc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  cmdlet("ConvertTo-Html", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      const objekte = eingabeVon(ctx).filter((x) => x !== null);
      const specs = ctx.hat("Property") ? alsListe(ctx.wert("Property")) : objekte.length ? sichtbareNamen(objekte[0]) : [];
      const spalten = objekte.length ? spaltenAusSpecs(s, objekte, specs.length ? specs : ["*"], ctx) : [];
      const tab = ["<table>", "<colgroup>" + spalten.map(() => "<col/>").join("") + "</colgroup>", "<tr>" + spalten.map((c) => "<th>" + htmlEsc(c.kopf) + "</th>").join("") + "</tr>"];
      objekte.forEach((o) => tab.push("<tr>" + spalten.map((c) => "<td>" + htmlEsc(listenWert(c.wertVon(o))) + "</td>").join("") + "</tr>"));
      tab.push("</table>");
      const vor = alsListe(ctx.wert("PreContent") || []).map(textVon), nach = alsListe(ctx.wert("PostContent") || []).map(textVon);
      if (ctx.schalter("Fragment")) return vor.concat(tab, nach);
      const titel = ctx.hat("Title") ? textVon(ctx.wert("Title")) : "HTML TABLE";
      return ['<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN"  "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">', '<html xmlns="http://www.w3.org/1999/xhtml">', "<head>",
        ctx.hat("Head") ? alsListe(ctx.wert("Head")).map(textVon).join("\n") : "<title>" + htmlEsc(titel) + "</title>", "</head><body>"]
        .concat(alsListe(ctx.wert("Body") || []).map(textVon), vor, tab, nach, ["</body></html>"]);
    },
  });

  /* ---------- Write-*, Out-*, Clear-Host ---------- */

  cmdlet("Write-Host", "U", {
    restParameter: "Object",
    run(ctx) {
      const teile = ctx.hat("Object") ? alsListe(ctx.wert("Object")) : [];
      const sep = ctx.hat("Separator") ? textVon(ctx.wert("Separator")) : " ";
      const text = teile.map((t) => (Array.isArray(t) ? t.map(textVon).join(sep) : textVon(t))).join(sep);
      ctx.sitzung.strom.push({ art: "host", text: text, farbe: ctx.hat("ForegroundColor") ? textVon(ctx.wert("ForegroundColor")) : null, ohneUmbruch: ctx.schalter("NoNewline") });
      return [];
    },
  });
  cmdlet("Write-Output", "U", {
    pipeline: ["InputObject"],
    restParameter: "InputObject",
    run(ctx) {
      const w = ctx.hat("InputObject") ? ctx.wert("InputObject") : null;
      if (ctx.schalter("NoEnumerate")) return [w];
      return ctx.p._rest ? ctx.p._rest.flatMap((x) => (Array.isArray(x) ? x : [x])) : alsListe(w);
    },
  });
  cmdlet("Write-Error", "U", {
    run(ctx) {
      const m = ctx.hat("Message") ? textVon(ctx.wert("Message")) : ctx.hat("Exception") ? textVon(ctx.wert("Exception")) : "";
      ctx.fehler({ meldung: m, befehl: "Write-Error", kategorie: ctx.hat("Category") ? textVon(ctx.wert("Category")) : "NotSpecified",
        ausnahme: "Microsoft.PowerShell.Commands.WriteErrorException", id: ctx.hat("ErrorId") ? textVon(ctx.wert("ErrorId")) : "Microsoft.PowerShell.Commands.WriteErrorException" });
      return [];
    },
  });
  cmdlet("Write-Warning", "U", { run(ctx) { ctx.warnung(textVon(ctx.wert("Message"))); return []; } });
  cmdlet("Write-Verbose", "U", {
    run(ctx) {
      if (ctx.p.verbose || klein(textVon(ctx.sitzung.varHolen("VerbosePreference", null, ctx.ber) || "")) === "continue") ctx.host("VERBOSE: " + textVon(ctx.wert("Message")), "Yellow");
      return [];
    },
  });
  cmdlet("Out-Null", "C", { pipeline: ["InputObject"], run: () => [] });
  cmdlet("Out-Host", "C", {
    pipeline: ["InputObject"],
    run(ctx) { eingabeVon(ctx).forEach((x) => ctx.sitzung.strom.push({ art: "objekt", wert: x })); return []; },
  });
  cmdlet("Out-String", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const text = formatierenAlsText(eingabeVon(ctx));
      if (ctx.schalter("Stream")) return text.split("\n");
      // Windows: Zeilenende CRLF wie Environment.NewLine
      return [text.replace(/\n/g, "\r\n") + (ctx.schalter("NoNewline") ? "" : "\r\n")];
    },
  });
  cmdlet("Clear-Host", "F", { syntax: ["Clear-Host"], run(ctx) { ctx.sitzung.strom.push({ art: "leeren" }); return []; } });
  cmdlet("Start-Sleep", "U", { run: () => [] });

  /* ---------- Get-Date, New-TimeSpan, Get-Culture ---------- */

  function uFormat(d, f) {
    const p = datumTeile(d);
    const tab = { Y: String(p.j), y: zwei(p.j % 100), m: zwei(p.m), d: zwei(p.t), e: String(p.t).padStart(2, " "), H: zwei(p.h), I: zwei(p.h % 12 || 12), M: zwei(p.min), S: zwei(p.s),
      A: TAGE[p.wt], a: TAGE_KURZ[p.wt], B: MONATE[p.m - 1], b: MONATE_KURZ[p.m - 1], h: MONATE_KURZ[p.m - 1], j: String(memberHolen(d, "DayOfYear")).padStart(3, "0"),
      u: String(p.wt || 7), w: String(p.wt), D: zwei(p.m) + "/" + zwei(p.t) + "/" + zwei(p.j % 100), F: p.j + "-" + zwei(p.m) + "-" + zwei(p.t), T: zwei(p.h) + ":" + zwei(p.min) + ":" + zwei(p.s),
      R: zwei(p.h) + ":" + zwei(p.min), n: "\n", t: "\t", "%": "%", p: p.h < 12 ? "AM" : "PM", s: String(Math.floor(nachUtc(d.ms) / 1000)) };
    return f.replace(/%(.)/g, (m, c) => (tab[c] !== undefined ? tab[c] : m));
  }
  cmdlet("Get-Date", "U", {
    run(ctx) {
      let d = ctx.hat("Date") ? ctx.wert("Date") : new PSDatum(JETZT.ms);
      if (ctx.hat("UnixTimeSeconds")) d = new PSDatum(ausUtc(zahlWert(ctx.wert("UnixTimeSeconds")) * 1000));
      const p = datumTeile(d);
      const teil = (n, alt) => (ctx.hat(n) ? zahlWert(ctx.wert(n)) : alt);
      d = new PSDatum(Date.UTC(teil("Year", p.j), teil("Month", p.m) - 1, teil("Day", p.t), teil("Hour", p.h), teil("Minute", p.min), teil("Second", p.s), teil("Millisecond", p.ms)));
      if (ctx.hat("Format")) return [datumFormat(d, textVon(ctx.wert("Format")))];
      if (ctx.hat("UFormat")) return [uFormat(d, textVon(ctx.wert("UFormat")))];
      if (ctx.schalter("AsUTC")) d = new PSDatum(nachUtc(d.ms));
      d._hinweis = true;
      d._anzeige = ctx.hat("DisplayHint") ? textVon(ctx.wert("DisplayHint")) : "DateTime";
      return [d];
    },
  });
  cmdlet("New-TimeSpan", "U", {
    run(ctx) {
      if (ctx.hat("Start") || ctx.hat("End")) {
        const a = ctx.hat("Start") ? ctx.wert("Start") : new PSDatum(JETZT.ms);
        const b = ctx.hat("End") ? ctx.wert("End") : new PSDatum(JETZT.ms);
        return [new PSZeitspanne(b.ms - a.ms)];
      }
      const z = (n) => (ctx.hat(n) ? zahlWert(ctx.wert(n)) : 0);
      return [new PSZeitspanne(z("Days") * 86400000 + z("Hours") * 3600000 + z("Minutes") * 60000 + z("Seconds") * 1000 + z("Milliseconds"))];
    },
  });
  cmdlet("Get-Culture", "U", {
    run: () => [new PSObjekt(["System.Globalization.CultureInfo"], [["LCID", 2055], ["Name", "de-CH"], ["DisplayName", "German (Switzerland)"]], { LCID: "Property", Name: "Property", DisplayName: "Property" })],
  });

  /* ---------- Aliase wie in pwsh 7 unter Windows ---------- */

  const ALIASE = {};
  ("?=Where-Object %=ForEach-Object ac=Add-Content cat=Get-Content cd=Set-Location chdir=Set-Location clc=Clear-Content clear=Clear-Host clhy=Clear-History " +
    "cli=Clear-Item clp=Clear-ItemProperty cls=Clear-Host clv=Clear-Variable cnsn=Connect-PSSession compare=Compare-Object copy=Copy-Item cp=Copy-Item cpi=Copy-Item " +
    "cpp=Copy-ItemProperty cvpa=Convert-Path dbp=Disable-PSBreakpoint del=Remove-Item diff=Compare-Object dir=Get-ChildItem dnsn=Disconnect-PSSession " +
    "ebp=Enable-PSBreakpoint echo=Write-Output epal=Export-Alias epcsv=Export-Csv erase=Remove-Item etsn=Enter-PSSession exsn=Exit-PSSession fc=Format-Custom " +
    "fhx=Format-Hex fl=Format-List foreach=ForEach-Object ft=Format-Table fw=Format-Wide gal=Get-Alias gbp=Get-PSBreakpoint gc=Get-Content gcb=Get-Clipboard " +
    "gci=Get-ChildItem gcm=Get-Command gcs=Get-PSCallStack gdr=Get-PSDrive gerr=Get-Error ghy=Get-History gi=Get-Item gin=Get-ComputerInfo gjb=Get-Job " +
    "gl=Get-Location gm=Get-Member gmo=Get-Module gp=Get-ItemProperty gps=Get-Process gpv=Get-ItemPropertyValue group=Group-Object gsn=Get-PSSession " +
    "gsv=Get-Service gtz=Get-TimeZone gu=Get-Unique gv=Get-Variable h=Get-History history=Get-History icm=Invoke-Command iex=Invoke-Expression " +
    "ihy=Invoke-History ii=Invoke-Item ipal=Import-Alias ipcsv=Import-Csv ipmo=Import-Module irm=Invoke-RestMethod iwr=Invoke-WebRequest kill=Stop-Process " +
    "ls=Get-ChildItem man=help md=mkdir measure=Measure-Object mi=Move-Item mount=New-PSDrive move=Move-Item mp=Move-ItemProperty mv=Move-Item nal=New-Alias " +
    "ndr=New-PSDrive ni=New-Item nmo=New-Module nsn=New-PSSession nv=New-Variable ogv=Out-GridView oh=Out-Host popd=Pop-Location ps=Get-Process " +
    "pushd=Push-Location pwd=Get-Location r=Invoke-History rbp=Remove-PSBreakpoint rcjb=Receive-Job rcsn=Receive-PSSession rd=Remove-Item rdr=Remove-PSDrive " +
    "ren=Rename-Item ri=Remove-Item rjb=Remove-Job rm=Remove-Item rmdir=Remove-Item rmo=Remove-Module rni=Rename-Item rnp=Rename-ItemProperty " +
    "rp=Remove-ItemProperty rsn=Remove-PSSession rv=Remove-Variable rvpa=Resolve-Path sajb=Start-Job sal=Set-Alias saps=Start-Process sasv=Start-Service " +
    "sbp=Set-PSBreakpoint scb=Set-Clipboard select=Select-Object set=Set-Variable shcm=Show-Command si=Set-Item sl=Set-Location sleep=Start-Sleep " +
    "sls=Select-String sort=Sort-Object sp=Set-ItemProperty spjb=Stop-Job spps=Stop-Process spsv=Stop-Service start=Start-Process stz=Set-TimeZone " +
    "sv=Set-Variable tee=Tee-Object type=Get-Content where=Where-Object wjb=Wait-Job write=Write-Output").split(" ").forEach((p) => {
    const i = p.indexOf("=");
    ALIASE[klein(p.slice(0, i))] = p.slice(i + 1);
  });
  const ALIAS_NAMEN = {};
  Object.keys(ALIASE).forEach((k) => { ALIAS_NAMEN[k] = k; });

  // Echte Befehle, die der Simulator nicht nachbaut (freundlicher Hinweis statt «not recognized»)
  const ECHTE_BEFEHLE = new Map();
  ECHTE_LISTE.split(",").forEach((n) => ECHTE_BEFEHLE.set(klein(n), n));
  ["ping", "ipconfig", "netstat", "tracert", "nslookup", "notepad", "explorer", "calc", "mspaint", "winget", "code", "git", "systeminfo", "tasklist", "taskkill", "robocopy", "xcopy"]
    .forEach((n) => ECHTE_BEFEHLE.set(n, n));

  // Echte Cmdlets, die Get-Command wie pwsh auflistet (Get-Command -Noun Service, Item, Process, Location),
  // die der Simulator aber nicht nachbaut: Aufruf und Get-Help geben den Hinweis «im Simulator nicht nachgebaut»
  ["New-Service", "Remove-Service", "Resume-Service", "Set-Service", "Suspend-Service", "Clear-Item", "Invoke-Item", "Set-Item",
    "Debug-Process", "Start-Process", "Wait-Process", "Pop-Location", "Push-Location"].forEach((n) => cmdlet(n, "M", { nurBekannt: true }));

  // Klassische Programme mit einfacher Ausgabe
  const EXTERN = {
    hostname: (s) => [s.welt.computer],
    whoami: (s) => [klein(s.welt.domaene) + "\\" + s.welt.benutzer],
  };

  /* ---------- Funktionen von pwsh: help, cd.., Laufwerke ---------- */

  cmdlet("help", "F", {
    syntax: ["help [[-Name] <string>] [-Path <string>] [-Category <string[]>] [-Full] [-Detailed] [-Examples] [-Parameter <string[]>] [-Online] [<CommonParameters>]"],
    run: (ctx) => CMDLETS["get-help"].run(ctx),
  });
  [["cd..", ".."], ["cd\\", "\\"], ["cd~", "~"]].forEach(([n, ziel]) => cmdlet(n, "F", {
    syntax: [n + " [<CommonParameters>]"],
    run(ctx) { ctx.p.path = ziel; return CMDLETS["set-location"].run(ctx); },
  }));
  "abcdefghijklmnopqrstuvwxyz".split("").forEach((b) => cmdlet(b.toUpperCase() + ":", "F", {
    syntax: [b.toUpperCase() + ": [<CommonParameters>]"],
    run(ctx) { ctx.p.path = b.toUpperCase() + ":"; return CMDLETS["set-location"].run(ctx); },
  }));

  /* ---------- Get-Member ---------- */

  const KURZTYP = { "System.String": "string", "System.Int32": "int", "System.Int64": "long", "System.Double": "double", "System.Boolean": "bool",
    "System.DateTime": "datetime", "System.Object[]": "Object[]", "System.Collections.Hashtable": "hashtable", "System.TimeSpan": "timespan" };
  function kurzTyp(v) {
    if (v instanceof Faul) v = v.fn();
    if (v === null || v === undefined) return "object";
    const t = v instanceof PSObjekt ? v.typ : typVon(v) ? typVon(v).voll : "System.Object";
    return KURZTYP[t] || t;
  }
  const MEMBER_TABELLE = {};
  Object.keys(MEMBER_DATEN).forEach((t) => { MEMBER_TABELLE[t] = MEMBER_DATEN[t].split("\n").map((z) => z.split("|")); });
  const BASIS_METHODEN = [["Equals", "Method", "bool Equals(System.Object obj)"], ["GetHashCode", "Method", "int GetHashCode()"], ["GetType", "Method", "type GetType()"], ["ToString", "Method", "string ToString()"]];

  // Alle Member eines Werts als [Name, MemberType, Definition]
  function memberListe(v) {
    if (v instanceof Faul) v = v.fn();
    const typName = v instanceof PSObjekt ? v.typ : Array.isArray(v) ? "System.Object[]" : typVon(v) ? typVon(v).voll : "System.Object";
    let liste = (MEMBER_TABELLE[typName] || []).slice();
    if (!liste.length && v instanceof PSObjekt) {
      liste = BASIS_METHODEN.slice();
      if (!v.typen.includes(CUSTOM) && !v.typen.some((t) => t.startsWith("Selected."))) {
        sichtbareNamen(v).forEach((n) => { if (v.art(n) !== "NoteProperty") liste.push([n, v.art(n), kurzTyp(eig(v, n)) + " " + n + " {get;}"]); });
      }
    }
    if (!liste.length && (istZahl(v) && istDouble(v))) liste = MEMBER_TABELLE["System.Double"].slice();
    if (!liste.length && v instanceof PSEnum) liste = BASIS_METHODEN.concat([["value__", "Property", "int value__ {get;set;}"]]);
    if (!liste.length) liste = BASIS_METHODEN.slice();
    if (v instanceof PSObjekt) {
      sichtbareNamen(v).forEach((n) => {
        if (v.art(n) !== "NoteProperty") return;
        const w = eig(v, n);
        liste.push([n, "NoteProperty", kurzTyp(w) + " " + n + "=" + (w === null || w === undefined ? "null" : textVon(w))]);
      });
    }
    if (v instanceof PSDatum && v._hinweis) liste.push(["DisplayHint", "NoteProperty", "DisplayHintType DisplayHint=DateTime"]);
    return liste;
  }

  const MEMBER_ARTEN = ["AliasProperty", "CodeProperty", "Property", "NoteProperty", "ScriptProperty", "Properties", "PropertySet", "Method", "CodeMethod",
    "ScriptMethod", "Methods", "ParameterizedProperty", "MemberSet", "Event", "Dynamic", "All"];
  cmdlet("Get-Member", "U", {
    pipeline: ["InputObject"],
    run(ctx) {
      const eingabe = ctx.hat("InputObject") ? [ctx.wert("InputObject")] : ctx.eingabe || [];
      if (!eingabe.length || (eingabe.length === 1 && eingabe[0] === null && !ctx.hat("InputObject"))) {
        throw ctx.abbruch({ meldung: "You must specify an object for the Get-Member cmdlet.", kategorie: "CloseError", ausnahme: "System.InvalidOperationException", id: "NoObjectInGetMember" });
      }
      const arten = ctx.hat("MemberType") ? alsListe(ctx.wert("MemberType")).flatMap((x) => textVon(x).split(/\s*,\s*/)) : null;
      if (arten) arten.forEach((a) => {
        if (!MEMBER_ARTEN.some((m) => gleichCI(m, a))) throw ctx.abbruch({ meldung: "Cannot bind parameter 'MemberType'. Cannot convert value \"" + a + "\" to type \"System.Management.Automation.PSMemberTypes\". Error: \"Unable to match the identifier name " + a + " to a valid enumerator name. Specify one of the following enumerator names and try again:\n" + MEMBER_ARTEN.join(", ") + "\"", kategorie: "InvalidArgument" });
      });
      const passtArt = (k) => !arten || arten.some((a) => gleichCI(a, k) || gleichCI(a, "All") || (gleichCI(a, "Properties") && /Property$/.test(k)) || (gleichCI(a, "Methods") && /Method$/.test(k)));
      const namen = ctx.hat("Name") ? alsListe(ctx.wert("Name")).map(textVon) : null;
      const gesehen = new Set();
      const out = [];
      eingabe.forEach((v) => {
        if (v === null) return;
        const typName = v instanceof PSObjekt ? v.typ : Array.isArray(v) && ctx.hat("InputObject") ? "System.Object[]" : typVon(v) ? typVon(v).voll : "System.Object";
        if (gesehen.has(typName)) return;
        gesehen.add(typName);
        memberListe(v)
          .filter((m) => passtArt(m[1]) && (!namen || namen.some((n) => passt(m[0], n))))
          .sort((a, b) => ordinalCI(a[1], b[1]) || ordinalCI(a[0], b[0]))
          .forEach((m) => out.push(new PSObjekt(["Microsoft.PowerShell.Commands.MemberDefinition"], [["TypeName", typName], ["Name", m[0]], ["MemberType", new PSEnum("System.Management.Automation.PSMemberTypes", m[1], 0)], ["Definition", m[2]]],
            { TypeName: "Property", Name: "Property", MemberType: "Property", Definition: "Property" })));
      });
      return out;
    },
  });

  /* ---------- Get-Command, Get-Alias, Get-Verb ---------- */

  function befehlsObjekt(s, art, name, ziel) {
    if (art === "Alias") {
      const o = new PSObjekt(["System.Management.Automation.AliasInfo"], [["CommandType", new PSEnum("System.Management.Automation.CommandTypes", "Alias", 1)], ["Name", name],
        ["DisplayName", name + " -> " + ziel], ["Definition", ziel], ["ReferencedCommand", ziel], ["ResolvedCommandName", ziel], ["Version", ""], ["Source", ""]]);
      o._versteckt = ["DisplayName", "ReferencedCommand", "ResolvedCommandName"];
      o._text = () => name;
      return o;
    }
    const def = CMDLETS[klein(name)];
    const funktion = art === "Function";
    const o = new PSObjekt([funktion ? "System.Management.Automation.FunctionInfo" : "System.Management.Automation.CmdletInfo"], [
      ["CommandType", new PSEnum("System.Management.Automation.CommandTypes", art, funktion ? 2 : 8)], ["Name", def ? def.name : name],
      ["Version", def ? def.version : ""], ["Source", def ? def.modul : ""], ["ModuleName", def ? def.modul : ""],
      ["Verb", (name.split("-")[0] || "")], ["Noun", name.includes("-") ? name.split("-").slice(1).join("-") : ""],
      ["Definition", def ? def.syntax.map((z) => z.replace(/^\S+\s*/, "")).join("\n\n") : ""]]);
    o._versteckt = ["ModuleName", "Verb", "Noun", "Definition"];
    o._text = () => (def ? def.name : name);
    return o;
  }

  function alleBefehle(s) {
    const liste = [];
    Object.keys(ALIASE).sort(kulturVergleich).forEach((a) => {
      const ziel = ALIASE[a];
      if (CMDLETS[klein(ziel)]) liste.push({ art: "Alias", name: a, ziel: CMDLETS[klein(ziel)].name });
    });
    const f = [], c = [];
    Object.values(CMDLETS).forEach((d) => { if (/^[A-Z]:$/.test(d.name)) return; (d.art === "Function" ? f : c).push(d.name); });
    s.funktionen.forEach((x) => f.push(x.name));
    f.sort(kulturVergleich).forEach((n) => liste.push({ art: "Function", name: n }));
    c.sort(kulturVergleich).forEach((n) => liste.push({ art: "Cmdlet", name: n }));
    return liste;
  }

  cmdlet("Get-Command", "C", {
    run(ctx) {
      const s = ctx.sitzung;
      const alle = alleBefehle(s);
      let liste;
      const namen = ctx.hat("Name") ? alsListe(ctx.wert("Name")).map(textVon) : null;
      if (namen) {
        liste = [];
        namen.forEach((n) => {
          const treffer = hatPlatzhalter(n) ? alle.filter((b) => passt(b.name, n)) : alle.filter((b) => gleichCI(b.name, n));
          if (!treffer.length && !hatPlatzhalter(n)) {
            if (ECHTE_BEFEHLE.has(klein(n))) { ctx.hinweis("«" + ECHTE_BEFEHLE.get(klein(n)) + "» gibt es in PowerShell, im Simulator ist der Befehl aber nicht nachgebaut."); return; }
            ctx.fehler({ meldung: "The term '" + n + "' is not recognized as a name of a cmdlet, function, script file, or executable program.\nCheck the spelling of the name, or if a path was included, verify that the path is correct and try again.",
              kategorie: "ObjectNotFound", ausnahme: "System.Management.Automation.CommandNotFoundException", id: "CommandNotFoundException", ziel: n });
          }
          treffer.forEach((t) => { if (!liste.includes(t)) liste.push(t); });
        });
      } else liste = alle.slice();
      if (ctx.hat("Verb")) liste = liste.filter((b) => b.art !== "Alias" && alsListe(ctx.wert("Verb")).some((v) => passt(b.name.split("-")[0], textVon(v)) && b.name.includes("-")));
      if (ctx.hat("Noun")) liste = liste.filter((b) => b.art !== "Alias" && b.name.includes("-") && alsListe(ctx.wert("Noun")).some((v) => passt(b.name.split("-").slice(1).join("-"), textVon(v))));
      if (ctx.hat("CommandType")) liste = liste.filter((b) => alsListe(ctx.wert("CommandType")).some((t) => gleichCI(textVon(t), b.art) || gleichCI(textVon(t), "All")));
      if ((ctx.hat("Verb") || ctx.hat("Noun")) && !namen) liste.sort((a, b) => kulturVergleich(a.name, b.name));
      if (ctx.hat("TotalCount")) liste = liste.slice(0, zahlWert(ctx.wert("TotalCount")));
      if (ctx.schalter("Syntax")) {
        const out = [];
        liste.forEach((b) => {
          const def = CMDLETS[klein(b.art === "Alias" ? b.ziel : b.name)];
          if (b.art === "Alias") out.push(b.name + " -> " + b.ziel);
          if (def) out.push("\n" + def.syntax.join("\n\n") + "\n");
          else if (s.funktionen.has(klein(b.name))) out.push(funktionsSyntax(s.funktionen.get(klein(b.name))));
        });
        return out;
      }
      return liste.map((b) => befehlsObjekt(s, b.art, b.name, b.ziel));
    },
  });

  function funktionsSyntax(f) {
    const p = f.sb.knoten.param || [];
    return f.name + " " + p.map((x, i) => (x.schalter ? "[-" + x.name + "]" : x.pflicht ? "[-" + x.name + "] <" + (x.typ || "Object") + ">" : "[[-" + x.name + "] <" + (x.typ || "Object") + ">]")).join(" ");
  }

  cmdlet("Get-Alias", "U", {
    run(ctx) {
      const s = ctx.sitzung;
      const alle = Object.keys(ALIASE).sort(kulturVergleich);
      let liste = [];
      if (ctx.hat("Definition")) {
        alsListe(ctx.wert("Definition")).map(textVon).forEach((d) => alle.forEach((a) => { if (passt(ALIASE[a], d) && !liste.includes(a)) liste.push(a); }));
      } else if (ctx.hat("Name")) {
        alsListe(ctx.wert("Name")).map(textVon).forEach((n) => {
          const t = hatPlatzhalter(n) ? alle.filter((a) => passt(a, n)) : alle.filter((a) => gleichCI(a, n));
          if (!t.length && !hatPlatzhalter(n)) {
            ctx.fehler({ meldung: "This command cannot find a matching alias because an alias with the name '" + n + "' does not exist.", kategorie: "ObjectNotFound",
              ausnahme: "System.Management.Automation.ItemNotFoundException", id: "ItemNotFoundException", ziel: n });
          }
          t.forEach((a) => liste.push(a));
        });
      } else liste = alle;
      if (ctx.hat("Exclude")) liste = liste.filter((a) => !alsListe(ctx.wert("Exclude")).some((m) => passt(a, textVon(m))));
      return liste.map((a) => befehlsObjekt(s, "Alias", a, ALIASE[a]));
    },
  });

  cmdlet("Get-Verb", "U", {
    run(ctx) {
      let liste = VERBEN.map((z) => z.split("|"));
      if (ctx.hat("Verb")) liste = liste.filter((v) => alsListe(ctx.wert("Verb")).some((m) => passt(v[0], textVon(m))));
      if (ctx.hat("Group")) liste = liste.filter((v) => alsListe(ctx.wert("Group")).some((m) => gleichCI(v[2], textVon(m))));
      return liste.map((v) => new PSObjekt(["System.Management.Automation.VerbInfo"], [["Verb", v[0]], ["AliasPrefix", v[1]], ["Group", v[2]], ["Description", v[3]]],
        { Verb: "Property", AliasPrefix: "Property", Group: "Property", Description: "Property" }));
    },
  });

  cmdlet("Get-History", "C", {
    run(ctx) {
      let liste = ctx.sitzung.verlauf.slice();
      if (ctx.hat("Id")) liste = liste.filter((h) => alsListe(ctx.wert("Id")).some((i) => zahlWert(i) === h.id));
      if (ctx.hat("Count")) liste = liste.slice(-zahlWert(ctx.wert("Count")));
      return liste.map((h) => {
        const start = new PSDatum(h.zeit), ende = new PSDatum(h.zeit + h.dauer);
        return new PSObjekt(["Microsoft.PowerShell.Commands.HistoryInfo"], [["Id", h.id], ["CommandLine", h.text], ["ExecutionStatus", new PSEnum("System.Management.Automation.Runspaces.PipelineState", "Completed", 4)],
          ["StartExecutionTime", start], ["EndExecutionTime", ende], ["Duration", new PSZeitspanne(h.dauer)], ["DurationSeconds", alsDouble(h.dauer / 1000)]],
          { Id: "Property", CommandLine: "Property", ExecutionStatus: "Property", StartExecutionTime: "Property", EndExecutionTime: "Property", Duration: "Property" });
      }).map((o) => { o._versteckt = ["DurationSeconds"]; return o; });
    },
  });

  /* ---------- Prozesse ---------- */

  function prozessObjekt(s, p) {
    const geschuetzt = p.system && !s.welt.admin;
    const start = new PSDatum(s.welt.zeit - 3600000 + (p.id % 3000) * 1000);
    const paare = [
      ["Name", p.name], ["Id", p.id], ["PriorityClass", geschuetzt ? null : new PSEnum("System.Diagnostics.ProcessPriorityClass", "Normal", 32)],
      ["HandleCount", 150 + (p.id % 900)], ["WorkingSet64", p.ws], ["PagedMemorySize64", p.pm], ["NonpagedSystemMemorySize64", p.npm],
      ["VirtualMemorySize64", p.ws * 4 + 1073741824], ["TotalProcessorTime", geschuetzt || p.cpu === null ? null : new PSZeitspanne(p.cpu * 1000)],
      ["SI", p.si], ["Handles", 150 + (p.id % 900)], ["VM", p.ws * 4 + 1073741824], ["WS", p.ws], ["PM", p.pm], ["NPM", p.npm],
      ["Path", geschuetzt ? null : p.pfad], ["Company", geschuetzt ? null : p.firma], ["CPU", geschuetzt || p.cpu === null ? null : alsDouble(p.cpu)],
      ["Description", geschuetzt ? null : p.beschreibung], ["ProcessName", p.name], ["SessionId", p.si], ["StartTime", geschuetzt ? null : start],
      ["HasExited", false], ["MachineName", "."], ["MainWindowTitle", ""], ["Responding", true], ["BasePriority", 8],
    ];
    const arten = { Name: "AliasProperty", SI: "AliasProperty", Handles: "AliasProperty", VM: "AliasProperty", WS: "AliasProperty", PM: "AliasProperty", NPM: "AliasProperty",
      Path: "ScriptProperty", Company: "ScriptProperty", CPU: "ScriptProperty", Description: "ScriptProperty" };
    paare.forEach(([n]) => { if (!arten[n]) arten[n] = "Property"; });
    const o = new PSObjekt(["System.Diagnostics.Process", "System.ComponentModel.Component", "System.MarshalByRefObject", "System.Object"], paare, arten);
    o._text = () => "System.Diagnostics.Process (" + p.name + ")";
    o._prozess = p;
    o._methoden = {
      kill: (args, sitzung) => { prozessBeenden(sitzung, p, (ds) => { throw abbruch({ meldung: 'Exception calling "Kill" with "0" argument(s): "Access is denied."', art: "MethodInvocationException" }); }); },
      refresh: () => undefined,
      waitforexit: () => true,
    };
    return o;
  }

  // Prozess entfernen; fehler(o) bei fehlenden Rechten
  function prozessBeenden(s, p, fehler) {
    const kritisch = ["idle", "system", "lsass", "svchost", "csrss", "wininit", "smss"].includes(klein(p.name));
    if ((p.system && !s.welt.admin) || kritisch) {
      fehler({ meldung: 'Cannot stop process "' + p.name + " (" + p.id + ')" because of the following error: Access is denied.', kategorie: "CloseError",
        ausnahme: "Microsoft.PowerShell.Commands.ProcessCommandException", id: "CouldNotStopProcess", ziel: p.name });
      return false;
    }
    if (p.id === 9120) {
      s.hinweis("Das ist die Konsole selbst (pwsh). In echt würde sich dieses Fenster jetzt schliessen. Der Simulator läuft weiter.");
      return false;
    }
    s.welt.prozesse = s.welt.prozesse.filter((x) => x !== p);
    return true;
  }

  const prozesseSortiert = (s) => s.welt.prozesse.slice().sort((a, b) => ordinalCI(a.name, b.name) || a.id - b.id);

  cmdlet("Get-Process", "M", {
    run(ctx) {
      const s = ctx.sitzung;
      const alle = prozesseSortiert(s);
      if (ctx.hat("Id")) {
        const out = [];
        alsListe(ctx.wert("Id")).forEach((i) => {
          const p = alle.find((x) => x.id === zahlWert(i));
          if (!p) ctx.fehler({ meldung: "Cannot find a process with the process identifier " + zahlWert(i) + ".", kategorie: "ObjectNotFound", ausnahme: "Microsoft.PowerShell.Commands.ProcessCommandException", id: "NoProcessFoundForGivenId", ziel: zahlWert(i) });
          else out.push(prozessObjekt(s, p));
        });
        return out;
      }
      if (!ctx.hat("Name")) return alle.map((p) => prozessObjekt(s, p));
      const out = [];
      alsListe(ctx.wert("Name")).map(textVon).forEach((n) => {
        const t = alle.filter((p) => passt(p.name, n));
        if (!t.length && !hatPlatzhalter(n)) ctx.fehler({ meldung: 'Cannot find a process with the name "' + n + '". Verify the process name and call the cmdlet again.', kategorie: "ObjectNotFound", ausnahme: "Microsoft.PowerShell.Commands.ProcessCommandException", id: "NoProcessFoundForGivenName", ziel: n });
        t.forEach((p) => { if (!out.some((o) => o._prozess === p)) out.push(prozessObjekt(s, p)); });
      });
      return out;
    },
  });

  cmdlet("Stop-Process", "M", {
    pipeline: ["InputObject"],
    run(ctx) {
      const s = ctx.sitzung;
      let ziele = [];
      if (ctx.hat("InputObject") || (ctx.hatEingabe && !ctx.hat("Id") && !ctx.hat("Name"))) {
        alsListe(ctx.hat("InputObject") ? ctx.wert("InputObject") : ctx.eingabe).forEach((o) => {
          const p = o instanceof PSObjekt && o._prozess ? s.welt.prozess(o._prozess.id) : null;
          if (p) ziele.push(p);
        });
      } else if (ctx.hat("Id")) {
        alsListe(ctx.wert("Id")).forEach((i) => {
          const p = s.welt.prozess(zahlWert(i));
          if (!p) ctx.fehler({ meldung: "Cannot find a process with the process identifier " + zahlWert(i) + ".", kategorie: "ObjectNotFound", ausnahme: "Microsoft.PowerShell.Commands.ProcessCommandException", id: "NoProcessFoundForGivenId", ziel: zahlWert(i) });
          else ziele.push(p);
        });
      } else {
        alsListe(ctx.wert("Name")).map(textVon).forEach((n) => {
          const t = prozesseSortiert(s).filter((p) => passt(p.name, n));
          if (!t.length && !hatPlatzhalter(n)) ctx.fehler({ meldung: 'Cannot find a process with the name "' + n + '". Verify the process name and call the cmdlet again.', kategorie: "ObjectNotFound", ausnahme: "Microsoft.PowerShell.Commands.ProcessCommandException", id: "NoProcessFoundForGivenName", ziel: n });
          t.forEach((p) => ziele.push(p));
        });
      }
      const out = [];
      ziele.forEach((p) => {
        if (!ctx.sollen("Stop-Process", p.name + " (" + p.id + ")")) return;
        if (prozessBeenden(s, p, ctx.fehler) && ctx.schalter("PassThru")) out.push(prozessObjekt(s, Object.assign({}, p)));
      });
      return out;
    },
  });

  /* ---------- Dienste ---------- */

  const STATUS = { Stopped: 1, StartPending: 2, StopPending: 3, Running: 4, ContinuePending: 5, PausePending: 6, Paused: 7 };
  const STARTART = { Boot: 0, System: 1, Automatic: 2, Manual: 3, Disabled: 4 };
  function dienstObjekt(s, d) {
    const paare = [
      ["Name", d.name], ["RequiredServices", []], ["CanPauseAndContinue", false], ["CanShutdown", d.status === "Running"], ["CanStop", d.status === "Running"],
      ["Container", null], ["DependentServices", []], ["DisplayName", d.anzeige], ["MachineName", "."], ["ServiceName", d.name], ["ServicesDependedOn", []],
      ["ServiceType", new PSEnum("System.ServiceProcess.ServiceType", /^Wolkenried/.test(d.name) ? "Win32OwnProcess" : "Win32ShareProcess", /^Wolkenried/.test(d.name) ? 16 : 32)],
      ["Site", null], ["StartType", new PSEnum("System.ServiceProcess.ServiceStartMode", d.start, STARTART[d.start])],
      ["Status", new PSEnum("System.ServiceProcess.ServiceControllerStatus", d.status, STATUS[d.status])],
      ["UserName", /^Wolkenried/.test(d.name) ? "LocalSystem" : "NT AUTHORITY\\LocalService"], ["Description", d.anzeige],
      ["DelayedAutoStart", false], ["BinaryPathName", /^Wolkenried/.test(d.name) ? "C:\\Program Files\\Wolkenried\\" + d.name + ".exe" : "C:\\WINDOWS\\system32\\svchost.exe -k netsvcs"],
      ["StartupType", new PSEnum("Microsoft.PowerShell.Commands.ServiceStartupType", d.start, STARTART[d.start])],
    ];
    const arten = { Name: "AliasProperty", RequiredServices: "AliasProperty", UserName: "NoteProperty", Description: "NoteProperty", DelayedAutoStart: "NoteProperty", BinaryPathName: "NoteProperty", StartupType: "NoteProperty" };
    paare.forEach(([n]) => { if (!arten[n]) arten[n] = "Property"; });
    const o = new PSObjekt(["System.ServiceProcess.ServiceController", "System.ComponentModel.Component", "System.MarshalByRefObject", "System.Object"], paare, arten);
    o._dienst = d;
    o._methoden = {
      start: (args, sitzung) => { if (!sitzung.welt.admin) throw ausnahmeBeiAufruf("Start", args, "Cannot open '" + d.name + "' service on computer '.'."); d.status = "Running"; },
      stop: (args, sitzung) => { if (!sitzung.welt.admin) throw ausnahmeBeiAufruf("Stop", args, "Cannot open '" + d.name + "' service on computer '.'."); d.status = "Stopped"; },
      refresh: () => undefined,
    };
    return o;
  }
  const diensteSortiert = (s) => s.welt.dienste.slice().sort((a, b) => ordinalCI(a.name, b.name));
  function dienstFehlt(ctx, n, anzeige) {
    ctx.fehler({ meldung: "Cannot find any service with service " + (anzeige ? "display " : "") + "name '" + n + "'.", kategorie: "ObjectNotFound",
      ausnahme: "Microsoft.PowerShell.Commands.ServiceCommandException", id: anzeige ? "NoServiceFoundForGivenDisplayName" : "NoServiceFoundForGivenName", ziel: n });
  }
  function dienstAuswahl(ctx) {
    const s = ctx.sitzung;
    const alle = diensteSortiert(s);
    let liste = [];
    if (ctx.hat("InputObject") || (ctx.hatEingabe && !ctx.hat("Name") && !ctx.hat("DisplayName"))) {
      alsListe(ctx.hat("InputObject") ? ctx.wert("InputObject") : ctx.eingabe).forEach((o) => {
        if (o instanceof PSObjekt && o._dienst) liste.push(s.welt.dienst(o._dienst.name));
        else if (typeof o === "string") { const d = s.welt.dienst(o); if (d) liste.push(d); else dienstFehlt(ctx, o); }
      });
    } else if (ctx.hat("DisplayName")) {
      alsListe(ctx.wert("DisplayName")).map(textVon).forEach((n) => {
        const t = alle.filter((d) => passt(d.anzeige, n));
        if (!t.length && !hatPlatzhalter(n)) dienstFehlt(ctx, n, true);
        t.forEach((d) => liste.push(d));
      });
    } else if (ctx.hat("Name")) {
      alsListe(ctx.wert("Name")).map(textVon).forEach((n) => {
        const t = alle.filter((d) => passt(d.name, n));
        if (!t.length && !hatPlatzhalter(n)) dienstFehlt(ctx, n, false);
        t.forEach((d) => liste.push(d));
      });
    } else liste = alle;
    if (ctx.hat("Include")) liste = liste.filter((d) => alsListe(ctx.wert("Include")).some((m) => passt(d.name, textVon(m))));
    if (ctx.hat("Exclude")) liste = liste.filter((d) => !alsListe(ctx.wert("Exclude")).some((m) => passt(d.name, textVon(m))));
    return liste.filter(Boolean);
  }

  cmdlet("Get-Service", "M", {
    pipeline: ["Name", "InputObject"],
    run: (ctx) => dienstAuswahl(ctx).map((d) => dienstObjekt(ctx.sitzung, d)),
  });

  function dienstAendern(ctx, aktion) {
    const s = ctx.sitzung;
    const out = [];
    dienstAuswahl(ctx).forEach((d) => {
      const ziel = d.anzeige + " (" + d.name + ")";
      if (!ctx.sollen(aktion + "-Service", ziel)) return;
      const verb = aktion === "Start" ? "started" : "stopped";
      if (!s.welt.admin) {
        const stoppen = aktion !== "Start" && !(aktion === "Restart" && d.status !== "Running");
        ctx.fehler({ meldung: "Service '" + ziel + "' cannot be " + (stoppen ? "stopped" : verb) + " due to the following error: Cannot open '" + d.name + "' service on computer '.'.",
          kategorie: "OpenError", ausnahme: "Microsoft.PowerShell.Commands.ServiceCommandException", id: stoppen ? "CouldNotStopService" : "CouldNotStartService", ziel: d.name });
        return;
      }
      if (d.start === "Disabled" && aktion !== "Stop") {
        ctx.fehler({ meldung: "Service '" + ziel + "' cannot be started due to the following error: Cannot start service '" + d.name + "' on computer '.'.", kategorie: "OpenError", ausnahme: "Microsoft.PowerShell.Commands.ServiceCommandException", id: "CouldNotStartService", ziel: d.name });
        return;
      }
      d.status = aktion === "Stop" ? "Stopped" : "Running";
      if (ctx.schalter("PassThru")) out.push(dienstObjekt(s, d));
    });
    return out;
  }
  cmdlet("Start-Service", "M", { pipeline: ["InputObject", "Name"], run: (ctx) => dienstAendern(ctx, "Start") });
  cmdlet("Stop-Service", "M", { pipeline: ["InputObject", "Name"], run: (ctx) => dienstAendern(ctx, "Stop") });
  cmdlet("Restart-Service", "M", { pipeline: ["InputObject", "Name"], run: (ctx) => dienstAendern(ctx, "Restart") });

  /* ---------- Netzwerk, Laufwerke, Ausführungsrichtlinie ---------- */

  cmdlet("Test-Connection", "M", {
    run(ctx) {
      const s = ctx.sitzung;
      const anzahl = ctx.hat("Count") ? zahlWert(ctx.wert("Count")) : 4;
      const out = [];
      alsListe(ctx.wert("TargetName")).map(textVon).forEach((ziel) => {
        const eintrag = s.welt.netz[klein(ziel)];
        if (!eintrag) {
          if (ctx.schalter("Quiet")) { out.push(false); return; }
          ctx.fehler({ meldung: "Testing connection to computer '" + ziel + "' failed: No such host is known.", kategorie: "ResourceUnavailable",
            ausnahme: "System.Net.NetworkInformation.PingException", id: "TestConnectionException,Microsoft.PowerShell.Commands.TestConnectionCommand", ziel: ziel });
          return;
        }
        if (ctx.schalter("Quiet")) { out.push(eintrag[1] !== null); return; }
        for (let i = 1; i <= anzahl; i++) {
          const ok = eintrag[1] !== null;
          out.push(new PSObjekt(["Microsoft.PowerShell.Commands.TestConnectionCommand+PingStatus"], [["Ping", i], ["Source", s.welt.computer], ["Destination", ziel],
            ["Address", ok ? eintrag[0] : "*"], ["Latency", ok ? eintrag[1] + (i === 1 && eintrag[1] > 0 ? 1 : 0) : null], ["BufferSize", 32],
            ["Status", new PSEnum("System.Net.NetworkInformation.IPStatus", ok ? "Success" : "TimedOut", ok ? 0 : 11010)]]));
        }
      });
      return out;
    },
  });

  cmdlet("Get-PSDrive", "M", {
    run(ctx) {
      const s = ctx.sitzung;
      const lw = s.welt.laufwerkC;
      const liste = [
        ["C", lw.belegt * 1073741824, lw.frei * 1073741824, "FileSystem", "C:\\", s.orte.C.join("\\")],
        ["Env", null, null, "Environment", "", s.orte.ENV.join("\\")],
        ["HKCU", null, null, "Registry", "HKEY_CURRENT_USER", s.orte.HKCU.join("\\")],
      ];
      let out = liste.map((l) => {
        const o = new PSObjekt(["System.Management.Automation.PSDriveInfo"], [["Used", l[1]], ["Free", l[2]], ["CurrentLocation", l[5]], ["Name", l[0]],
          ["Provider", "Microsoft.PowerShell.Core\\" + l[3]], ["Root", l[4]], ["Description", l[0] === "C" ? "Windows" : ""], ["ProviderName", l[3]]]);
        o._versteckt = ["ProviderName"];
        o._text = () => l[0];
        return o;
      });
      if (ctx.hat("Name")) {
        const namen = alsListe(ctx.wert("Name")).map(textVon);
        out = out.filter((o) => namen.some((n) => passt(eig(o, "Name"), n)));
        namen.filter((n) => !hatPlatzhalter(n) && !out.some((o) => gleichCI(eig(o, "Name"), n))).forEach((n) =>
          ctx.fehler({ meldung: "Cannot find drive. A drive with the name '" + n + "' does not exist.", kategorie: "ObjectNotFound", ausnahme: "System.Management.Automation.DriveNotFoundException", id: "GetLocationNoMatchingDrive", ziel: n }));
      }
      if (ctx.hat("PSProvider")) out = out.filter((o) => alsListe(ctx.wert("PSProvider")).some((p) => passt(eig(o, "ProviderName"), textVon(p))));
      return out;
    },
  });

  const RICHTLINIEN = { Unrestricted: 0, RemoteSigned: 1, AllSigned: 2, Restricted: 3, Bypass: 4, Undefined: 5, Default: 3 };
  function effektiveRichtlinie(w) {
    const r = w.richtlinien || {};
    return r.Process && r.Process !== "Undefined" ? r.Process : r.CurrentUser && r.CurrentUser !== "Undefined" ? r.CurrentUser : w.richtlinie;
  }
  const richtlinienEnum = (n) => new PSEnum("Microsoft.PowerShell.ExecutionPolicy", n, RICHTLINIEN[n]);
  cmdlet("Get-ExecutionPolicy", "S", {
    run(ctx) {
      const w = ctx.sitzung.welt;
      const r = w.richtlinien || {};
      const tab = [["MachinePolicy", "Undefined"], ["UserPolicy", "Undefined"], ["Process", r.Process || "Undefined"], ["CurrentUser", r.CurrentUser || "Undefined"], ["LocalMachine", w.richtlinie]];
      if (ctx.schalter("List")) {
        return tab.map((t, i) => neuesObjekt([["Scope", new PSEnum("Microsoft.PowerShell.ExecutionPolicyScope", t[0], i)], ["ExecutionPolicy", richtlinienEnum(t[1])]]));
      }
      if (ctx.hat("Scope")) { const t = tab.find((x) => gleichCI(x[0], textVon(ctx.wert("Scope")))); return [richtlinienEnum(t ? t[1] : "Undefined")]; }
      return [richtlinienEnum(effektiveRichtlinie(w))];
    },
  });
  cmdlet("Set-ExecutionPolicy", "S", {
    run(ctx) {
      const w = ctx.sitzung.welt;
      const neu = Object.keys(RICHTLINIEN).find((k) => gleichCI(k, textVon(ctx.wert("ExecutionPolicy"))));
      if (!neu) throw ctx.abbruch({ meldung: "Cannot bind parameter 'ExecutionPolicy'. Cannot convert value \"" + textVon(ctx.wert("ExecutionPolicy")) + "\" to type \"Microsoft.PowerShell.ExecutionPolicy\".", kategorie: "InvalidArgument" });
      const scope = ctx.hat("Scope") ? textVon(ctx.wert("Scope")) : "LocalMachine";
      if (!ctx.sollen("Set-ExecutionPolicy", neu)) return [];
      if (gleichCI(scope, "LocalMachine")) {
        if (!w.admin) {
          ctx.fehler({ meldung: "Access to the path 'C:\\Program Files\\PowerShell\\7\\powershell.config.json' is denied. To change the execution policy for the default (LocalMachine) scope, start PowerShell with the \"Run as administrator\" option. To change the execution policy for the current user, run \"Set-ExecutionPolicy -Scope CurrentUser\".",
            kategorie: "PermissionDenied", ausnahme: "System.UnauthorizedAccessException", id: "System.UnauthorizedAccessException" });
          return [];
        }
        w.richtlinie = neu;
      } else {
        w.richtlinien = Object.assign({}, w.richtlinien || {});
        w.richtlinien[gleichCI(scope, "Process") ? "Process" : "CurrentUser"] = neu;
      }
      return [];
    },
  });

  /* ======================================================================
     9. Hilfe-Texte (Get-Help). Kurze eigene deutsche Texte, Syntax echt aus pwsh 7.6.
     Je Befehl: k = Kurzbeschreibung, t = Beschreibung, b = Beispiele [Befehl, Erklärung], p = Parameter
     ====================================================================== */

  const HILFE = {
    "Get-ChildItem": { k: "Zeigt die Dateien und Ordner an einem Ort an.",
      t: "Get-ChildItem listet den Inhalt eines Ordners auf. Ohne Pfad nimmt es den aktuellen Ort. Mit -Recurse durchsucht es auch alle Unterordner, mit -Force zeigt es versteckte Elemente.",
      b: [["Get-ChildItem", "Zeigt den Inhalt des aktuellen Ordners."], ["Get-ChildItem -Path Logs -Filter *.log", "Zeigt alle .log-Dateien im Ordner Logs."], ["Get-ChildItem -Recurse -File", "Zeigt alle Dateien im aktuellen Ordner und in allen Unterordnern."]],
      p: { Path: "Ort, dessen Inhalt angezeigt wird. Platzhalter wie * sind erlaubt. Standard ist der aktuelle Ort.", Filter: "Filter für Namen, zum Beispiel *.txt. Schneller als -Include.", Recurse: "Durchsucht auch alle Unterordner.", Force: "Zeigt auch versteckte Dateien und Ordner.", File: "Nur Dateien anzeigen.", Directory: "Nur Ordner anzeigen.", Name: "Gibt nur die Namen als Text aus." } },
    "Get-Item": { k: "Holt eine Datei, einen Ordner oder ein anderes Element selbst (nicht seinen Inhalt).",
      t: "Get-Item liefert das Element an einem Pfad als Objekt, zum Beispiel eine Datei mit Name, Grösse und Datum.",
      b: [["Get-Item Logs\\app.log", "Holt die Datei app.log."], ["(Get-Item Logs\\app.log).Length", "Zeigt die Grösse der Datei in Bytes."]],
      p: { Path: "Pfad des Elements. Platzhalter sind erlaubt.", Force: "Holt auch versteckte Elemente." } },
    "Set-Location": { k: "Wechselt den aktuellen Ort (Ordner oder Laufwerk).",
      t: "Set-Location ändert, wo du dich befindest. Relative Pfade wie .. (eine Ebene höher) und ~ (dein Benutzerordner) sind erlaubt.",
      b: [["Set-Location Dokumente", "Wechselt in den Ordner Dokumente."], ["Set-Location ..", "Geht eine Ordnerebene nach oben."], ["Set-Location ~", "Wechselt in deinen Benutzerordner."]],
      p: { Path: "Ziel. Ohne Angabe: dein Benutzerordner.", PassThru: "Gibt den neuen Ort als Objekt aus." } },
    "Get-Location": { k: "Zeigt den aktuellen Ort an.", t: "Get-Location gibt den Pfad aus, an dem du dich gerade befindest. Der Prompt PS C:\\Users\\lea> zeigt ihn ebenfalls.", b: [["Get-Location", "Zeigt den aktuellen Ort."]], p: {} },
    "Test-Path": { k: "Prüft, ob ein Pfad existiert, und gibt True oder False aus.",
      t: "Test-Path antwortet mit True oder False. Mit -PathType Leaf prüfst du auf eine Datei, mit -PathType Container auf einen Ordner.",
      b: [["Test-Path Logs\\app.log", "True, wenn die Datei existiert."], ["Test-Path Logs -PathType Container", "True, wenn Logs ein Ordner ist."]],
      p: { Path: "Zu prüfender Pfad.", PathType: "Any (Standard), Leaf (Datei) oder Container (Ordner)." } },
    "Join-Path": { k: "Setzt Pfadteile zu einem Pfad zusammen.", t: "Join-Path fügt die Teile mit genau einem Backslash zusammen. Es prüft nicht, ob der Pfad existiert.",
      b: [["Join-Path C:\\Users\\lea Dokumente", "Ergibt C:\\Users\\lea\\Dokumente."]], p: { Path: "Erster Teil.", ChildPath: "Teil, der angehängt wird." } },
    "Split-Path": { k: "Zerlegt einen Pfad (Ordner, Dateiname, Endung).", t: "Split-Path gibt ohne Schalter den übergeordneten Ordner aus, mit -Leaf den letzten Teil.",
      b: [["Split-Path C:\\Users\\lea\\Logs\\app.log -Leaf", "Ergibt app.log."]], p: { Path: "Zu zerlegender Pfad.", Leaf: "Nur den letzten Teil ausgeben." } },
    "Resolve-Path": { k: "Löst Platzhalter und relative Pfade zu vollständigen Pfaden auf.", t: "Resolve-Path gibt die vollständigen Pfade der passenden Elemente aus.", b: [["Resolve-Path Logs\\*.log", "Zeigt die vollständigen Pfade aller Logdateien."]], p: {} },
    "New-Item": { k: "Legt eine neue Datei oder einen neuen Ordner an.",
      t: "New-Item erstellt ein Element. Mit -ItemType Directory einen Ordner, mit -ItemType File eine Datei. -Value schreibt gleich einen Inhalt hinein.",
      b: [["New-Item -ItemType Directory -Path Rechnungen", "Legt den Ordner Rechnungen an."], ["New-Item -Path notiz.txt -ItemType File -Value 'Hallo'", "Legt die Datei notiz.txt mit dem Text Hallo an."]],
      p: { Path: "Pfad des neuen Elements.", ItemType: "File oder Directory.", Value: "Inhalt einer neuen Datei.", Force: "Überschreibt eine vorhandene Datei." } },
    mkdir: { k: "Legt einen neuen Ordner an (Kurzform von New-Item -ItemType Directory).", t: "mkdir ist eine Funktion von PowerShell und ruft New-Item mit -ItemType Directory auf.", b: [["mkdir Rechnungen", "Legt den Ordner Rechnungen an."]], p: {} },
    "Copy-Item": { k: "Kopiert Dateien und Ordner.",
      t: "Copy-Item kopiert ein Element an ein Ziel. Ist das Ziel ein Ordner, landet die Kopie darin. Ordner mit Inhalt kopierst du mit -Recurse.",
      b: [["Copy-Item Dokumente\\notizen.txt Berichte", "Kopiert notizen.txt in den Ordner Berichte."], ["Copy-Item Bilder Bilder-Sicherung -Recurse", "Kopiert den Ordner Bilder mit allem Inhalt."]],
      p: { Path: "Was kopiert wird. Platzhalter sind erlaubt.", Destination: "Wohin kopiert wird.", Recurse: "Kopiert Ordner mit allen Unterordnern und Dateien.", WhatIf: "Zeigt nur, was passieren würde." } },
    "Move-Item": { k: "Verschiebt Dateien und Ordner.", t: "Move-Item verschiebt ein Element an ein anderes Ziel. Gibst du einen neuen Namen an, wird es dabei umbenannt.",
      b: [["Move-Item Downloads\\*.pdf Berichte", "Verschiebt alle PDF-Dateien aus Downloads nach Berichte."]],
      p: { Path: "Was verschoben wird.", Destination: "Ziel.", WhatIf: "Zeigt nur, was passieren würde." } },
    "Rename-Item": { k: "Benennt eine Datei oder einen Ordner um.", t: "Rename-Item ändert nur den Namen. Der neue Name darf keinen Pfad enthalten.",
      b: [["Rename-Item Dokumente\\notizen.txt notizen-alt.txt", "Benennt notizen.txt in notizen-alt.txt um."]], p: { Path: "Was umbenannt wird.", NewName: "Neuer Name ohne Pfad." } },
    "Remove-Item": { k: "Löscht Dateien und Ordner endgültig (kein Papierkorb).",
      t: "Remove-Item löscht Elemente ohne Papierkorb. Prüfe vorher mit -WhatIf, was gelöscht würde. Ordner mit Inhalt brauchen -Recurse.",
      b: [["Remove-Item Downloads\\setup-alt.exe -WhatIf", "Zeigt nur, was gelöscht würde."], ["Remove-Item Downloads\\*.exe", "Löscht alle .exe-Dateien in Downloads."], ["Remove-Item Alt -Recurse", "Löscht den Ordner Alt mit allem Inhalt."]],
      p: { Path: "Was gelöscht wird. Platzhalter sind erlaubt.", Recurse: "Löscht auch alle Unterordner und Dateien.", Force: "Löscht auch versteckte und schreibgeschützte Dateien.", WhatIf: "Zeigt nur, was passieren würde.", Confirm: "Fragt vor jedem Löschen nach." } },
    "Get-Content": { k: "Liest den Inhalt einer Datei Zeile für Zeile.",
      t: "Get-Content gibt jede Zeile als eigenen Text aus. -TotalCount liest nur die ersten Zeilen, -Tail nur die letzten.",
      b: [["Get-Content Dokumente\\notizen.txt", "Zeigt alle Zeilen."], ["Get-Content Logs\\app.log -Tail 2", "Zeigt die letzten zwei Zeilen."]],
      p: { Path: "Datei, die gelesen wird.", TotalCount: "Anzahl Zeilen vom Anfang.", Tail: "Anzahl Zeilen vom Ende.", Raw: "Liest alles als einen einzigen Text." } },
    "Set-Content": { k: "Schreibt Text in eine Datei und ersetzt den bisherigen Inhalt.", t: "Set-Content legt die Datei bei Bedarf an und überschreibt sie sonst. In pwsh 7 ist die Datei UTF-8 ohne BOM.",
      b: [["Set-Content notiz.txt 'Erste Zeile'", "Schreibt eine Zeile in notiz.txt."]], p: { Path: "Zieldatei.", Value: "Text, der geschrieben wird." } },
    "Add-Content": { k: "Hängt Text am Ende einer Datei an.", t: "Add-Content ergänzt eine Datei, ohne den bisherigen Inhalt zu löschen.",
      b: [["Add-Content notiz.txt 'Noch eine Zeile'", "Hängt eine Zeile an."]], p: { Path: "Zieldatei.", Value: "Text, der angehängt wird." } },
    "Clear-Content": { k: "Leert eine Datei, ohne sie zu löschen.", t: "Clear-Content entfernt den Inhalt, die Datei bleibt bestehen.", b: [["Clear-Content notiz.txt", "Leert notiz.txt."]], p: {} },
    "Out-File": { k: "Schreibt die Ausgabe so in eine Datei, wie sie in der Konsole erscheint.",
      t: "Out-File speichert die formatierte Ausgabe (wie > ). -Append hängt an, statt zu überschreiben.",
      b: [["Get-ChildItem Logs | Out-File liste.txt", "Speichert die Ordnerliste in liste.txt."]], p: { FilePath: "Zieldatei.", Append: "Anhängen statt überschreiben." } },
    "Where-Object": { k: "Filtert Objekte in der Pipeline nach einer Bedingung.",
      t: "Where-Object lässt nur Objekte durch, für die die Bedingung wahr ist. $_ steht für das aktuelle Objekt. Kurzform: Where-Object Eigenschaft -Operator Wert.",
      b: [["Get-ChildItem Logs | Where-Object { $_.Length -gt 1MB }", "Nur Dateien grösser als 1 MB."], ["Get-Service | Where-Object Status -eq Running", "Nur laufende Dienste (vereinfachte Schreibweise)."]],
      p: { FilterScript: "Bedingung als Skriptblock { … }.", Property: "Eigenschaft für die vereinfachte Schreibweise.", Value: "Vergleichswert." } },
    "ForEach-Object": { k: "Führt für jedes Objekt in der Pipeline einen Skriptblock aus.",
      t: "ForEach-Object verarbeitet die Objekte einzeln. Im Skriptblock steht $_ für das aktuelle Objekt.",
      b: [["1..3 | ForEach-Object { $_ * 10 }", "Gibt 10, 20 und 30 aus."], ["Get-ChildItem Berichte | ForEach-Object Name", "Gibt nur die Namen aus."]],
      p: { Process: "Skriptblock, der für jedes Objekt läuft.", MemberName: "Eigenschaft oder Methode, die für jedes Objekt gelesen bzw. aufgerufen wird." } },
    "Sort-Object": { k: "Sortiert Objekte nach Eigenschaften.", t: "Sort-Object sortiert aufsteigend, mit -Descending absteigend. Mehrere Eigenschaften trennst du mit Komma.",
      b: [["Get-ChildItem Logs | Sort-Object Length -Descending", "Grösste Dateien zuerst."], ["Import-Csv Berichte\\mitarbeitende.csv | Sort-Object Abteilung, Name", "Erst nach Abteilung, dann nach Name."]],
      p: { Property: "Eigenschaft(en), nach denen sortiert wird.", Descending: "Absteigend sortieren.", Unique: "Doppelte nur einmal ausgeben." } },
    "Select-Object": { k: "Wählt Eigenschaften oder eine Anzahl Objekte aus.",
      t: "Select-Object behält nur bestimmte Eigenschaften (-Property) oder nur die ersten oder letzten Objekte (-First, -Last). -ExpandProperty gibt den reinen Wert aus.",
      b: [["Get-ChildItem Logs | Select-Object Name, Length", "Nur Name und Grösse."], ["Get-ChildItem Logs | Sort-Object Length -Descending | Select-Object -First 3", "Die drei grössten Dateien."], ["Get-ChildItem Berichte | Select-Object -ExpandProperty Name", "Nur die Namen als Text."]],
      p: { Property: "Eigenschaften, die behalten werden. Auch berechnete Eigenschaften @{ Name = …; Expression = { … } }.", First: "Nur die ersten n Objekte.", Last: "Nur die letzten n Objekte.", Unique: "Doppelte entfernen.", ExpandProperty: "Wert einer Eigenschaft direkt ausgeben." } },
    "Measure-Object": { k: "Zählt Objekte und berechnet Summe, Durchschnitt, Maximum und Minimum.",
      t: "Measure-Object zählt immer (Count). Mit -Property und -Sum, -Average, -Maximum, -Minimum rechnet es mit einer Eigenschaft.",
      b: [["Get-ChildItem Logs | Measure-Object", "Zählt die Dateien."], ["Get-ChildItem Logs | Measure-Object -Property Length -Sum", "Summe aller Dateigrössen."]],
      p: { Property: "Eigenschaft, mit der gerechnet wird.", Sum: "Summe.", Average: "Durchschnitt.", Maximum: "Grösster Wert.", Minimum: "Kleinster Wert." } },
    "Group-Object": { k: "Gruppiert Objekte mit gleichem Wert einer Eigenschaft.", t: "Group-Object fasst Objekte zusammen und zählt sie pro Gruppe.",
      b: [["Get-ChildItem Downloads | Group-Object Extension", "Dateien nach Endung gruppieren."], ["Import-Csv Berichte\\mitarbeitende.csv | Group-Object Abteilung -NoElement", "Anzahl Personen pro Abteilung."]],
      p: { Property: "Eigenschaft, nach der gruppiert wird.", NoElement: "Nur Anzahl und Name, ohne die Objekte." } },
    "Format-Table": { k: "Zeigt Objekte als Tabelle an.", t: "Format-Table bestimmt, welche Spalten erscheinen. Format-Cmdlets kommen immer zuletzt in der Pipeline, danach gibt es nur noch Formatierungsobjekte.",
      b: [["Get-ChildItem Logs | Format-Table Name, Length -AutoSize", "Tabelle mit zwei Spalten."]], p: { Property: "Spalten.", AutoSize: "Spaltenbreite an den Inhalt anpassen." } },
    "Format-List": { k: "Zeigt jede Eigenschaft auf einer eigenen Zeile an.", t: "Format-List zeigt Objekte als Liste «Name : Wert». Mit * siehst du alle Eigenschaften.",
      b: [["Get-Item Logs\\app.log | Format-List *", "Alle Eigenschaften der Datei."]], p: { Property: "Eigenschaften, * für alle." } },
    "Format-Wide": { k: "Zeigt nur eine Eigenschaft in mehreren Spalten an.", t: "Format-Wide eignet sich für lange Namenslisten.", b: [["Get-ChildItem Logs | Format-Wide -Column 3", "Namen in drei Spalten."]], p: { Column: "Anzahl Spalten." } },
    "Export-Csv": { k: "Speichert Objekte als CSV-Datei.", t: "Export-Csv schreibt eine Kopfzeile mit den Eigenschaften und eine Zeile pro Objekt. Für Excel mit Schweizer Einstellungen: -Delimiter ';'. In Windows PowerShell 5.1 zusätzlich -NoTypeInformation.",
      b: [["Import-Csv Berichte\\mitarbeitende.csv | Export-Csv kopie.csv -Delimiter ';'", "Speichert mit Semikolon als Trennzeichen."]], p: { Path: "Zieldatei.", Delimiter: "Trennzeichen (Standard Komma).", NoTypeInformation: "In pwsh 7 Standard, in 5.1 nötig." } },
    "Import-Csv": { k: "Liest eine CSV-Datei als Objekte ein.", t: "Import-Csv macht aus jeder Zeile ein Objekt mit den Spalten als Eigenschaften. Achtung: Alle Werte sind Text.",
      b: [["Import-Csv Berichte\\mitarbeitende.csv", "Liest die Mitarbeitendenliste."], ["Import-Csv Berichte\\mitarbeitende.csv | Where-Object Abteilung -eq 'Informatik'", "Nur die Informatik."]],
      p: { Path: "CSV-Datei.", Delimiter: "Trennzeichen, falls nicht Komma." } },
    "ConvertTo-Csv": { k: "Wandelt Objekte in CSV-Text um (ohne Datei).", t: "Wie Export-Csv, aber die Zeilen erscheinen in der Konsole.", b: [["Get-ChildItem Berichte | Select-Object Name, Length | ConvertTo-Csv", "CSV-Text der Dateiliste."]], p: {} },
    "ConvertFrom-Csv": { k: "Wandelt CSV-Text in Objekte um.", t: "Das Gegenstück zu ConvertTo-Csv.", b: [["'Name,Alter','Lea,31' | ConvertFrom-Csv", "Ergibt ein Objekt mit Name und Alter."]], p: {} },
    "ConvertTo-Json": { k: "Wandelt Objekte in JSON-Text um.", t: "Verschachtelte Objekte werden nur bis -Depth (Standard 2) umgewandelt, tiefer erscheint nur noch Text.",
      b: [["Import-Csv Berichte\\mitarbeitende.csv | Select-Object -First 2 | ConvertTo-Json", "Zwei Personen als JSON."]], p: { Depth: "Tiefe der Verschachtelung (Standard 2).", Compress: "Ohne Leerzeichen und Zeilenumbrüche." } },
    "ConvertFrom-Json": { k: "Wandelt JSON-Text in Objekte um.", t: "Aus JSON-Objekten werden PowerShell-Objekte mit Eigenschaften.", b: [["'{\"Name\":\"Lea\"}' | ConvertFrom-Json", "Ergibt ein Objekt mit der Eigenschaft Name."]], p: { AsHashtable: "Hashtables statt Objekte." } },
    "ConvertTo-Html": { k: "Wandelt Objekte in eine HTML-Tabelle um.", t: "Die Ausgabe ist HTML-Text, den du mit Out-File speichern kannst.", b: [["Get-Service | Select-Object Name, Status | ConvertTo-Html | Out-File dienste.html", "Speichert eine HTML-Seite mit den Diensten."]], p: { Fragment: "Nur die Tabelle ohne Seitenrahmen." } },
    "Get-Member": { k: "Zeigt Typ, Eigenschaften und Methoden von Objekten.", t: "Get-Member verrät, was in einem Objekt steckt: den Typ (TypeName), die Eigenschaften (Property) und die Methoden (Method).",
      b: [["Get-Item Logs\\app.log | Get-Member", "Alles, was ein FileInfo-Objekt kann."], ["Get-Date | Get-Member -MemberType Property", "Nur die Eigenschaften eines Datums."]], p: { MemberType: "Property, Method, NoteProperty …", Name: "Nur Member mit diesem Namen." } },
    "Get-Command": { k: "Findet Befehle.", t: "Get-Command sucht Cmdlets, Funktionen und Aliase. Platzhalter wie * und die Parameter -Verb und -Noun helfen beim Suchen.",
      b: [["Get-Command -Noun Service", "Alle Befehle zum Nomen Service."], ["Get-Command *-Item", "Alle Befehle, die auf -Item enden."]], p: { Name: "Name, auch mit Platzhaltern.", Verb: "Nur Befehle mit diesem Verb.", Noun: "Nur Befehle mit diesem Nomen.", Syntax: "Zeigt nur die Syntax." } },
    "Get-Help": { k: "Zeigt die Hilfe zu einem Befehl oder Thema.", t: "Get-Help erklärt Befehle: -Examples zeigt Beispiele, -Parameter erklärt einen Parameter, -Full zeigt alles, -Online öffnet die Microsoft-Doku. Im Simulator sind die Hilfetexte kurz und deutsch.",
      b: [["Get-Help Get-ChildItem", "Kurzhilfe mit Syntax."], ["Get-Help Copy-Item -Examples", "Beispiele zu Copy-Item."], ["Get-Help Get-ChildItem -Parameter Path", "Erklärt den Parameter -Path."]],
      p: { Name: "Befehl oder Thema (about_…).", Examples: "Nur Beispiele.", Parameter: "Erklärung eines Parameters.", Full: "Alles.", Online: "Online-Hilfe öffnen." } },
    help: { k: "Zeigt die Hilfe seitenweise an (Funktion, ruft Get-Help auf).", t: "help ist eine Funktion von PowerShell. Im Simulator verhält sie sich wie Get-Help.", b: [["help Get-Process", "Hilfe zu Get-Process."]], p: {} },
    "Get-Alias": { k: "Zeigt Aliase (Kurznamen) von Befehlen.", t: "Get-Alias verrät, wofür ein Kurzname wie ls steht. Mit -Definition findest du alle Aliase eines Befehls.",
      b: [["Get-Alias ls", "ls steht für Get-ChildItem."], ["Get-Alias -Definition Get-ChildItem", "Alle Aliase von Get-ChildItem."]], p: { Name: "Alias.", Definition: "Befehl, zu dem die Aliase gesucht werden." } },
    "Get-Verb": { k: "Zeigt die genehmigten Verben für Befehlsnamen.", t: "PowerShell-Befehle heissen Verb-Nomen. Get-Verb listet die erlaubten Verben mit Gruppe und Beschreibung.", b: [["Get-Verb", "Alle genehmigten Verben."], ["Get-Verb -Verb S*", "Verben, die mit S beginnen."]], p: { Verb: "Verb, auch mit Platzhaltern.", Group: "Gruppe, z. B. Common." } },
    "Get-History": { k: "Zeigt die bisher eingegebenen Befehle.", t: "Get-History listet den Verlauf der aktuellen Sitzung. Mit der Pfeiltaste nach oben holst du frühere Befehle zurück.", b: [["Get-History", "Alle Befehle dieser Sitzung."]], p: { Count: "Nur die letzten n Befehle." } },
    "Get-Process": { k: "Zeigt die laufenden Prozesse (Programme).", t: "Get-Process liefert pro Prozess Name, Id, Speicher (WS) und Rechenzeit (CPU).",
      b: [["Get-Process", "Alle Prozesse."], ["Get-Process | Sort-Object WS -Descending | Select-Object -First 3", "Die drei grössten Speicherfresser."]], p: { Name: "Name, auch mit Platzhaltern.", Id: "Prozess-Id." } },
    "Stop-Process": { k: "Beendet Prozesse.", t: "Stop-Process beendet Programme ohne Rückfrage. Prüfe vorher mit -WhatIf. Prozesse anderer Benutzer und des Systems brauchen Adminrechte.",
      b: [["Stop-Process -Name notepad -WhatIf", "Zeigt nur, was beendet würde."], ["Get-Process notepad | Stop-Process", "Beendet alle Editor-Fenster."]], p: { Name: "Prozessname.", Id: "Prozess-Id.", WhatIf: "Zeigt nur, was passieren würde." } },
    "Get-Service": { k: "Zeigt Dienste (Hintergrundprogramme von Windows).", t: "Get-Service liefert Status (Running, Stopped), Name und Anzeigename jedes Dienstes.",
      b: [["Get-Service", "Alle Dienste."], ["Get-Service Wolken*", "Dienste, deren Name mit Wolken beginnt."], ["Get-Service | Where-Object Status -eq Stopped", "Alle gestoppten Dienste."]], p: { Name: "Dienstname, auch mit Platzhaltern.", DisplayName: "Anzeigename." } },
    "Start-Service": { k: "Startet einen Dienst. Braucht Adminrechte.", t: "Ohne Konsole «Als Administrator» meldet Start-Service einen Fehler.", b: [["Start-Service WolkenriedSync", "Startet den Dienst WolkenriedSync."]], p: { Name: "Dienstname.", PassThru: "Gibt den Dienst danach aus." } },
    "Stop-Service": { k: "Stoppt einen Dienst. Braucht Adminrechte.", t: "Ohne Konsole «Als Administrator» meldet Stop-Service einen Fehler.", b: [["Stop-Service Spooler -WhatIf", "Zeigt nur, was passieren würde."]], p: { Name: "Dienstname." } },
    "Restart-Service": { k: "Startet einen Dienst neu. Braucht Adminrechte.", t: "Restart-Service stoppt den Dienst und startet ihn wieder.", b: [["Restart-Service Spooler", "Startet die Druckwarteschlange neu."]], p: { Name: "Dienstname." } },
    "Get-Date": { k: "Zeigt Datum und Uhrzeit.", t: "Get-Date liefert ein DateTime-Objekt. Damit kannst du rechnen, zum Beispiel (Get-Date).AddDays(-30). Im Simulator ist es immer Montag, 2. November 2026, 09:00 Uhr.",
      b: [["Get-Date", "Jetzt."], ["Get-Date -Format 'dd.MM.yyyy'", "Datum als Text, z. B. 02.11.2026."], ["(Get-Date).AddDays(-30)", "Datum vor 30 Tagen."]], p: { Date: "Anderes Datum statt jetzt.", Format: "Ausgabe als Text nach Muster, z. B. yyyy-MM-dd." } },
    "New-TimeSpan": { k: "Berechnet eine Zeitspanne.", t: "New-TimeSpan liefert die Dauer zwischen zwei Zeitpunkten oder eine Dauer aus Tagen, Stunden und Minuten.", b: [["New-TimeSpan -Start '2026-10-01' -End (Get-Date)", "Zeit seit dem 1. Oktober."]], p: {} },
    "Test-Connection": { k: "Prüft, ob ein Computer im Netz antwortet (Ping).", t: "Test-Connection schickt Ping-Anfragen. -Quiet antwortet nur mit True oder False. Im Simulator antworten localhost, server und www.wolkenried.ch.",
      b: [["Test-Connection server -Count 2", "Zwei Pings an server."], ["Test-Connection www.wolkenried.ch -Quiet", "True, wenn die Seite antwortet."]], p: { TargetName: "Name oder Adresse.", Count: "Anzahl Pings (Standard 4).", Quiet: "Nur True oder False." } },
    "Get-PSDrive": { k: "Zeigt die Laufwerke von PowerShell.", t: "Neben C: gibt es Laufwerke für Umgebungsvariablen (Env:) und die Registry (HKCU:). Du bedienst sie mit denselben Befehlen wie Ordner.", b: [["Get-PSDrive", "Alle Laufwerke."], ["Get-ChildItem Env:", "Alle Umgebungsvariablen."]], p: {} },
    "Get-ExecutionPolicy": { k: "Zeigt die Ausführungsrichtlinie für Skripte.", t: "Die Ausführungsrichtlinie schützt vor versehentlichem Ausführen von Skripten. Sie ist keine Sicherheitsgrenze. Standard auf Windows-Clients: RemoteSigned.", b: [["Get-ExecutionPolicy", "Die geltende Richtlinie."], ["Get-ExecutionPolicy -List", "Richtlinie pro Bereich."]], p: { List: "Alle Bereiche anzeigen." } },
    "Set-ExecutionPolicy": { k: "Ändert die Ausführungsrichtlinie.", t: "Für dich allein ohne Adminrechte: -Scope CurrentUser. Für den ganzen Computer braucht es Adminrechte.", b: [["Set-ExecutionPolicy RemoteSigned -Scope CurrentUser", "Lokale Skripte für dich erlauben."]], p: { ExecutionPolicy: "Restricted, RemoteSigned, AllSigned, Unrestricted, Bypass.", Scope: "CurrentUser, LocalMachine oder Process." } },
    "Write-Host": { k: "Schreibt Text direkt in die Konsole.", t: "Write-Host gibt nur Text aus, nicht in die Pipeline. Für Ergebnisse, mit denen weitergearbeitet wird, nimm Write-Output.", b: [["Write-Host 'Fertig' -ForegroundColor Green", "Schreibt Fertig in Grün."]], p: { Object: "Text.", ForegroundColor: "Schriftfarbe.", NoNewline: "Ohne Zeilenumbruch." } },
    "Write-Output": { k: "Gibt Objekte in die Pipeline aus.", t: "Write-Output schickt Objekte weiter. Meistens schreibst du den Wert einfach allein auf die Zeile, das hat dieselbe Wirkung.", b: [["Write-Output 'Hallo'", "Gibt Hallo aus."]], p: { InputObject: "Was ausgegeben wird." } },
    "Write-Error": { k: "Meldet einen nicht abbrechenden Fehler.", t: "Write-Error schreibt einen roten Fehler, das Skript läuft aber weiter.", b: [["Write-Error 'Datei fehlt'", "Meldet einen Fehler."]], p: { Message: "Fehlertext." } },
    "Write-Warning": { k: "Schreibt eine gelbe Warnung.", t: "Die Warnung beginnt mit WARNING: und unterbricht nichts.", b: [["Write-Warning 'Speicher knapp'", "Zeigt eine Warnung."]], p: { Message: "Warntext." } },
    "Write-Verbose": { k: "Schreibt Zusatzinformationen, die nur mit -Verbose erscheinen.", t: "Ohne -Verbose bleibt die Meldung unsichtbar.", b: [["Write-Verbose 'Starte Schritt 1' -Verbose", "Zeigt VERBOSE: Starte Schritt 1."]], p: {} },
    "Clear-Host": { k: "Leert den Konsolenbildschirm.", t: "Clear-Host (Alias cls oder clear) löscht nur die Anzeige, nicht den Verlauf.", b: [["Clear-Host", "Bildschirm leeren."]], p: {} },
    "Out-Null": { k: "Verwirft die Ausgabe.", t: "Out-Null schluckt alles, was durch die Pipeline kommt.", b: [["New-Item -ItemType Directory Test | Out-Null", "Ordner anlegen ohne Ausgabe."]], p: {} },
    "Out-String": { k: "Wandelt die Ausgabe in einen Text um.", t: "Out-String liefert die formatierte Ausgabe als einen String.", b: [["Get-Date | Out-String", "Das Datum als Text."]], p: {} },
    "Out-Host": { k: "Schickt die Ausgabe direkt in die Konsole.", t: "Out-Host zeigt Objekte sofort an.", b: [["Get-Process | Out-Host", "Prozessliste anzeigen."]], p: {} },
    "Start-Sleep": { k: "Wartet eine Zeit lang.", t: "Im Simulator läuft Start-Sleep ohne Wartezeit.", b: [["Start-Sleep -Seconds 2", "Wartet zwei Sekunden."]], p: {} },
    "Get-Culture": { k: "Zeigt die Kultur (Sprache und Formate) des Systems.", t: "Auf Leas Rechner ist die Kultur de-CH: Datum 02.11.2026, Tausendertrenner ’.", b: [["Get-Culture", "de-CH."]], p: {} },
  };

  const ABOUT = {
    about_Pipelines: ["Verbinde Befehle mit dem Pipeline-Zeichen |.", "Mit | gibst du die Objekte eines Befehls an den nächsten weiter, eines nach dem anderen. Beispiel: Get-ChildItem | Where-Object Length -gt 1MB | Sort-Object Length."],
    about_Comparison_Operators: ["Vergleichsoperatoren wie -eq, -gt, -like und -match.", "-eq gleich, -ne ungleich, -gt grösser, -lt kleiner, -ge und -le mit Gleichheit, -like mit Platzhaltern, -match mit regulären Ausdrücken, -contains und -in für Listen. Ohne Gross/Klein; mit c davor (-ceq) mit Gross/Klein."],
    about_Execution_Policies: ["Ausführungsrichtlinien für Skripte.", "Die Richtlinie bestimmt, ob Skripte laufen dürfen: Restricted (keine), RemoteSigned (lokale ja, heruntergeladene nur signiert), AllSigned, Unrestricted, Bypass. Sie schützt vor Versehen, nicht vor Angriffen."],
    about_Variables: ["Variablen speichern Werte.", "Variablen beginnen mit $, zum Beispiel $name = 'Lea'. Sie können Text, Zahlen, Listen und Objekte enthalten."],
    about_Automatic_Variables: ["Variablen, die PowerShell selbst setzt.", "Beispiele: $_ (aktuelles Objekt in der Pipeline), $true, $false, $null, $HOME, $PSVersionTable, $Error."],
    about_Wildcards: ["Platzhalter in Namen und Pfaden.", "* steht für beliebig viele Zeichen, ? für genau ein Zeichen, [abc] für eines der Zeichen. Beispiel: Get-ChildItem *.log."],
    about_If: ["Bedingungen mit if, elseif und else.", "if ($x -gt 5) { 'gross' } elseif ($x -gt 2) { 'mittel' } else { 'klein' }"],
    about_Switch: ["Mehrere Fälle mit switch prüfen.", "switch ($status) { 'Running' { 'läuft' } 'Stopped' { 'gestoppt' } default { 'unbekannt' } }. Mit -Wildcard sind Platzhalter erlaubt."],
    about_Foreach: ["Schleife über alle Elemente einer Sammlung.", "foreach ($datei in Get-ChildItem) { $datei.Name }"],
    about_Functions: ["Eigene Befehle mit function.", "function Get-Doppelt { param([int]$Zahl) $Zahl * 2 }. Danach rufst du Get-Doppelt -Zahl 5 auf."],
    about_Try_Catch_Finally: ["Abbrechende Fehler abfangen.", "try { Get-Item nix -ErrorAction Stop } catch { \"Fehler: $($_.Exception.Message)\" } finally { 'fertig' }"],
    about_Quoting_Rules: ["Anführungszeichen: wörtlich oder mit Einsetzen.", "'$name' bleibt genau so stehen. \"$name\" setzt den Wert der Variable ein. Mit dem Backtick ` maskierst du Zeichen, `n ist ein Zeilenumbruch."],
    about_Arrays: ["Listen von Werten.", "$liste = 1, 2, 3 oder @(1, 2, 3). Zugriff mit $liste[0], das letzte Element mit $liste[-1], Anzahl mit $liste.Count."],
    about_Hash_Tables: ["Schlüssel-Wert-Tabellen.", "$h = @{ Name = 'Lea'; Ort = 'Wolkenried' }. Zugriff mit $h.Name oder $h['Name']."],
    about_Scripts: ["Skripte sind Textdateien mit der Endung .ps1.", "Du startest ein Skript im aktuellen Ordner mit .\\skript.ps1. Das .\\ ist nötig, weil PowerShell Befehle nicht automatisch im aktuellen Ordner sucht."],
    about_Parameters: ["Parameter von Befehlen.", "Parameter beginnen mit -, zum Beispiel -Path. Manche sind positional (ohne Namen an fester Stelle), Schalter wie -Recurse haben keinen Wert."],
    about_Aliases: ["Kurznamen für Befehle.", "ls, dir und gci stehen alle für Get-ChildItem. In Skripten schreibst du besser den vollen Namen."],
    about_CommonParameters: ["Gemeinsame Parameter aller Cmdlets.", "Zum Beispiel -ErrorAction, -WarningAction, -Verbose. Befehle, die etwas ändern, haben dazu -WhatIf und -Confirm."],
  };

  function hilfeText(name, def, o, s) {
    const h = HILFE[def ? def.name : name] || {};
    const z = [];
    const leer = () => z.push("");
    const block = (titel, zeilen) => { z.push(titel); zeilen.forEach((t) => z.push("    " + t)); leer(); };
    const absatz = (t) => umbrechen(t, BREITE - 8);
    if (o.beispiele) {
      leer();
      block("NAME", [def.name]);
      block("SYNOPSIS", absatz(h.k || ""));
      (h.b || []).forEach((b, i) => {
        z.push("    " + links("-".repeat(16) + " Example " + (i + 1) + " " + "-".repeat(16), 0));
        leer();
        z.push("    " + b[0]);
        leer();
        absatz(b[1]).forEach((t) => z.push("    " + t));
        leer();
      });
      return z;
    }
    if (o.parameter) {
      const meta = syntaxMeta(def);
      const treffer = Array.from(meta.alle.values()).filter((p) => passt(p.name, o.parameter));
      if (!treffer.length) return null;
      treffer.forEach((p) => {
        leer();
        z.push("-" + p.name + (p.schalter ? "" : " <" + p.typ + ">"));
        absatz((h.p && h.p[p.name]) || "Im Simulator ist für diesen Parameter keine Beschreibung hinterlegt.").forEach((t) => z.push("    " + t));
        leer();
        const satz = meta.saetze.find((x) => x.params.some((y) => y.name === p.name));
        const pp = satz.params.find((y) => y.name === p.name);
        z.push("    Required?                    " + (pp.pflicht ? "true" : "false"));
        z.push("    Position?                    " + (pp.position === null ? "Named" : pp.position));
        z.push("    Default value                " + (p.schalter ? "False" : "None"));
        z.push("    Accept pipeline input?       " + ((def.pipeline || []).includes(p.name) ? "true (ByValue, ByPropertyName)" : "false"));
        z.push("    Accept wildcard characters?  " + (["Path", "Filter", "Include", "Exclude", "Name"].includes(p.name) && !/^(New|Rename)-/.test(def.name) ? "true" : "false"));
        leer();
      });
      return z;
    }
    leer();
    block("NAME", [def ? def.name : name]);
    if (h.k) block("SYNOPSIS", absatz(h.k));
    leer();
    z.push("SYNTAX");
    (def ? def.syntax : []).forEach((zeile) => { umbrechen(zeile, BREITE - 8).forEach((t, i) => z.push((i ? "        " : "    ") + t)); leer(); });
    leer();
    if (h.t) block("DESCRIPTION", absatz(h.t));
    if (o.voll && h.p) {
      z.push("PARAMETERS");
      Object.keys(h.p).forEach((n) => { z.push("    -" + n); absatz(h.p[n]).forEach((t) => z.push("        " + t)); leer(); });
    }
    if (o.voll && h.b) {
      z.push("EXAMPLES");
      h.b.forEach((b, i) => { z.push("    --------- Example " + (i + 1) + " ---------"); leer(); z.push("    " + b[0]); absatz(b[1]).forEach((t) => z.push("    " + t)); leer(); });
    }
    const aliase = Object.keys(ALIASE).filter((a) => def && gleichCI(ALIASE[a], def.name)).sort(ordinalCI);
    leer();
    block("ALIASES", aliase.length ? aliase : ["None"]);
    leer();
    block("REMARKS", [
      "Beispiele: \"Get-Help " + (def ? def.name : name) + " -Examples\"",
      "Ein Parameter: \"Get-Help " + (def ? def.name : name) + " -Parameter Path\"",
      "Alles: \"Get-Help " + (def ? def.name : name) + " -Full\"",
      "Online (echte Hilfe von Microsoft): \"Get-Help " + (def ? def.name : name) + " -Online\"",
    ]);
    return z;
  }

  function onlineAdresse(def) {
    const modul = klein(def.modul || "microsoft.powershell.core");
    return "https://learn.microsoft.com/powershell/module/" + modul + "/" + klein(def.name);
  }

  cmdlet("Get-Help", "C", {
    run(ctx) {
      const s = ctx.sitzung;
      const name = ctx.hat("Name") ? textVon(ctx.wert("Name")) : "";
      if (!name) {
        return [["", "TOPIC", "    PowerShell Help System (Simulator)", "", "SHORT DESCRIPTION", "    Get-Help zeigt Hilfe zu Befehlen und Themen.", "",
          "LONG DESCRIPTION", "    Get-Help <Befehl>                Kurzhilfe mit Syntax", "    Get-Help <Befehl> -Examples      Beispiele",
          "    Get-Help <Befehl> -Parameter X   ein Parameter im Detail", "    Get-Help <Befehl> -Full          alles", "    Get-Help about_*                 Themenübersicht",
          "    Get-Command *Wort*               Befehle suchen", ""].join("\n")];
      }
      if (/^about_/i.test(name) || (hatPlatzhalter(name) && /^about/i.test(name))) {
        const themen = Object.keys(ABOUT).filter((t) => passt(t, name));
        if (themen.length === 1 && !hatPlatzhalter(name)) {
          const [kurz, lang] = ABOUT[themen[0]];
          return [["", "TOPIC", "    " + themen[0], "", "SHORT DESCRIPTION"].concat(umbrechen(kurz, BREITE - 8).map((t) => "    " + t), ["", "LONG DESCRIPTION"],
            umbrechen(lang, BREITE - 8).map((t) => "    " + t), ["", "SEE ALSO", "    https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/" + klein(themen[0]), ""]).join("\n")];
        }
        if (themen.length) return themen.map((t) => neuesObjekt([["Name", t], ["Category", "HelpFile"], ["Module", ""], ["Synopsis", ABOUT[t][0]]]));
      }
      if (hatPlatzhalter(name)) {
        const treffer = alleBefehle(s).filter((b) => b.art !== "Alias" && passt(b.name, name));
        if (treffer.length) return treffer.map((b) => neuesObjekt([["Name", b.name], ["Category", b.art], ["Module", CMDLETS[klein(b.name)] ? CMDLETS[klein(b.name)].modul : ""],
          ["Synopsis", (HILFE[b.name] || {}).k || ""]]));
      }
      const f = s.befehlFinden(name);
      if (f && f.art === "funktion") {
        return [["", "NAME", "    " + f.f.name, "", "SYNTAX", "    " + funktionsSyntax(f.f), "", "ALIASES", "    None", "", "REMARKS", "    None", ""].join("\n")];
      }
      if (f && f.art === "echt") {
        ctx.hinweis("«" + f.name + "» gibt es in PowerShell, im Simulator ist dazu aber keine Hilfe hinterlegt. Echte Hilfe: Get-Help " + f.name + " -Online in einer echten PowerShell.");
        return [];
      }
      if (!f || f.art !== "cmdlet") {
        ctx.fehler({ meldung: "Get-Help could not find " + name + " in a help file in this session. To download updated help topics type: \"Update-Help\". To get help online, search for the help topic in the TechNet library at https://go.microsoft.com/fwlink/?LinkID=107116.",
          kategorie: "ResourceUnavailable", ausnahme: "System.Management.Automation.HelpNotFoundException", id: "HelpNotFound", ziel: name });
        return [];
      }
      const def = f.def;
      if (ctx.schalter("Online")) {
        ctx.hinweis("Würde jetzt die Online-Hilfe im Browser öffnen: " + onlineAdresse(def));
        return [];
      }
      const z = hilfeText(name, def, { beispiele: ctx.schalter("Examples"), parameter: ctx.hat("Parameter") ? textVon(alsListe(ctx.wert("Parameter"))[0]) : null,
        voll: ctx.schalter("Full") || ctx.schalter("Detailed") }, s);
      if (z === null) {
        ctx.fehler({ meldung: "No parameter matches criteria " + textVon(ctx.wert("Parameter")) + ".", kategorie: "InvalidArgument", ausnahme: "System.ArgumentException", id: "NoParmsFound" });
        return [];
      }
      return [z.join("\n")];
    },
  });

  /* ======================================================================
     10. Sitzung: öffentliche API ohne Oberfläche
     const s = new Sitzung({ umgebung });   s.zeile("Get-ChildItem") → Ergebnis
     ====================================================================== */

  class Sitzung {
    constructor(optionen) {
      optionen = optionen || {};
      const u = optionen.umgebung || null;
      const welt = optionen.welt || umgebungAnwenden(new Welt(LEA), u);
      if (optionen.admin !== undefined) welt.admin = !!optionen.admin;
      this.welt = welt;
      this.i = new Interpreter(welt);
      if (u && u.ort) {
        const r = this.i.pfadAufloesen(u.ort);
        if (r.laufwerk === "C" && welt.knoten(r.teile)) this.i.orte.C = r.teile;
      }
      if (u && u.variablen) Object.keys(u.variablen).forEach((k) => this.i.varSetzen(k, jsNachPs(u.variablen[k]), null, this.i.global));
    }

    prompt() { return "PS " + this.i.ort + "> "; }

    // Zustand sichern (für Rückfragen: Zeile wird nach der Antwort neu ausgeführt)
    schnappschuss() {
      const i = this.i;
      return { welt: this.welt.kopie(), vars: new Map(Array.from(i.global.vars.entries()).map(([k, v]) => [k, Object.assign({}, v)])),
        funktionen: new Map(i.funktionen), orte: { C: i.orte.C.slice(), ENV: i.orte.ENV.slice(), HKCU: i.orte.HKCU.slice() }, laufwerk: i.laufwerk,
        verlauf: i.verlauf.length, fehler: i.fehlerListe.slice(), zurueck: (i._zurueck || []).slice() };
    }
    wiederherstellen(z) {
      const i = this.i;
      Object.assign(this.welt, z.welt);
      i.welt = this.welt;
      i.global.vars = z.vars;
      i.funktionen = z.funktionen;
      i.orte = z.orte;
      i.laufwerk = z.laufwerk;
      i.verlauf.length = z.verlauf;
      i.fehlerListe = z.fehler;
      i._zurueck = z.zurueck;
    }

    // Eine Eingabe ausführen. o: { antworten, datei, ohneVerlauf, interaktiv }
    zeile(code, o) {
      o = o || {};
      const i = this.i;
      JETZT.ms = this.welt.zeit;
      i.strom = [];
      i.antworten = (o.antworten || []).slice();
      i.alleJa = false;
      i.alleNein = false;
      i.schritte = 0;
      i.tiefe = 0;
      i.tryTiefe = 0;
      i.fehlerUmleitung = [];
      i.befehleDerZeile = [];
      const ergebnis = { code: code, rueckfrage: null, unvollstaendig: false };
      let baum = null;
      try {
        baum = parsen(code);
      } catch (e) {
        if (!(e instanceof ParseFehler)) throw e;
        if (e.unvollstaendig && o.interaktiv) { ergebnis.unvollstaendig = true; return this.abschluss(ergebnis); }
        i.fehlerMelden(parseFehlerDatensatz(e, code, null));
      }
      if (code.trim() && !o.ohneVerlauf) {
        const id = i.verlauf.length ? i.verlauf[i.verlauf.length - 1].id + 1 : 1;
        i.verlauf.push({ id: id, text: code, zeit: this.welt.zeit, dauer: 8 + (code.length % 23) });
      }
      if (baum) {
        i.quellen = [{ text: code, datei: o.datei || null }];
        const oben = [];
        oben.push = (v) => { i.strom.push({ art: "objekt", wert: v }); return 1; };
        try {
          i.saetzeAusfuehren(baum.saetze, i.global, oben);
        } catch (e) {
          if (e instanceof Rueckfrage) ergebnis.rueckfrage = e.text;
          else if (e instanceof AbbruchFehler) i.fehlerMelden(e.datensatz);
          else if (e instanceof SteuerSignal) {
            if (e.art === "exit") i.hinweis("exit würde dieses Konsolenfenster schliessen. Der Simulator läuft weiter.");
          } else {
            i.hinweis("Interner Fehler im Simulator: " + (e && e.message ? e.message : String(e)));
            if (typeof console !== "undefined") console.error("[Lernpfad] ps-konsole:", e);
          }
        }
      }
      return this.abschluss(ergebnis);
    }

    abschluss(ergebnis) {
      const i = this.i;
      ergebnis.strom = i.strom.slice();
      ergebnis.gruppen = formatieren(ergebnis.strom);
      ergebnis.text = gruppenText(ergebnis.gruppen);
      ergebnis.objekte = ergebnis.strom.filter((s) => s.art === "objekt").map((s) => s.wert);
      ergebnis.fehler = ergebnis.strom.filter((s) => s.art === "fehler").map((s) => s.datensatz.meldung)
        .concat(ergebnis.objekte.filter((x) => x instanceof FehlerDatensatz).map((x) => x.meldung));
      ergebnis.befehle = i.befehleDerZeile.slice();
      ergebnis.leeren = ergebnis.strom.some((s) => s.art === "leeren");
      return ergebnis;
    }

    // Prüf-Kontext für Aufgaben (pruefe(ctx))
    kontext(ergebnis, extra) {
      const s = this;
      const i = this.i;
      const knoten = (p) => { try { const r = i.pfadAufloesen(p); return r.laufwerk === "C" ? s.welt.knoten(r.teile) : null; } catch (e) { return null; } };
      return Object.assign({
        eingabe: ergebnis.code,
        befehle: ergebnis.befehle,
        objekte: ergebnis.objekte,
        ausgabe: ergebnis.text,
        fehler: ergebnis.fehler,
        hatFehler: ergebnis.fehler.length > 0,
        ort: i.ort,
        admin: s.welt.admin,
        verlauf: i.verlauf.map((h) => h.text),
        existiert: (p) => !!knoten(p),
        datei: (p) => {
          const k = knoten(p);
          return k ? { name: k.name, ordner: !!k.ordner, groesse: k.ordner ? null : k.groesse, inhalt: k.ordner ? null : k.inhalt, zeit: new Date(k.zeit), versteckt: !!k.versteckt } : null;
        },
        inhalt: (p) => { const k = knoten(p); return k && !k.ordner ? (k.inhalt || "").replace(/\r\n/g, "\n").replace(/\n$/, "") : null; },
        kinder: (p) => { const k = knoten(p); return k && k.ordner ? s.welt.kinderSortiert(k).map((x) => x.name) : null; },
        prozess: (x) => { const p = s.welt.prozesse.find((y) => (typeof x === "number" ? y.id === x : gleichCI(y.name, x))); return p ? Object.assign({}, p) : null; },
        dienst: (n) => { const d = s.welt.dienst(n); return d ? Object.assign({}, d) : null; },
        variable: (n) => psNachJs(i.varHolen(n, null, i.global)),
        umgebungsvariable: (n) => s.welt.envHolen(n),
        text: (v) => textVon(v),
        welt: s.welt,
      }, extra || {});
    }

    /* ---------- Tab-Vervollständigung ---------- */

    // → { start, ende, kandidaten: [Text] }
    vervollstaendigen(text, cursor) {
      const i = this.i;
      if (cursor === undefined) cursor = text.length;
      const vor = text.slice(0, cursor);
      let start = vor.length;
      while (start > 0 && !/[\s|;(){}=,]/.test(vor.charAt(start - 1))) start--;
      const wort = vor.slice(start);
      const ergebnis = (liste) => ({ start: start, ende: cursor, kandidaten: liste });
      // Variablen
      if (wort.startsWith("$")) {
        const m = /^\$(env:)?(.*)$/i.exec(wort);
        if (m[1]) return ergebnis(this.welt.env.map((e) => e[0]).filter((n) => klein(n).startsWith(klein(m[2]))).sort(ordinalCI).map((n) => "$env:" + n));
        const namen = new Set(["true", "false", "null", "HOME", "PSVersionTable", "PWD", "Error", "PSHOME", "PID", "ErrorActionPreference", "Matches", "PSCulture"]);
        for (let b = i.global; b; b = b.eltern) b.vars.forEach((v) => namen.add(v.name));
        return ergebnis(Array.from(namen).filter((n) => klein(n).startsWith(klein(m[2]))).sort(ordinalCI).map((n) => "$" + n));
      }
      // Befehlsname am Anfang eines Pipeline-Abschnitts?
      const abschnitt = vor.slice(0, start).split(/[|;({]/).pop();
      const befehlTeile = abschnitt.trim() ? abschnitt.trim().split(/\s+/) : [];
      if (!befehlTeile.length && !/^\.{0,2}[\\/]|^[a-z]:\\/i.test(wort)) {
        const namen = new Set();
        Object.values(CMDLETS).forEach((d) => { if (!/^[A-Z]:$/.test(d.name)) namen.add(d.name); });
        i.funktionen.forEach((f) => namen.add(f.name));
        Object.keys(ALIASE).forEach((a) => { if (CMDLETS[klein(ALIASE[a])]) namen.add(a); });
        const liste = Array.from(namen).filter((n) => klein(n).startsWith(klein(wort))).sort(ordinalCI);
        if (liste.length || !wort) return ergebnis(liste);
      }
      const befehl = befehlTeile.length ? befehlTeile[0] : null;
      const gefunden = befehl ? i.befehlFinden(befehl) : null;
      // Parameter
      if (/^[-–]/.test(wort) && gefunden) {
        let namen = [];
        if (gefunden.art === "cmdlet") {
          namen = Array.from(syntaxMeta(gefunden.def).alle.values()).map((p) => p.name).concat(COMMON_PARAMETER);
        } else if (gefunden.art === "funktion") namen = (gefunden.f.sb.knoten.param || []).map((p) => p.name);
        return ergebnis(namen.filter((n) => klein(n).startsWith(klein(wort.slice(1)))).map((n) => "-" + n));
      }
      // Werte für bestimmte Parameter
      const letzter = befehlTeile.length > 1 ? klein(befehlTeile[befehlTeile.length - 1]) : "";
      const cmd = gefunden && gefunden.art === "cmdlet" ? klein(gefunden.def.name) : "";
      const werte = (liste) => ergebnis(liste.filter((n) => klein(n).startsWith(klein(wort.replace(/^['"]/, "")))));
      if (/-service$/.test(cmd) && (letzter === "-name" || befehlTeile.length === 1)) return werte(diensteSortiert(this).map((d) => d.name));
      if (/-process$/.test(cmd) && (letzter === "-name" || (befehlTeile.length === 1 && cmd === "get-process"))) return werte(Array.from(new Set(prozesseSortiert(this).map((p) => p.name))));
      if (letzter === "-itemtype") return werte(["Directory", "File", "SymbolicLink", "Junction", "HardLink"]);
      if (letzter === "-pathtype") return werte(["Any", "Container", "Leaf"]);
      if (letzter === "-foregroundcolor" || letzter === "-backgroundcolor") return werte(FARBEN);
      if (letzter === "-erroraction" || letzter === "-ea") return werte(["Break", "Continue", "Ignore", "Inquire", "SilentlyContinue", "Stop", "Suspend"]);
      if (letzter === "-executionpolicy" || cmd === "set-executionpolicy" && befehlTeile.length === 1) return werte(["AllSigned", "Bypass", "Default", "RemoteSigned", "Restricted", "Undefined", "Unrestricted"]);
      if (letzter === "-scope" && /executionpolicy$/.test(cmd)) return werte(["CurrentUser", "LocalMachine", "MachinePolicy", "Process", "UserPolicy"]);
      // Pfade
      return ergebnis(this.pfadKandidaten(wort.replace(/^['"]|['"]$/g, "")));
    }

    pfadKandidaten(wort) {
      const i = this.i;
      const trenner = Math.max(wort.lastIndexOf("\\"), wort.lastIndexOf("/"));
      const ordnerTeil = trenner >= 0 ? wort.slice(0, trenner + 1) : "";
      const praefix = trenner >= 0 ? wort.slice(trenner + 1) : wort;
      let r;
      try { r = i.pfadAufloesen(ordnerTeil || "."); } catch (e) { return []; }
      if (r.laufwerk === "ENV") return this.welt.env.map((e) => e[0]).filter((n) => klein(n).startsWith(klein(praefix))).sort(ordinalCI).map((n) => ordnerTeil + n);
      if (r.laufwerk !== "C") return [];
      const k = this.welt.knoten(r.teile);
      if (!k || !k.ordner) return [];
      const absolut = /^[a-z]:|^\\|^~/i.test(ordnerTeil);
      const vorsatz = absolut || /^\.{1,2}[\\/]/.test(ordnerTeil) ? ordnerTeil : ".\\" + ordnerTeil;
      return this.welt.kinderSortiert(k)
        .filter((x) => !x.versteckt && klein(x.name).startsWith(klein(praefix)))
        .map((x) => {
          const p = vorsatz + x.name;
          return /\s/.test(p) ? "'" + p + "'" : p;
        });
    }
  }

  const FARBEN = ["Black", "DarkBlue", "DarkGreen", "DarkCyan", "DarkRed", "DarkMagenta", "DarkYellow", "Gray", "DarkGray", "Blue", "Green", "Cyan", "Red", "Magenta", "Yellow", "White"];

  function gruppenText(gruppen) {
    const zeilen = [];
    gruppen.forEach((g) => g.zeilen.forEach((z) => { if (z !== "LEEREN") zeilen.push(zeilenText(z)); }));
    while (zeilen.length && zeilen[zeilen.length - 1] === "") zeilen.pop();
    return zeilen.join("\n");
  }

  // Werte aus cfg.umgebung.variablen (JS) → PowerShell und zurück (für Aufgaben)
  function jsNachPs(v) {
    if (v === null || v === undefined) return null;
    if (Array.isArray(v)) return v.map(jsNachPs);
    if (v instanceof Date) return new PSDatum(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(), v.getHours(), v.getMinutes(), v.getSeconds()));
    if (typeof v === "object") { const h = new PSHashtable(true); Object.keys(v).forEach((k) => h.setzen(k, jsNachPs(v[k]))); return h; }
    return v;
  }
  function psNachJs(v) {
    if (v === null || v === undefined) return null;
    if (v instanceof PSDouble) return v.w;
    if (Array.isArray(v)) return v.map(psNachJs);
    if (v instanceof PSDatum) { const p = datumTeile(v); return new Date(p.j, p.m - 1, p.t, p.h, p.min, p.s); }
    if (v instanceof PSHashtable) { const o = {}; v.eintraege().forEach((e) => { o[textVon(e.k)] = psNachJs(e.w); }); return o; }
    if (v instanceof PSObjekt) { const o = {}; sichtbareNamen(v).forEach((n) => { const w = eig(v, n); o[n] = w instanceof PSObjekt ? textVon(w) : psNachJs(w); }); return o; }
    if (v instanceof PSEnum) return v.name;
    if (v instanceof PSZeitspanne) return v.ms;
    if (typeof v === "object") return textVon(v);
    return v;
  }

  // Lernpfad.konsole.ausfuehren(code, umgebung): Ausgabe als Text (ohne Oberfläche)
  function ausfuehren(code, umgebung) {
    const s = new Sitzung({ umgebung: umgebung });
    const antworten = umgebung && umgebung.antworten ? umgebung.antworten : null;
    let r = s.zeile(String(code === undefined || code === null ? "" : code), { antworten: antworten || [] });
    if (r.rueckfrage && !antworten) {
      // Ohne vorbereitete Antwort: Rückfrage anzeigen und mit «N» beantworten
      r = new Sitzung({ umgebung: umgebung }).zeile(String(code), { antworten: ["N", "N", "N", "N", "N", "N", "N", "N"] });
    }
    return r.text;
  }

  // Mehrere Befehle nacheinander auf demselben Rechner (für Filme mit mehreren Szenen)
  function sitzungFuer(umgebung) {
    const s = new Sitzung({ umgebung: umgebung });
    return {
      ausfuehren(code, antworten) { return s.zeile(String(code), { antworten: antworten || ["N", "N", "N", "N"] }).text; },
      // HTML für einen Film oder Stepper: Prompt, gefärbter Befehl und Ausgabe in <pre class="ps-ausgabe">
      html(code, antworten) {
        const prompt = s.prompt();
        const r = s.zeile(String(code), { antworten: antworten || ["N", "N", "N", "N"] });
        return '<pre class="ps-ausgabe">' + '<span class="psk-prompt">' + htmlEsc(prompt) + "</span>" + tokensHtml(String(code), "psk-t-") + (r.text ? "\n" + gruppenHtml(r.gruppen) : "") + "</pre>";
      },
      prompt: () => s.prompt(),
      sitzung: s,
    };
  }

  /* ======================================================================
     11. Syntaxfärbung
     Zerlegt Text in Teile mit Klasse: befehl, parameter, variable, string, zahl, operator,
     kommentar, schluesselwort, typ (null = normaler Text). Liest nur Text, führt nichts aus.
     ====================================================================== */

  const FAERBE_KW = new Set(Array.from(SCHLUESSELWOERTER).concat(["in", "until", "default"]));
  const FAERBE_OPS = /^[-–—]([A-Za-z]+)/;

  function faerbeTokens(text) {
    const out = [];
    const n = text.length;
    let i = 0;
    let modus = "start"; // start (Befehl erwartet), args (Argumente eines Befehls), ausdruck
    let nachFunction = false;
    const push = (t, k) => {
      if (!t) return;
      const letzte = out[out.length - 1];
      if (letzte && letzte.k === k) letzte.t += t; else out.push({ t: t, k: k });
    };
    const lies = (re) => { re.lastIndex = i; const m = re.exec(text); return m && m.index === i ? m[0] : null; };
    while (i < n) {
      const c = text.charAt(i), d = text.charAt(i + 1);
      if (c === "\n") { push(c, null); i++; modus = "start"; continue; }
      if (/\s/.test(c)) { const w = lies(/[^\S\n]+/y); push(w, null); i += w.length; continue; }
      if (c === "<" && d === "#") { const e = text.indexOf("#>", i + 2); const ende = e < 0 ? n : e + 2; push(text.slice(i, ende), "kommentar"); i = ende; continue; }
      if (c === "#") { let e = text.indexOf("\n", i); if (e < 0) e = n; push(text.slice(i, e), "kommentar"); i = e; continue; }
      if (c === "`" && d === "\n") { push("`", null); i++; continue; }
      if (c === "@" && (enthaelt(DOPPELTE_ANFZ, d) || enthaelt(EINFACHE_ANFZ, d)) && /^[ \t]*\r?\n/.test(text.slice(i + 2))) {
        const muster = enthaelt(DOPPELTE_ANFZ, d) ? /\n["“”„]@/g : /\n['‘’‚‛]@/g;
        muster.lastIndex = i;
        const m = muster.exec(text);
        const ende = m ? m.index + m[0].length : n;
        stringFaerben(text.slice(i, ende), enthaelt(DOPPELTE_ANFZ, d), push);
        i = ende;
        if (modus === "start") modus = "ausdruck";
        continue;
      }
      if (enthaelt(EINFACHE_ANFZ, c) || enthaelt(DOPPELTE_ANFZ, c)) {
        const doppelt = enthaelt(DOPPELTE_ANFZ, c);
        let j = i + 1;
        while (j < n) {
          const z = text.charAt(j);
          if (doppelt && z === "`") { j += 2; continue; }
          if (enthaelt(doppelt ? DOPPELTE_ANFZ : EINFACHE_ANFZ, z)) {
            if (enthaelt(doppelt ? DOPPELTE_ANFZ : EINFACHE_ANFZ, text.charAt(j + 1))) { j += 2; continue; }
            j++;
            break;
          }
          if (z === "\n" && !doppelt && false) break;
          j++;
        }
        stringFaerben(text.slice(i, j), doppelt, push);
        i = j;
        if (modus === "start") modus = "ausdruck";
        continue;
      }
      if (c === "$") {
        const w = lies(/\$(\{[^}]*\}|[A-Za-z_][\w]*(?::[A-Za-z_][\w]*)?|[?^$_])/y);
        if (w) { push(w, "variable"); i += w.length; if (modus === "start") modus = "ausdruck"; continue; }
      }
      if (c === "[" && modus !== "args") {
        const w = lies(/\[[A-Za-z][\w.]*(\[\])?\]/y);
        if (w) { push(w, "typ"); i += w.length; if (modus === "start") modus = "ausdruck"; continue; }
      }
      if (enthaelt(STRICHE, c) && /[A-Za-z]/.test(d)) {
        const m = FAERBE_OPS.exec(text.slice(i));
        if (modus === "args") {
          const w = lies(/[-–—―][A-Za-z_][\w-]*:?/y);
          push(w, "parameter");
          i += w.length;
          continue;
        }
        if (m && OPERATOREN.has(klein(m[1]))) { push(m[0], "operator"); i += m[0].length; modus = "ausdruck"; continue; }
        const w = lies(/[-–—―][A-Za-z_][\w-]*:?/y);
        push(w, "parameter");
        i += w.length;
        continue;
      }
      if (/\d/.test(c) || (c === "." && /\d/.test(d) && modus !== "args") || (enthaelt(STRICHE, c) && /\d/.test(d) && modus === "args")) {
        const w = lies(/[-–—]?(0x[0-9a-f]+|(\d+(\.(?!\.)\d*)?|\.\d+)(e[+-]?\d+)?)([dl])?(kb|mb|gb|tb|pb)?(?![\w\\.])/iy);
        if (w) { push(w, "zahl"); i += w.length; if (modus === "start") modus = "ausdruck"; continue; }
      }
      if ("|;".includes(c)) { push(c === "|" && d === "|" ? "||" : c, c === "|" ? "operator" : null); i += c === "|" && d === "|" ? 2 : 1; modus = "start"; continue; }
      if (c === "&" && d === "&") { push("&&", "operator"); i += 2; modus = "start"; continue; }
      if (c === "&") { push("&", "operator"); i++; modus = "start"; continue; }
      if ("({".includes(c) || (c === "@" && enthaelt("({", d)) || (c === "$" && d === "(")) {
        const w = c === "@" || c === "$" ? c + d : c;
        push(w, null);
        i += w.length;
        modus = "start";
        continue;
      }
      if (")}]".includes(c)) { push(c, null); i++; modus = modus === "args" ? "args" : "ausdruck"; continue; }
      if (c === "," ) { push(c, modus === "args" ? null : "operator"); i++; continue; }
      if (/[=!+*/%<>]/.test(c) || (c === "." && d === ".") || (c === "-" && modus !== "args")) {
        const w = lies(/(\?\?=|\+=|-=|\*=|\/=|%=|\.\.|\+\+|--|2>&1|\*>&1|[12*]?>>?|[=!+\-*/%<>])/y) || c;
        push(w, "operator");
        i += w.length;
        if (/=$/.test(w) && !/[<>]=?$/.test(w)) modus = "start";
        continue;
      }
      if (c === "." && modus === "ausdruck" && /[A-Za-z_]/.test(d)) {
        const w = lies(/\.[A-Za-z_][\w]*/y);
        push(w, null);
        i += w.length;
        continue;
      }
      if (c === ":" && d === ":") { push("::", "operator"); i += 2; continue; }
      // Wort: Befehlsname, Schlüsselwort oder Argument
      const w = lies(/[^\s|;(){},&"'“”„‘’‚‛]+/y) || c;
      const k = klein(w);
      if (modus === "start" || nachFunction) {
        if (nachFunction) { push(w, "befehl"); nachFunction = false; modus = "start"; }
        else if (FAERBE_KW.has(k)) { push(w, "schluesselwort"); if (k === "function" || k === "filter") nachFunction = true; modus = ["foreach", "while", "if", "elseif", "switch", "for", "until"].includes(k) ? "start" : "start"; }
        else { push(w, "befehl"); modus = "args"; }
      } else if (modus === "ausdruck" && FAERBE_KW.has(k)) {
        push(w, "schluesselwort");
        modus = "start";
      } else push(w, null);
      i += w.length;
    }
    return out;
  }

  // String färben; in "…" erscheinen $variable und $( … ) als Variable
  function stringFaerben(roh, doppelt, push) {
    if (!doppelt) { push(roh, "string"); return; }
    const re = /`.|\$(\{[^}]*\}|[A-Za-z_][\w]*(?::[A-Za-z_][\w]*)?)/g;
    let letzte = 0, m;
    while ((m = re.exec(roh))) {
      if (m[0].charAt(0) === "`") continue;
      push(roh.slice(letzte, m.index), "string");
      push(m[0], "variable");
      letzte = m.index + m[0].length;
    }
    push(roh.slice(letzte), "string");
  }

  function tokensHtml(text, praefix) {
    return faerbeTokens(text).map((t) => (t.k ? '<span class="' + (praefix || "ps-t-") + t.k + '">' + htmlEsc(t.t) + "</span>" : htmlEsc(t.t))).join("");
  }
  // Formatierte Ausgabe als HTML (für Filme und Stepper)
  function gruppenHtml(gruppen) {
    const zeilen = [];
    gruppen.forEach((g) => g.zeilen.forEach((z) => { if (z !== "LEEREN") zeilen.push(z); }));
    while (zeilen.length && zeilenText(zeilen[zeilen.length - 1]) === "") zeilen.pop();
    return zeilen.map((z) => z.map((t) => (t[1] ? '<span class="psk-' + t[1] + '">' + htmlEsc(t[0]) + "</span>" : htmlEsc(t[0]))).join("").replace(/\s+$/, "")).join("\n");
  }

  /* ======================================================================
     12. Oberfläche (nur im Browser)
     Lernpfad.psFaerben(root), Lernpfad.konsole(el, cfg), .ps-ausgabe[data-ps-befehl]
     Alle Texte aus Eingaben gelangen per textContent ins DOM.
     ====================================================================== */

  let DOC = null; // document, sobald im Browser
  let zaehler = 0;
  const neueId = (p) => "psk-" + p + "-" + ++zaehler;

  function erzeugen(tag, klasse, text) {
    const e = DOC.createElement(tag);
    if (klasse) e.className = klasse;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function knopf(text, klasse, attribute) {
    const b = erzeugen("button", "btn" + (klasse ? " " + klasse : ""), text);
    b.type = "button";
    Object.keys(attribute || {}).forEach((k) => b.setAttribute(k, attribute[k]));
    return b;
  }

  // Teile [{t, k}] als Spans in ein Element schreiben
  function tokensEinfuegen(ziel, tokens, praefix) {
    tokens.forEach((t) => {
      if (!t.k) ziel.appendChild(DOC.createTextNode(t.t));
      else ziel.appendChild(erzeugen("span", praefix + t.k, t.t));
    });
  }

  function psFaerben(root) {
    if (!DOC) return 0;
    root = root || DOC.body;
    if (!root || !root.querySelectorAll) return 0;
    const ziele = [];
    if (root.matches && root.matches("pre.ps-code, code.ps")) ziele.push(root);
    root.querySelectorAll("pre.ps-code, code.ps").forEach((e) => ziele.push(e));
    let n = 0;
    ziele.forEach((e) => {
      const ziel = e.tagName === "PRE" && e.querySelector("code") ? e.querySelector("code") : e;
      if (ziel.getAttribute("data-ps-gefaerbt") === "1") return;
      const text = ziel.textContent;
      ziel.textContent = "";
      tokensEinfuegen(ziel, faerbeTokens(text), "ps-t-");
      ziel.setAttribute("data-ps-gefaerbt", "1");
      n++;
    });
    return n;
  }

  // Ausgabezeilen (Teile [Text, Klasse]) in ein <pre> schreiben
  function zeilenEinfuegen(pre, zeilen) {
    zeilen.forEach((z) => {
      if (pre.childNodes.length) pre.appendChild(DOC.createTextNode("\n"));
      const text = zeilenText(z);
      if (!text) return;
      let rest = text.length;
      z.forEach((t) => {
        if (rest <= 0) return;
        const teil = t[0].slice(0, rest);
        rest -= teil.length;
        const lang = t[1] === "fehler" || t[1] === "warnung" || t[1] === "kopf" ? "en" : null;
        if (!t[1]) pre.appendChild(DOC.createTextNode(teil));
        else {
          const sp = erzeugen("span", "psk-" + t[1], teil);
          if (lang) sp.setAttribute("lang", lang);
          pre.appendChild(sp);
        }
      });
    });
  }

  // <pre class="ps-ausgabe" data-ps-befehl="…"> mit echter Simulator-Ausgabe füllen
  function ausgabenFuellen(root) {
    const sitzungen = {};
    (root || DOC.body).querySelectorAll("pre.ps-ausgabe[data-ps-befehl]").forEach((pre) => {
      if (pre.getAttribute("data-ps-gefuellt") === "1") return;
      const name = pre.getAttribute("data-ps-sitzung");
      const s = name ? (sitzungen[name] = sitzungen[name] || new Sitzung({})) : new Sitzung({});
      const code = pre.getAttribute("data-ps-befehl");
      pre.textContent = "";
      if (pre.getAttribute("data-ps-prompt") !== "nein") {
        pre.appendChild(erzeugen("span", "psk-prompt", s.prompt()));
        tokensEinfuegen(pre, faerbeTokens(code), "psk-t-");
      }
      const r = s.zeile(code, { antworten: ["N", "N", "N", "N"] });
      const zeilen = [];
      r.gruppen.forEach((g) => g.zeilen.forEach((z) => { if (z !== "LEEREN") zeilen.push(z); }));
      while (zeilen.length && zeilenText(zeilen[zeilen.length - 1]) === "") zeilen.pop();
      zeilenEinfuegen(pre, zeilen); // nach dem Prompt beginnt jede Zeile mit einem Umbruch
      pre.setAttribute("data-ps-gefuellt", "1");
    });
  }

  /* ---------- Lernpfad.konsole(el, cfg) ---------- */

  function konsole(el, cfg) {
    el = typeof el === "string" ? DOC.querySelector(el) : el;
    if (!el) { console.error("[Lernpfad] konsole: Element nicht gefunden."); return null; }
    cfg = cfg || {};
    const skriptModus = cfg.modus === "skript";
    const skriptName = cfg.skriptName || "skript.ps1";
    const aufgaben = Array.isArray(cfg.aufgaben) ? cfg.aufgaben : [];
    let admin = !!cfg.admin;
    let sitzung = null;
    let puffer = [];       // Zeilen bei unvollständiger Eingabe (>>)
    let rueck = null;      // offene Rückfrage { code, antworten, gezeigt, zustand }
    let verlaufIndex = -1, entwurf = "";
    let tab = null;        // { basis, start, ende, kandidaten, index }

    el.textContent = "";
    el.classList.add("psk", "keine-formel");
    if (skriptModus) el.classList.add("psk-skriptmodus");

    // Kopfleiste
    const leiste = erzeugen("div", "psk-leiste");
    const titel = erzeugen("span", "psk-titel");
    const titelText = erzeugen("span", null, cfg.titel || (skriptModus ? "PowerShell 7 · Skript" : "PowerShell 7"));
    const adminMarke = erzeugen("span", "psk-admin", "Administrator");
    titel.append(adminMarke, titelText);
    const knoepfe = erzeugen("div", "psk-knoepfe");
    const bAdmin = cfg.adminKnopf ? knopf("", "psk-knopf") : null;
    const bReset = knopf("↺ Zurücksetzen", "psk-knopf");
    if (bAdmin) knoepfe.appendChild(bAdmin);
    knoepfe.appendChild(bReset);
    leiste.append(titel, knoepfe);

    // Skript-Editor
    let editor = null, argFeld = null, bLos = null;
    const editorBereich = erzeugen("div", "psk-editorbereich");
    if (skriptModus) {
      const idE = neueId("editor"), idA = neueId("arg");
      const lblE = erzeugen("label", "psk-label", "Skript " + skriptName);
      lblE.htmlFor = idE;
      editor = erzeugen("textarea", "psk-editor");
      editor.id = idE;
      editor.spellcheck = false;
      editor.setAttribute("autocapitalize", "off");
      editor.setAttribute("autocomplete", "off");
      editor.rows = Math.min(16, Math.max(6, String(cfg.skript || "").split("\n").length + 1));
      editor.value = cfg.skript || "";
      const lauf = erzeugen("div", "psk-lauf");
      const lblA = erzeugen("label", "psk-label", "Parameter");
      lblA.htmlFor = idA;
      argFeld = erzeugen("input", "psk-arg");
      argFeld.id = idA;
      argFeld.type = "text";
      argFeld.spellcheck = false;
      argFeld.setAttribute("autocapitalize", "off");
      argFeld.setAttribute("autocomplete", "off");
      argFeld.placeholder = cfg.argumenteBeispiel || "z. B. -Tage 30";
      argFeld.value = cfg.argumente || "";
      bLos = knopf("▶ Ausführen", "primary");
      lauf.append(lblA, argFeld, bLos);
      editorBereich.append(lblE, editor, lauf);
    } else editorBereich.hidden = true;

    // Ausgabefenster
    const fenster = erzeugen("div", "psk-fenster");
    fenster.setAttribute("role", "log");
    fenster.setAttribute("aria-live", "polite");
    fenster.setAttribute("aria-label", skriptModus ? "Ausgabe des Skripts" : "Ausgabe der Konsole");
    fenster.tabIndex = 0;
    const pre = erzeugen("pre", "psk-ausgabe");
    fenster.appendChild(pre);

    // Eingabezeile
    const idEin = neueId("eingabe"), idHilfe = neueId("hilfe");
    const zeileEin = erzeugen("div", "psk-eingabezeile");
    const prompt = erzeugen("label", "psk-prompt");
    prompt.htmlFor = idEin;
    const eingabe = erzeugen("input", "psk-eingabe");
    eingabe.id = idEin;
    eingabe.type = "text";
    eingabe.spellcheck = false;
    eingabe.setAttribute("autocomplete", "off");
    eingabe.setAttribute("autocapitalize", "off");
    eingabe.setAttribute("autocorrect", "off");
    eingabe.setAttribute("enterkeyhint", "send");
    eingabe.setAttribute("aria-describedby", idHilfe);
    zeileEin.append(prompt, eingabe);
    const hilfe = erzeugen("p", "psk-tasten", "Enter führt aus · ↑ ↓ holt frühere Befehle · Tab vervollständigt (bei leerer Zeile springt Tab weiter) · Esc leert die Zeile");
    hilfe.id = idHilfe;
    if (skriptModus) { zeileEin.hidden = true; hilfe.hidden = true; }

    const ansage = erzeugen("p", "sr-only");
    ansage.setAttribute("aria-live", "polite");

    const terminal = erzeugen("div", "psk-terminal");
    terminal.append(leiste, editorBereich, fenster, zeileEin, hilfe);
    el.appendChild(terminal);

    /* ---------- Aufgaben ---------- */
    const geloest = aufgaben.map(() => false);
    let liste = null, stand = null;
    const aufgabenEl = [];
    if (aufgaben.length) {
      const box = erzeugen("section", "psk-aufgaben");
      const idT = neueId("aufgaben");
      const h = erzeugen("h3", null, cfg.aufgabenTitel || "Aufgaben");
      h.id = idT;
      box.setAttribute("aria-labelledby", idT);
      stand = erzeugen("p", "psk-stand");
      liste = erzeugen("ol", "psk-liste");
      aufgaben.forEach((a, n) => {
        const li = erzeugen("li", "psk-aufgabe");
        li.setAttribute("data-status", "offen");
        const kopf = erzeugen("div", "psk-a-kopf");
        const marke = erzeugen("span", "psk-marke", "○");
        marke.setAttribute("aria-hidden", "true");
        const t = erzeugen("span", "psk-a-titel");
        t.innerHTML = a.titel || "Aufgabe " + (n + 1); // Konfiguration ist HTML wie bei allen Bausteinen
        const sr = erzeugen("span", "sr-only", " (offen)");
        kopf.append(marke, t, sr);
        li.appendChild(kopf);
        if (a.text) { const tx = erzeugen("div", "psk-a-text"); tx.innerHTML = a.text; li.appendChild(tx); }
        const reihe = erzeugen("div", "row psk-a-knoepfe");
        let hinweisEl = null, loesungEl = null;
        if (a.hinweis) {
          hinweisEl = erzeugen("div", "note tipp psk-a-hinweis");
          hinweisEl.id = neueId("hinweis");
          hinweisEl.innerHTML = a.hinweis;
          hinweisEl.hidden = true;
          const b = knopf("Hinweis", "", { "aria-expanded": "false", "aria-controls": hinweisEl.id });
          b.addEventListener("click", () => { hinweisEl.hidden = !hinweisEl.hidden; b.setAttribute("aria-expanded", String(!hinweisEl.hidden)); });
          reihe.appendChild(b);
        }
        if (a.loesung) {
          loesungEl = erzeugen("div", "psk-a-loesung");
          loesungEl.id = neueId("loesung");
          loesungEl.hidden = true;
          const pc = erzeugen("pre", "ps-code");
          const code = erzeugen("code", null, a.loesung);
          pc.appendChild(code);
          psFaerben(pc);
          const ueb = knopf(skriptModus ? "Ins Skript übernehmen" : "In die Eingabe übernehmen");
          ueb.addEventListener("click", () => {
            if (skriptModus) { editor.value = a.loesung; editor.focus(); }
            else { eingabe.value = a.loesung; eingabe.focus(); }
          });
          loesungEl.append(pc, ueb);
          const b = knopf("Lösung", "", { "aria-expanded": "false", "aria-controls": loesungEl.id });
          b.addEventListener("click", () => { loesungEl.hidden = !loesungEl.hidden; b.setAttribute("aria-expanded", String(!loesungEl.hidden)); });
          reihe.appendChild(b);
        }
        if (reihe.childNodes.length) li.appendChild(reihe);
        if (hinweisEl) li.appendChild(hinweisEl);
        if (loesungEl) li.appendChild(loesungEl);
        liste.appendChild(li);
        aufgabenEl.push({ li: li, marke: marke, sr: sr });
      });
      box.append(h, stand, liste);
      el.appendChild(box);
    }
    el.appendChild(ansage);

    function standZeigen() {
      if (!stand) return;
      const n = geloest.filter(Boolean).length;
      stand.textContent = n + " von " + aufgaben.length + " gelöst";
    }

    function aufgabenPruefen(ergebnis, extra) {
      if (!aufgaben.length || !ergebnis) return;
      const ctx = sitzung.kontext(ergebnis, extra);
      aufgaben.forEach((a, n) => {
        if (geloest[n] || typeof a.pruefe !== "function") return;
        let ok = false;
        try { ok = !!a.pruefe(ctx); }
        catch (e) { console.error("[Lernpfad] konsole: pruefe() von Aufgabe " + (n + 1) + " hat einen Fehler geworfen:", e); }
        if (!ok) return;
        geloest[n] = true;
        const x = aufgabenEl[n];
        x.li.setAttribute("data-status", "geloest");
        x.marke.textContent = "✓";
        x.sr.textContent = " (gelöst)";
        const alle = geloest.every(Boolean);
        const titelText = x.li.querySelector(".psk-a-titel").textContent;
        ansage.textContent = "✓ Aufgabe " + (n + 1) + " gelöst: " + titelText + "." + (alle ? " Alle Aufgaben gelöst!" : "");
        el.dispatchEvent(new CustomEvent("lernpfad:aufgabe", { bubbles: true, detail: { index: n, titel: titelText, geloest: true, anzahlGeloest: geloest.filter(Boolean).length, gesamt: aufgaben.length, alleGeloest: alle } }));
      });
      standZeigen();
    }

    /* ---------- Ausgabe ---------- */
    const MAX_ZEILEN = 3000;
    const MAX_ZEICHEN = 400000;          // ganze Konsole
    const MAX_ZEICHEN_BEFEHL = 200000;   // Ausgabe eines Befehls
    const umbrueche = (t) => (t.match(/\n/g) || []).length;
    function ausgabeKuerzen(zeilen) {
      let rest = MAX_ZEICHEN_BEFEHL;
      for (let i = 0; i < zeilen.length; i++) {
        const z = zeilen[i];
        const laenge = z === "LEEREN" ? 0 : zeilenText(z).length + 1;
        if (laenge <= rest && i < MAX_ZEILEN) { rest -= laenge; continue; }
        const gekuerzt = zeilen.slice(0, i);
        // angebrochene Zeile kürzen statt ganz weglassen
        if (z !== "LEEREN" && rest > 0 && i < MAX_ZEILEN) {
          let r = rest;
          gekuerzt.push(z.map((t) => { const teil = t[0].slice(0, Math.max(r, 0)); r -= teil.length; return [teil, t[1]]; }));
        }
        gekuerzt.push([["… Ausgabe gekürzt (Simulator)", "warnung"]]);
        return gekuerzt;
      }
      return zeilen;
    }
    function zeilenAnzeigen(zeilen) {
      zeilenEinfuegen(pre, ausgabeKuerzen(zeilen));
      // Alte Zeilen begrenzen (nach Zeichen und nach Zeilen)
      const text = pre.textContent;
      let laenge = text.length, anzahl = umbrueche(text);
      if (laenge > MAX_ZEICHEN || anzahl > MAX_ZEILEN) {
        while (pre.firstChild && (laenge > MAX_ZEICHEN * 0.8 || anzahl > MAX_ZEILEN * 0.8)) {
          const t = pre.firstChild.textContent;
          laenge -= t.length;
          anzahl -= umbrueche(t);
          pre.removeChild(pre.firstChild);
        }
      }
      fenster.scrollTop = fenster.scrollHeight;
      fenster.scrollLeft = 0;
    }
    function echo(promptText, code) {
      if (pre.childNodes.length) pre.appendChild(DOC.createTextNode("\n"));
      pre.appendChild(erzeugen("span", "psk-prompt", promptText));
      tokensEinfuegen(pre, faerbeTokens(code), "psk-t-");
    }
    function gruppenAnzeigen(gruppen, abIndex) {
      let zeilen = [];
      gruppen.forEach((g) => {
        if (abIndex !== undefined && g.quelle !== -1 && g.quelle <= abIndex) return;
        g.zeilen.forEach((z) => {
          if (z === "LEEREN") { pre.textContent = ""; zeilen = []; return; }
          zeilen.push(z);
        });
      });
      zeilenAnzeigen(zeilen);
    }
    function promptSetzen() {
      if (rueck) prompt.textContent = "[Y/A/N/L/S]:";
      else if (puffer.length) prompt.textContent = ">>";
      else prompt.textContent = sitzung.prompt().trim();
      titelText.textContent = (admin ? "Administrator: " : "") + (cfg.titel || (skriptModus ? "PowerShell 7 · Skript" : "PowerShell 7"));
      adminMarke.hidden = !admin;
      if (bAdmin) bAdmin.textContent = admin ? "Ohne Adminrechte neu starten" : "Als Administrator neu starten";
    }

    /* ---------- Ausführen ---------- */
    function ausfuehrenCode(code, extra) {
      const zustand = sitzung.schnappschuss();
      const r = sitzung.zeile(code, { interaktiv: !skriptModus && !extra });
      if (r.unvollstaendig) return r;
      if (r.rueckfrage) {
        // Bis zur Rückfrage anzeigen, dann Antwort abwarten
        const n = r.strom.length;
        gruppenAnzeigen(r.gruppen.filter((g) => g.quelle !== -1));
        const fragen = r.rueckfrage.split("\n");
        zeilenAnzeigen(fragen.map((t, k) => [[t, k === 0 ? "kopf" : null]]).concat([[['[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"): ', null]]]));
        rueck = { code: code, antworten: [], gezeigt: n, zustand: zustand, extra: extra };
        sitzung.wiederherstellen(zustand);
        return r;
      }
      gruppenAnzeigen(r.gruppen);
      aufgabenPruefen(r, extra);
      return r;
    }

    function antwortGeben(text) {
      const a = text.trim();
      pre.appendChild(DOC.createTextNode(" " + a));
      if (a === "?") {
        zeilenAnzeigen([[["Y - Continue with only the next step of the operation.", null]], [["A - Continue with all the steps of the operation.", null]],
          [["N - Skip this operation and proceed with the next operation.", null]], [["L - Skip this operation and all subsequent operations.", null]],
          [["S - Pause the current pipeline and return to the command prompt. Type \"exit\" to resume the pipeline.", null]],
          [['[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"): ', null]]]);
        return;
      }
      const offen = rueck;
      offen.antworten.push(a);
      sitzung.wiederherstellen(offen.zustand);
      const zustand = sitzung.schnappschuss();
      const r = sitzung.zeile(offen.code, { antworten: offen.antworten, ohneVerlauf: true, datei: undefined });
      if (r.rueckfrage) {
        // Weitere Rückfrage: nur Neues bis dahin zeigen
        const n = r.strom.length;
        gruppenAnzeigen(r.gruppen.filter((g) => g.quelle !== -1), offen.gezeigt);
        const fragen = r.rueckfrage.split("\n");
        zeilenAnzeigen(fragen.map((t, k) => [[t, k === 0 ? "kopf" : null]]).concat([[['[Y] Yes  [A] Yes to All  [N] No  [L] No to All  [S] Suspend  [?] Help (default is "Y"): ', null]]]));
        rueck = { code: offen.code, antworten: offen.antworten, gezeigt: n, zustand: zustand, extra: offen.extra };
        sitzung.wiederherstellen(zustand);
        return;
      }
      rueck = null;
      gruppenAnzeigen(r.gruppen, offen.gezeigt);
      aufgabenPruefen(r, offen.extra);
    }

    function eingabeAusfuehren() {
      const text = eingabe.value;
      eingabe.value = "";
      tab = null;
      verlaufIndex = -1;
      if (rueck) { antwortGeben(text); promptSetzen(); return; }
      echo(puffer.length ? ">> " : sitzung.prompt(), text);
      if (puffer.length) {
        puffer.push(text);
        if (text.trim() === "") { const code = puffer.slice(0, -1).join("\n"); puffer = []; const r = sitzung.zeile(code, {}); gruppenAnzeigen(r.gruppen); aufgabenPruefen(r); promptSetzen(); return; }
      }
      const code = puffer.length ? puffer.join("\n") : text;
      if (!code.trim()) { puffer = []; promptSetzen(); fenster.scrollTop = fenster.scrollHeight; return; }
      const r = ausfuehrenCode(code);
      if (r.unvollstaendig) { if (!puffer.length) puffer.push(text); }
      else puffer = [];
      promptSetzen();
    }

    function skriptAusfuehren() {
      const text = editor.value.replace(/\r\n/g, "\n");
      sitzung.welt.dateiSchreiben(Welt.teileVon(sitzung.welt.home).concat([skriptName]), text.replace(/\n/g, "\r\n") + "\r\n", {});
      const aufruf = ".\\" + skriptName + (argFeld.value.trim() ? " " + argFeld.value.trim() : "");
      sitzung.i.orte.C = Welt.teileVon(sitzung.welt.home);
      sitzung.i.laufwerk = "C";
      echo(sitzung.prompt(), aufruf);
      ausfuehrenCode(aufruf, { skript: text, argumente: argFeld.value.trim() });
      promptSetzen();
    }

    /* ---------- Tastatur ---------- */
    eingabe.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); eingabeAusfuehren(); return; }
      if (e.key === "Escape") { if (eingabe.value || puffer.length) { e.preventDefault(); eingabe.value = ""; puffer = []; tab = null; promptSetzen(); } return; }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const v = sitzung.i.verlauf.map((h) => h.text);
        if (!v.length || rueck) return;
        e.preventDefault();
        if (verlaufIndex === -1) { entwurf = eingabe.value; verlaufIndex = v.length; }
        verlaufIndex += e.key === "ArrowUp" ? -1 : 1;
        if (verlaufIndex < 0) verlaufIndex = 0;
        if (verlaufIndex >= v.length) { verlaufIndex = -1; eingabe.value = entwurf; }
        else eingabe.value = v[verlaufIndex];
        const ende = eingabe.value.length;
        eingabe.setSelectionRange(ende, ende);
        return;
      }
      if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (!eingabe.value.trim() || rueck) return; // leere Zeile: Fokus darf weiterspringen
        e.preventDefault();
        if (!tab || eingabe.value !== tab.aktuell) {
          const cur = eingabe.selectionStart === null ? eingabe.value.length : eingabe.selectionStart;
          const v = sitzung.vervollstaendigen(eingabe.value, cur);
          if (!v.kandidaten.length) { tab = null; return; }
          tab = { basis: eingabe.value, start: v.start, ende: v.ende, kandidaten: v.kandidaten, index: e.shiftKey ? v.kandidaten.length - 1 : 0 };
        } else {
          tab.index = (tab.index + (e.shiftKey ? -1 : 1) + tab.kandidaten.length) % tab.kandidaten.length;
        }
        const k = tab.kandidaten[tab.index];
        eingabe.value = tab.basis.slice(0, tab.start) + k + tab.basis.slice(tab.ende);
        const pos = tab.start + k.length;
        eingabe.setSelectionRange(pos, pos);
        tab.aktuell = eingabe.value;
        ansage.textContent = tab.kandidaten.length > 1 ? k + " (" + (tab.index + 1) + " von " + tab.kandidaten.length + ")" : k;
        return;
      }
    });
    eingabe.addEventListener("input", () => { if (tab && eingabe.value !== tab.aktuell) tab = null; });
    fenster.addEventListener("click", () => {
      const sel = DOC.getSelection ? DOC.getSelection() : null;
      if (!skriptModus && (!sel || sel.isCollapsed)) eingabe.focus({ preventScroll: true });
    });
    if (bLos) {
      bLos.addEventListener("click", skriptAusfuehren);
      editor.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); skriptAusfuehren(); }
        // Tab bleibt absichtlich ohne Sonderfunktion: der Fokus verlässt den Editor (keine Tastaturfalle)
      });
      argFeld.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); skriptAusfuehren(); } });
    }

    /* ---------- Start, Zurücksetzen, Adminrechte ---------- */
    function starten(welt) {
      sitzung = new Sitzung({ umgebung: cfg.umgebung, admin: admin, welt: welt });
      puffer = [];
      rueck = null;
      pre.textContent = "";
      const kopfzeilen = cfg.begruessung === false ? [] : [[["PowerShell 7.6.1", null]], [["Simulator: Rechner von Lea (Gemeinde Wolkenried). Alles hier ist erfunden und harmlos.", "hinweis"]], [["", null]]];
      if (kopfzeilen.length) zeilenAnzeigen(kopfzeilen);
      (cfg.befehle || []).forEach((b) => {
        if (!skriptModus) echo(sitzung.prompt(), b);
        const r = sitzung.zeile(b, {});
        gruppenAnzeigen(r.gruppen);
      });
      promptSetzen();
    }
    bReset.addEventListener("click", () => {
      admin = !!cfg.admin;
      starten(null);
      if (skriptModus && cfg.skript !== undefined) editor.value = cfg.skript;
      ansage.textContent = "Der Rechner ist zurückgesetzt." + (aufgaben.length ? " Gelöste Aufgaben bleiben gelöst." : "");
      bReset.focus();
    });
    if (bAdmin) bAdmin.addEventListener("click", () => {
      admin = !admin;
      const welt = sitzung.welt;
      welt.admin = admin;
      starten(welt);
      ansage.textContent = admin ? "Neue Konsole mit Adminrechten gestartet." : "Neue Konsole ohne Adminrechte gestartet.";
      bAdmin.focus();
    });

    starten(null);
    standZeigen();

    return {
      ausfuehren(code) {
        if (skriptModus) { editor.value = code; skriptAusfuehren(); return; }
        echo(sitzung.prompt(), code);
        ausfuehrenCode(String(code));
        promptSetzen();
      },
      zuruecksetzen() { bReset.click(); },
      get sitzung() { return sitzung; },
      eingabe: skriptModus ? editor : eingabe,
      aufgabenStand: () => geloest.slice(),
    };
  }

  function browserStarten(win, doc) {
    DOC = doc;
    const api = Object.assign(konsole, { ausfuehren: ausfuehren, sitzung: sitzungFuer });
    let angehaengt = false;
    const anhaengen = () => {
      if (angehaengt) return true;
      const L = win.Lernpfad;
      if (!L) return false;
      L.konsole = api;
      L.psFaerben = psFaerben;
      L.ps = { version: PS_VERSION, Sitzung: Sitzung };
      angehaengt = true;
      return true;
    };
    if (!anhaengen()) {
      console.error("[Lernpfad] ps-konsole.js: window.Lernpfad fehlt. Binde ps-konsole.js nach lernpfad.js ein.");
    }
    const lauf = () => {
      anhaengen();
      try { psFaerben(doc.body); ausgabenFuellen(doc.body); } catch (e) { console.error("[Lernpfad] ps-konsole:", e); }
      // Neu eingefügte Codeblöcke (Filme, Stepper, Selbsttest) ebenfalls färben
      if (win.MutationObserver) {
        let geplant = false;
        new win.MutationObserver(() => {
          if (geplant) return;
          geplant = true;
          Promise.resolve().then(() => { geplant = false; psFaerben(doc.body); ausgabenFuellen(doc.body); });
        }).observe(doc.body, { childList: true, subtree: true });
      }
    };
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", lauf);
    else lauf();
  }

  const PS_VERSION = "1.0.0";

  return {
    version: PS_VERSION,
    Sitzung: Sitzung,
    ausfuehren: ausfuehren,
    sitzung: sitzungFuer,
    faerbeTokens: faerbeTokens,
    parsen: parsen,
    Lexer: Lexer,
    formatieren: formatieren,
    LEA: LEA,
    CMDLETS: CMDLETS,
    ALIASE: ALIASE,
    _intern: { textVon: textVon, zahlText: zahlText, datumFormat: datumFormat, zahlFormat: zahlFormat, PSDatum: PSDatum, Welt: Welt },
    _browserStarten: browserStarten,
  };
});
