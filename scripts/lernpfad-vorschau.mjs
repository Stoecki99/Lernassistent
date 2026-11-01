#!/usr/bin/env node
// Lokale Vorschau der Lernpfad-Themenseiten ohne App und ohne Login.
// Nur für die Entwicklung: hört ausschliesslich auf 127.0.0.1, nur eingebaute Node-Module.
//
// Aufruf:  node scripts/lernpfad-vorschau.mjs --port 3301
//
// Liefert:
//   /                              Liste aller Fächer und Seiten
//   /lernseiten/<fach>             einfache Stationenliste (Ersatz für die Lernpfad-Seite der App)
//   /lernseiten/<fach>/<slug>      content/lernseiten/<fach>/<slug>.html
//   /lernpfad/*                    Dateien aus public/lernpfad/
//   /api/lernfortschritt           Attrappe: GET → [], POST → {ok:true}
//   /api/spielstand                Attrappe im Speicher (Bestwert wie die App, keine Punkte, kein Login)

import http from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LERNPFAD = path.join(WURZEL, "public", "lernpfad");
const INHALT = path.join(WURZEL, "content", "lernseiten");

const FACH_MUSTER = /^[a-z0-9]+$/;
// Stationen «NN-name», dazu Hilfsseiten mit «_» (z. B. _vorlage) für die Vorschau
const SLUG_MUSTER = /^_?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_KOERPER = 16 * 1024;

const TYPEN = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

function portLesen() {
  const args = process.argv.slice(2);
  const i = args.findIndex((a) => a === "--port" || a.startsWith("--port="));
  let roh = "3301";
  if (i >= 0) roh = args[i].includes("=") ? args[i].split("=")[1] : args[i + 1];
  const port = Number(roh);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Ungültiger Port: ${roh}. Beispiel: node scripts/lernpfad-vorschau.mjs --port 3301`);
    process.exit(1);
  }
  return port;
}

function senden(res, status, typ, inhalt, nurKopf) {
  res.writeHead(status, {
    "Content-Type": typ,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(nurKopf ? undefined : inhalt);
}

function nichtGefunden(res, nurKopf) {
  senden(res, 404, TYPEN[".txt"], "Nicht gefunden.", nurKopf);
}

const html = (s) => String(s).replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);

function rahmen(titel, inhalt) {
  return `<!doctype html>
<html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(titel)}</title><link rel="stylesheet" href="/lernpfad/lernpfad.css"></head>
<body><div class="wrap stack"><span class="eyebrow">Lernpfad-Vorschau · nur lokal</span><h1>${html(titel)}</h1>${inhalt}</div></body></html>`;
}

async function faecherLesen() {
  try {
    const eintraege = await readdir(INHALT, { withFileTypes: true });
    return eintraege.filter((e) => e.isDirectory() && FACH_MUSTER.test(e.name)).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

async function seitenLesen(fach) {
  try {
    const dateien = await readdir(path.join(INHALT, fach));
    return dateien
      .filter((d) => d.endsWith(".html") && SLUG_MUSTER.test(d.slice(0, -5)))
      .map((d) => d.slice(0, -5))
      .sort();
  } catch {
    return [];
  }
}

async function fachTitel(fach) {
  try {
    const daten = JSON.parse(await readFile(path.join(INHALT, fach, "fach.json"), "utf8"));
    return typeof daten.titel === "string" ? daten.titel : fach.toUpperCase();
  } catch {
    return fach.toUpperCase();
  }
}

function seitenListe(fach, seiten) {
  if (!seiten.length) return '<p class="hint">Noch keine HTML-Seiten.</p>';
  const stationen = seiten.filter((s) => !s.startsWith("_"));
  const hilfen = seiten.filter((s) => s.startsWith("_"));
  const li = (s) => `<li><a href="/lernseiten/${fach}/${s}">${html(s)}</a></li>`;
  return (
    (stationen.length ? `<h3>Stationen</h3><ol>${stationen.map(li).join("")}</ol>` : "") +
    (hilfen.length ? `<h3>Hilfsseiten (keine Stationen)</h3><ul>${hilfen.map(li).join("")}</ul>` : "")
  );
}

async function startseite(res, nurKopf) {
  const faecher = await faecherLesen();
  let inhalt = "";
  for (const fach of faecher) {
    inhalt += `<section class="card stack"><h2><a href="/lernseiten/${fach}">${html(await fachTitel(fach))}</a></h2>${seitenListe(fach, await seitenLesen(fach))}</section>`;
  }
  senden(res, 200, TYPEN[".html"], rahmen("Lernseiten", inhalt || '<p class="hint">Keine Fächer gefunden.</p>'), nurKopf);
}

async function fachseite(res, fach, nurKopf) {
  if (!FACH_MUSTER.test(fach) || !(await faecherLesen()).includes(fach)) return nichtGefunden(res, nurKopf);
  const inhalt = `<p class="lead">Ersatz für die Lernpfad-Seite der App. Fortschritt wird in der Vorschau nicht gespeichert.</p>
<div class="card stack">${seitenListe(fach, await seitenLesen(fach))}</div><p><a href="/">← Alle Fächer</a></p>`;
  senden(res, 200, TYPEN[".html"], rahmen(`Lernpfad ${await fachTitel(fach)}`, inhalt), nurKopf);
}

async function themenseite(res, fach, slug, nurKopf) {
  if (!FACH_MUSTER.test(fach) || !SLUG_MUSTER.test(slug)) return nichtGefunden(res, nurKopf);
  try {
    const inhalt = await readFile(path.join(INHALT, fach, `${slug}.html`));
    senden(res, 200, TYPEN[".html"], inhalt, nurKopf);
  } catch {
    nichtGefunden(res, nurKopf);
  }
}

async function statisch(res, relativ, nurKopf) {
  let teil;
  try {
    teil = decodeURIComponent(relativ);
  } catch {
    return nichtGefunden(res, nurKopf);
  }
  // Kein Pfad-Traversal: keine leeren, «.»- oder «..»-Segmente, keine Backslashes, keine Nullbytes
  if (!teil || teil.includes("\0") || teil.includes("\\") || teil.split("/").some((s) => s === "" || s === "." || s === "..")) {
    return nichtGefunden(res, nurKopf);
  }
  const datei = path.resolve(LERNPFAD, teil);
  if (!datei.startsWith(LERNPFAD + path.sep)) return nichtGefunden(res, nurKopf);
  const typ = TYPEN[path.extname(datei).toLowerCase()];
  if (!typ) return nichtGefunden(res, nurKopf);
  try {
    if (!(await stat(datei)).isFile()) return nichtGefunden(res, nurKopf);
    senden(res, 200, typ, await readFile(datei), nurKopf);
  } catch {
    nichtGefunden(res, nurKopf);
  }
}

function koerperLesen(req) {
  return new Promise((ok, fehler) => {
    let laenge = 0;
    const teile = [];
    req.on("data", (stueck) => {
      laenge += stueck.length;
      if (laenge > MAX_KOERPER) {
        fehler(new Error("zu gross"));
        req.destroy();
        return;
      }
      teile.push(stueck);
    });
    req.on("end", () => ok(Buffer.concat(teile).toString("utf8")));
    req.on("error", fehler);
  });
}

async function fortschrittAttrappe(req, res) {
  const json = TYPEN[".json"];
  if (req.method === "GET" || req.method === "HEAD") return senden(res, 200, json, "[]", req.method === "HEAD");
  if (req.method !== "POST") return senden(res, 405, json, JSON.stringify({ error: "Methode nicht erlaubt" }));
  try {
    const daten = JSON.parse(await koerperLesen(req));
    const quiz = Number.isInteger(daten.quizGesamt) ? ` (Selbsttest ${daten.quizRichtig}/${daten.quizGesamt})` : "";
    console.log(`[vorschau] Fortschritt: ${daten.fach}/${daten.thema} → ${daten.status}${quiz}`);
    senden(res, 200, json, JSON.stringify({ ok: true }));
  } catch {
    senden(res, 400, json, JSON.stringify({ error: "Ungültige Anfrage" }));
  }
}

// Bestwerte der Modellierspiele nur im Speicher, bis die Vorschau beendet wird
const spielstaende = new Map();

async function spielstandAttrappe(req, res, url) {
  const json = TYPEN[".json"];
  if (req.method === "GET" || req.method === "HEAD") {
    const fach = url.searchParams.get("fach") || "";
    const liste = [...spielstaende.values()].filter((eintrag) => eintrag.fach === fach).map(({ fach: _fach, ...rest }) => rest);
    return senden(res, 200, json, JSON.stringify(liste), req.method === "HEAD");
  }
  if (req.method !== "POST") return senden(res, 405, json, JSON.stringify({ error: "Methode nicht erlaubt" }));
  try {
    const { fach, spiel, level, sterne, xp } = JSON.parse(await koerperLesen(req));
    if (![fach, spiel, level].every((wert) => typeof wert === "string") || !Number.isInteger(sterne) || !Number.isInteger(xp)) {
      return senden(res, 400, json, JSON.stringify({ error: "Ungültige Anfrage" }));
    }
    const schluessel = `${fach}/${spiel}/${level}`;
    const alt = spielstaende.get(schluessel);
    const verbessert = !alt || sterne > alt.sterne || (sterne === alt.sterne && xp > alt.xp);
    if (verbessert) spielstaende.set(schluessel, { fach, spiel, level, sterne, xp, aktualisiert: new Date().toISOString() });
    console.log(`[vorschau] Spielstand: ${schluessel} → ${sterne} Sterne, ${xp} XP${verbessert ? " (Bestwert)" : ""}`);
    senden(res, 200, json, JSON.stringify({ ok: true, verbessert, punkte: 0, abzeichen: [] }));
  } catch {
    senden(res, 400, json, JSON.stringify({ error: "Ungültige Anfrage" }));
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pfad = url.pathname;
    const nurKopf = req.method === "HEAD";

    if (pfad === "/api/lernfortschritt") return await fortschrittAttrappe(req, res);
    if (pfad === "/api/spielstand") return await spielstandAttrappe(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return senden(res, 405, TYPEN[".txt"], "Methode nicht erlaubt.");

    if (pfad === "/") return await startseite(res, nurKopf);
    if (pfad === "/favicon.ico") {
      res.writeHead(204);
      return res.end();
    }
    if (pfad.startsWith("/lernpfad/")) return await statisch(res, pfad.slice("/lernpfad/".length), nurKopf);

    const teile = pfad.split("/").filter(Boolean);
    if (teile[0] === "lernseiten" && teile.length === 2) return await fachseite(res, teile[1], nurKopf);
    if (teile[0] === "lernseiten" && teile.length === 3) return await themenseite(res, teile[1], teile[2], nurKopf);
    return nichtGefunden(res, nurKopf);
  } catch (fehler) {
    console.error("[vorschau]", fehler);
    if (!res.headersSent) senden(res, 500, TYPEN[".txt"], "Interner Fehler.");
    else res.end();
  }
});

const port = portLesen();
server.on("error", (fehler) => {
  if (fehler.code === "EADDRINUSE") console.error(`Port ${port} ist belegt. Wähle einen anderen mit --port.`);
  else console.error("[vorschau]", fehler.message);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => {
  console.log(`Lernpfad-Vorschau läuft: http://127.0.0.1:${port}/`);
  console.log(`Beispiel: http://127.0.0.1:${port}/lernseiten/mstw/_vorlage`);
});

const beenden = () => server.close(() => process.exit(0));
process.on("SIGINT", beenden);
process.on("SIGTERM", beenden);
