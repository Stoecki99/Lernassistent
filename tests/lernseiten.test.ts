// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/lernseiten.test.ts
// Tests fuer Loader, Pfad-Traversal und Inhaltspruefung des Lernpfads.
// Ausfuehren: npm test

import { test, describe, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fachSchema } from "@/lib/validations/lernseite"
import { ladeFaecher, ladeFach, ladeThemaHtml } from "@/lib/lernseiten"
import {
  pruefeAlleInhalte,
  pruefeThemaHtml,
  pruefeNaechsteStation,
  ohneJsKommentare,
  appSeiten,
  publicNamen,
  reservierteNamen,
} from "@/lib/lernseiten-pruefung"

// ---------------------------------------------------------------------------
// Testdaten
// ---------------------------------------------------------------------------

function station(slug: string, sektion = "s1") {
  return { slug, titel: `Titel ${slug}`, sektion, vorlesung: "V1", dauer_min: 30, kurz: "Kurzbeschreibung" }
}

function fach(kuerzel = "TEST", pfad = [station("01-erstes"), station("02-zweites"), station("03-drittes", "s2")]) {
  return {
    kuerzel,
    titel: "Testfach",
    beschreibung: "Beschreibung",
    icon: "T",
    farbe: "#123456",
    semester: "HS26",
    sektionen: [
      { id: "s1", titel: "Sektion 1" },
      { id: "s2", titel: "Sektion 2" },
    ],
    pfad,
  }
}

interface SeitenOptionen {
  doctype?: string
  lang?: string
  theme?: string
  kopf?: string
  css?: string
  bodyAttribute?: string
  inhalt?: string
  js?: string
  skript?: string
}

/** Theme-Startskript wie in content/lernseiten/mstw/_vorlage.html */
const THEMA_START =
  '<script>(function(){try{var w=window.localStorage.getItem("lernpfad-theme"),r=document.documentElement;' +
  'if(w==="hell")r.setAttribute("data-theme","light");else if(w==="dunkel")r.setAttribute("data-theme","dark");}catch(e){}})();</script>'

/** Gueltige Themenseite nach Pflicht-Geruest; einzelne Teile lassen sich ersetzen. */
function seite(fachSlug: string, slug: string, o: SeitenOptionen = {}) {
  return `${o.doctype ?? "<!doctype html>"}
<html lang="${o.lang ?? "de-CH"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Titel ${slug}</title>
${o.theme ?? THEMA_START}
${o.css ?? '<link rel="stylesheet" href="/lernpfad/lernpfad.css">'}
${o.kopf ?? ""}
</head>
<body ${o.bodyAttribute ?? `data-fach="${fachSlug}" data-thema="${slug}"`}>
<main><h1>Titel</h1>${o.inhalt ?? ""}</main>
${o.js ?? '<script src="/lernpfad/lernpfad.js"></script>'}
<script>${o.skript ?? "document.title = document.title"}</script>
</body>
</html>
`
}

/** <link rel="next"> auf die Station nach `slug` im Testfach (leer bei der letzten). */
function naechsterLink(slug: string, pfad = fach().pfad) {
  const naechste = pfad[pfad.findIndex((s) => s.slug === slug) + 1]
  return naechste ? `<link rel="next" href="/lernseiten/test/${naechste.slug}" title="${naechste.titel}">` : ""
}

let basis: string

function schreibe(datei: string, inhalt: unknown) {
  const ziel = path.join(basis, datei)
  fs.mkdirSync(path.dirname(ziel), { recursive: true })
  fs.writeFileSync(ziel, typeof inhalt === "string" ? inhalt : JSON.stringify(inhalt))
}

/** Fach «test» mit fach.json und Themenseiten fuer die genannten Slugs. */
function testfach(slugs = ["01-erstes", "02-zweites"]) {
  schreibe("test/fach.json", fach())
  for (const slug of slugs) schreibe(`test/${slug}.html`, seite("test", slug, { kopf: naechsterLink(slug) }))
}

function fehlerText(ergebnis = pruefeAlleInhalte(basis, [])) {
  return ergebnis.fehler.join("\n")
}

beforeEach(() => {
  basis = fs.mkdtempSync(path.join(os.tmpdir(), "lernpfad-"))
})

afterEach(() => {
  fs.rmSync(basis, { recursive: true, force: true })
})

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

describe("fach.json-Schema", () => {
  test("gueltiges Fach", () => {
    assert.equal(fachSchema.safeParse(fach()).success, true)
  })

  test("meldet doppelte Slugs", () => {
    const ergebnis = fachSchema.safeParse(fach("TEST", [station("01-a"), station("01-a")]))
    assert.equal(ergebnis.success, false)
    assert.match(JSON.stringify(ergebnis.error?.issues), /doppelt/)
  })

  test("meldet unbekannte Sektion einer Station", () => {
    const ergebnis = fachSchema.safeParse(fach("TEST", [station("01-a", "s9")]))
    assert.equal(ergebnis.success, false)
    assert.match(JSON.stringify(ergebnis.error?.issues), /Sektion «s9»/)
  })

  test("Slugs muessen «NN-name» heissen", () => {
    for (const slug of ["1-a", "01_a", "01-A", "01-", "01--a", "01-a-", "a-01", "001-a", "01-ä"]) {
      assert.equal(fachSchema.safeParse(fach("TEST", [station(slug)])).success, false, slug)
    }
    assert.equal(fachSchema.safeParse(fach("TEST", [station("08-laplace-bedingte-2")])).success, true)
  })

  test("unbekannte Felder werden gemeldet (Tippfehler)", () => {
    const daten = fach("TEST", [{ ...station("01-a"), dauer: 5 } as never])
    assert.equal(fachSchema.safeParse(daten).success, false)
  })

  test("leerer Pfad ist ungueltig", () => {
    assert.equal(fachSchema.safeParse(fach("TEST", [])).success, false)
  })
})

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

describe("Loader", () => {
  test("Faecher zaehlen nur Stationen mit HTML-Datei", () => {
    testfach(["01-erstes", "03-drittes"])
    const faecher = ladeFaecher(basis)
    assert.equal(faecher.length, 1)
    assert.equal(faecher[0].slug, "test")
    assert.equal(faecher[0].anzahlThemen, 2)
    assert.equal(faecher[0].anzahlStationen, 3)
    assert.equal("pfad" in faecher[0], false)
  })

  test("Pfad in der Reihenfolge von fach.json mit Verfuegbarkeit", () => {
    testfach(["02-zweites"])
    const ergebnis = ladeFach("test", basis)
    assert.ok(ergebnis)
    assert.deepEqual(
      ergebnis.pfad.map((s) => [s.slug, s.verfuegbar]),
      [
        ["01-erstes", false],
        ["02-zweites", true],
        ["03-drittes", false],
      ],
    )
    assert.equal(ergebnis.fach.kuerzel, "TEST")
    assert.equal(ergebnis.fach.anzahlThemen, 1)
  })

  test("Gross-/Kleinschreibung des Fachs spielt keine Rolle", () => {
    testfach()
    assert.ok(ladeFach("TEST", basis))
    assert.ok(ladeThemaHtml("Test", "01-erstes", basis))
  })

  test("liefert das HTML einer Station", () => {
    testfach()
    assert.equal(ladeThemaHtml("test", "01-erstes", basis), seite("test", "01-erstes", { kopf: naechsterLink("01-erstes") }))
  })

  test("unbekanntes Fach, unbekannte Station oder fehlende Datei ergeben null", () => {
    testfach()
    assert.equal(ladeFach("gibtsnicht", basis), null)
    assert.equal(ladeThemaHtml("gibtsnicht", "01-erstes", basis), null)
    assert.equal(ladeThemaHtml("test", "99-nichts", basis), null)
    // Station im Pfad, aber noch ohne Datei («folgt»)
    assert.equal(ladeThemaHtml("test", "03-drittes", basis), null)
  })

  test("Dateien ausserhalb des Pfads werden nicht ausgeliefert", () => {
    testfach()
    schreibe("test/09-geheim.html", seite("test", "09-geheim"))
    schreibe("test/_vorlage.html", seite("test", "_vorlage"))
    assert.equal(ladeThemaHtml("test", "09-geheim", basis), null)
    assert.equal(ladeThemaHtml("test", "_vorlage", basis), null)
  })

  test("ungueltige fach.json wirft mit Dateiname", () => {
    schreibe("test/fach.json", { kuerzel: "TEST" })
    assert.throws(() => ladeFach("test", basis), /test\/fach\.json/)
  })
})

describe("Pfad-Traversal", () => {
  test("Adressen mit ../, Trennzeichen oder Endungen werden abgewiesen", () => {
    testfach()
    // Datei ausserhalb des Fachordners, die nie erreichbar sein darf
    schreibe("geheim.html", "geheim")

    for (const f of ["../test", "test/..", "..", ".", "", "test\\..", "te st", "test\0"]) {
      assert.equal(ladeFach(f, basis), null, `Fach «${f}»`)
      assert.equal(ladeThemaHtml(f, "01-erstes", basis), null, `Fach «${f}»`)
    }

    const themen = [
      "../geheim",
      "../../geheim",
      "01-erstes/../../geheim",
      "01-erstes.html",
      "01-erstes/",
      "..\\geheim",
      "01-erstes\\..\\..\\geheim",
      "%2e%2e%2fgeheim",
      "01-erstes\0",
      "/etc/passwd",
      "C:\\Windows\\win.ini",
      "fach",
      "fach.json",
    ]
    for (const t of themen) {
      assert.equal(ladeThemaHtml("test", t, basis), null, `Thema «${t}»`)
    }
  })
})

// ---------------------------------------------------------------------------
// Pruefung einzelner Seiten
// ---------------------------------------------------------------------------

describe("Pflicht-Geruest einer Themenseite", () => {
  const pruefe = (o: SeitenOptionen) => pruefeThemaHtml(seite("test", "01-erstes", o), "test", "01-erstes").join("\n")

  test("gueltige Seite ergibt keine Fehler", () => {
    assert.deepEqual(pruefeThemaHtml(seite("test", "01-erstes"), "test", "01-erstes"), [])
  })

  test("Grossschreibung von doctype und Versionsanhang an CSS/JS sind erlaubt", () => {
    const html = seite("test", "01-erstes", {
      doctype: "<!DOCTYPE html>",
      css: '<link href="/lernpfad/lernpfad.css?v=2" rel="stylesheet">',
      js: "<script src='/lernpfad/lernpfad.js?v=2' defer></script>",
    })
    assert.deepEqual(pruefeThemaHtml(html, "test", "01-erstes"), [])
  })

  test("meldet fehlendes doctype, lang, charset, viewport und title", () => {
    const html = seite("test", "01-erstes", { doctype: "", lang: "de" })
      .replace('<meta charset="utf-8">', "")
      .replace(/<meta name="viewport"[^>]*>/, "")
      .replace(/<title>[^<]*<\/title>/, "<title> </title>")
    const fehler = pruefeThemaHtml(html, "test", "01-erstes").join("\n")
    assert.match(fehler, /doctype/)
    assert.match(fehler, /lang="de-CH"/)
    assert.match(fehler, /charset/)
    assert.match(fehler, /viewport/)
    assert.match(fehler, /<title>/)
  })

  test("meldet fehlendes lernpfad.css und lernpfad.js", () => {
    assert.match(pruefe({ css: "" }), /lernpfad\.css/)
    assert.match(pruefe({ css: '<link rel="stylesheet" href="/anders.css">' }), /lernpfad\.css/)
    assert.match(pruefe({ js: "" }), /lernpfad\.js/)
  })

  test("auskommentierte Pflichtteile zaehlen nicht", () => {
    assert.match(pruefe({ js: '<!-- <script src="/lernpfad/lernpfad.js"></script> -->' }), /lernpfad\.js/)
  })

  test("Erweiterung PS: ps-konsole.css und ps-konsole.js aus /lernpfad/ sind erlaubt", () => {
    const html = seite("test", "01-erstes", {
      css: '<link rel="stylesheet" href="/lernpfad/lernpfad.css">\n<link rel="stylesheet" href="/lernpfad/ps-konsole.css">',
      js: '<script src="/lernpfad/lernpfad.js"></script>\n<script src="/lernpfad/ps-konsole.js"></script>',
    })
    assert.deepEqual(pruefeThemaHtml(html, "test", "01-erstes"), [])
  })

  test("Erweiterung PS: ps-konsole.js vor lernpfad.js ist ein Fehler", () => {
    const fehler = pruefe({ js: '<script src="/lernpfad/ps-konsole.js"></script>\n<script src="/lernpfad/lernpfad.js"></script>' })
    assert.match(fehler, /ps-konsole\.js"> gehört nach <script src="\/lernpfad\/lernpfad\.js">/)
  })

  test("Erweiterung PS: ps-konsole.css vor lernpfad.css ist ein Fehler", () => {
    const fehler = pruefe({ css: '<link rel="stylesheet" href="/lernpfad/ps-konsole.css">\n<link rel="stylesheet" href="/lernpfad/lernpfad.css">' })
    assert.match(fehler, /ps-konsole\.css"> gehört nach <link rel="stylesheet" href="\/lernpfad\/lernpfad\.css">/)
  })

  test("Erweiterung PS: ps-konsole.css ersetzt lernpfad.css nicht", () => {
    assert.match(pruefe({ css: '<link rel="stylesheet" href="/lernpfad/ps-konsole.css">' }), /lernpfad\.css/)
  })

  test("Erweiterung PS: ps-konsole.js von einem fremden Server ist eine externe Ressource", () => {
    const fehler = pruefe({ js: '<script src="/lernpfad/lernpfad.js"></script>\n<script src="https://cdn.example.org/ps-konsole.js"></script>' })
    assert.match(fehler, /externe Ressource <script src="https:\/\/cdn\.example\.org\/ps-konsole\.js">/)
  })

  test("Erweiterung AVSW: architektur.css und architektur.js aus /lernpfad/ sind erlaubt", () => {
    const html = seite("test", "01-erstes", {
      css: '<link rel="stylesheet" href="/lernpfad/lernpfad.css">\n<link rel="stylesheet" href="/lernpfad/architektur.css">',
      js: '<script src="/lernpfad/lernpfad.js"></script>\n<script src="/lernpfad/architektur.js"></script>',
    })
    assert.deepEqual(pruefeThemaHtml(html, "test", "01-erstes"), [])
  })

  test("Erweiterung AVSW: architektur.js vor lernpfad.js ist ein Fehler", () => {
    const fehler = pruefe({ js: '<script src="/lernpfad/architektur.js"></script>\n<script src="/lernpfad/lernpfad.js"></script>' })
    assert.match(fehler, /architektur\.js"> gehört nach <script src="\/lernpfad\/lernpfad\.js">/)
  })

  test("Erweiterung AVSW: architektur.css vor lernpfad.css ist ein Fehler", () => {
    const fehler = pruefe({ css: '<link rel="stylesheet" href="/lernpfad/architektur.css">\n<link rel="stylesheet" href="/lernpfad/lernpfad.css">' })
    assert.match(fehler, /architektur\.css"> gehört nach <link rel="stylesheet" href="\/lernpfad\/lernpfad\.css">/)
  })

  test("Erweiterung AVSW: architektur.css ersetzt lernpfad.css nicht, architektur.js nicht lernpfad.js", () => {
    assert.match(pruefe({ css: '<link rel="stylesheet" href="/lernpfad/architektur.css">' }), /lernpfad\.css/)
    assert.match(pruefe({ js: '<script src="/lernpfad/architektur.js"></script>' }), /lernpfad\.js/)
  })

  test("Erweiterung AVSW: auskommentiertes architektur.js zaehlt nicht", () => {
    const html = seite("test", "01-erstes", {
      js: '<!-- <script src="/lernpfad/architektur.js"></script> -->\n<script src="/lernpfad/lernpfad.js"></script>',
    })
    assert.deepEqual(pruefeThemaHtml(html, "test", "01-erstes"), [])
  })

  test("Erweiterung AVSW: architektur.js von einem fremden Server ist eine externe Ressource", () => {
    const fehler = pruefe({ js: '<script src="/lernpfad/lernpfad.js"></script>\n<script src="https://cdn.example.org/architektur.js"></script>' })
    assert.match(fehler, /externe Ressource <script src="https:\/\/cdn\.example\.org\/architektur\.js">/)
  })

  test("lernpfad.js gehoert ans Ende von <body>", () => {
    const fehler = pruefe({ js: "", kopf: '<script src="/lernpfad/lernpfad.js"></script>' })
    assert.match(fehler, /Ende von <body>/)
  })

  test("Theme-Startskript gehoert in den <head>", () => {
    assert.match(pruefe({ theme: "" }), /Theme-Startskript/)
    // im <body> zu spaet (Flackern), mit src kein Inline-Script, auskommentiert zaehlt nicht
    assert.match(pruefe({ theme: "", inhalt: THEMA_START }), /Theme-Startskript/)
    assert.match(pruefe({ theme: '<script src="/lernpfad/theme.js">/* lernpfad-theme data-theme */</script>' }), /Theme-Startskript/)
    assert.match(pruefe({ theme: `<!-- ${THEMA_START} -->` }), /Theme-Startskript/)
  })

  test("data-fach und data-thema muessen zum Dateinamen passen", () => {
    assert.match(pruefe({ bodyAttribute: 'data-fach="test" data-thema="02-zweites"' }), /data-thema="01-erstes"/)
    assert.match(pruefe({ bodyAttribute: 'data-fach="mstw" data-thema="01-erstes"' }), /data-fach="test"/)
    assert.match(pruefe({ bodyAttribute: "" }), /gefunden: nichts/)
  })

  test("meldet externe Ressourcen", () => {
    const faelle = [
      { kopf: '<script src="https://cdn.example.com/x.js"></script>' },
      { kopf: '<link rel="stylesheet" href="//fonts.example.com/css">' },
      { kopf: '<link rel="preconnect" href="https://fonts.gstatic.com">' },
      { inhalt: '<img src="http://example.com/bild.png" alt="">' },
      { inhalt: '<img srcset="/a.png 1x, https://example.com/b.png 2x" alt="">' },
      { inhalt: '<iframe src="https://www.youtube.com/embed/x"></iframe>' },
      { inhalt: '<video poster="https://example.com/p.jpg"></video>' },
      { inhalt: '<svg><image href="https://example.com/x.svg"/></svg>' },
      { kopf: "<style>@import 'https://example.com/a.css';</style>" },
      { kopf: "<style>body { background: url(https://example.com/x.png) }</style>" },
      { kopf: '<style>@font-face { src: url("//example.com/f.woff2") }</style>' },
      { inhalt: '<div style="background-image: url(\'https://example.com/x.png\')"></div>' },
      { kopf: '<base href="https://example.com/">' },
    ]
    for (const fall of faelle) {
      assert.match(pruefe(fall), /extern/, JSON.stringify(fall))
    }
  })

  test("meldet externe Adressen in Inline-Scripts", () => {
    const faelle = [
      'fetch("https://api.example.com/daten")',
      "fetch( 'http://example.com/x' ).then((r) => r.json())",
      "import('//cdn.example.com/modul.js')",
      'import confetti from "https://cdn.example.com/confetti.mjs"',
      'const s = document.createElement("script"); s.src = "https://cdn.example.com/x.js"',
      'bild.setAttribute("src", "//bilder.example.com/a.png")',
      'const ws = new WebSocket("wss://live.example.com/kanal")',
      'xhr.open("GET", "https://example.com/daten.json")',
      "navigator.sendBeacon(`https://log.example.com/`, daten)",
      'el.style.backgroundImage = "url(https://example.com/x.png)"',
      // nach einem Regex-Literal mit Anfuehrungszeichen weiterhin erkannt
      "const r = /[\"']/g; fetch('https://example.com/a')",
      // in einem Template-String mit verschachteltem Template
      "const t = `${a ? `x` : `y`}`; fetch(`https://example.com/${t}`)",
    ]
    for (const skript of faelle) {
      assert.match(pruefe({ skript }), /externe Adresse in einem Inline-Script/, skript)
    }
  })

  test("Adressen in Kommentaren, Texten und Namensraeumen sind keine Ladeaufrufe", () => {
    const skript = [
      '// fetch("https://example.com/alt") — frueher so geladen',
      "/* import('https://cdn.example.com/x.js') */",
      'const NS = "http://www.w3.org/2000/svg";',
      'const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");',
      'hinweis.textContent = "Mehr dazu unter https://www.ost.ch (Quelle)";',
      'link.href = "https://www.ost.ch/de/studium";',
      "const pfad = 'a' + '//' + 'b'; // Text, keine Adresse",
      "const u = new URL('https://example.com/a');",
      "fetch('/api/lernfortschritt?fach=mstw')",
      "const halb = breite / 2; const r = /\\/\\/x/.test(halb); // fetch('https://x.example.com')",
    ].join("\n")
    assert.equal(pruefe({ skript }), "")
  })

  test("Kommentar-Entferner laesst Strings, Templates und Regex stehen", () => {
    assert.equal(ohneJsKommentare('a = "https://x.y"; // weg'), 'a = "https://x.y"; ')
    assert.equal(ohneJsKommentare("a /* weg */ + b"), "a   + b")
    assert.equal(ohneJsKommentare("t = `//${x /* weg */}//`"), "t = `//${x  }//`")
    assert.equal(ohneJsKommentare("r = /\\/\\//g // weg"), "r = /\\/\\//g ")
    assert.equal(ohneJsKommentare("q = a / b // weg"), "q = a / b ")
  })

  test("Links, eigene Pfade und data-URIs sind erlaubt", () => {
    const fehler = pruefe({
      kopf: "<style>@font-face { src: url(/lernpfad/fonts/x.woff2) } .a { background: url(data:image/png;base64,AA==) }</style>",
      inhalt:
        '<a href="https://www.ost.ch">Quelle</a><img src="data:image/svg+xml;base64,AA==" alt="">' +
        '<img src="/lernpfad/bild.svg" alt=""><svg><use href="#symbol"/></svg>',
    })
    assert.equal(fehler, "")
  })
})

describe("<link rel=\"next\"> passt zum Pfad", () => {
  const pfad = fach().pfad
  const pruefe = (slug: string, kopf: string) =>
    pruefeNaechsteStation(seite("test", slug, { kopf }), "test", pfad[pfad.findIndex((s) => s.slug === slug) + 1] ?? null)

  test("richtiger Link ergibt keine Fehler, letzte Station ohne Link auch nicht", () => {
    assert.deepEqual(pruefe("01-erstes", naechsterLink("01-erstes")), [])
    assert.deepEqual(pruefe("03-drittes", ""), [])
  })

  test("Reihenfolge der Attribute und Zeichenreferenzen im Titel sind egal", () => {
    const anders = fach("TEST", [station("01-a"), { ...station("02-b"), titel: "Bäume & Tafeln" }])
    const html = seite("test", "01-a", { kopf: '<link title="Bäume &amp; Tafeln" href="/lernseiten/test/02-b" rel="next">' })
    assert.deepEqual(pruefeNaechsteStation(html, "test", anders.pfad[1]), [])
  })

  test("meldet fehlenden, falschen, doppelten oder auskommentierten Link", () => {
    assert.match(pruefe("01-erstes", "").join("\n"), /<link rel="next" href="\/lernseiten\/test\/02-zweites" title="Titel 02-zweites"> fehlt/)
    assert.match(
      pruefe("01-erstes", '<link rel="next" href="/lernseiten/test/03-drittes" title="Titel 02-zweites">').join("\n"),
      /zeigt auf «\/lernseiten\/test\/03-drittes», erwartet \/lernseiten\/test\/02-zweites/,
    )
    assert.match(
      pruefe("01-erstes", '<link rel="next" href="/lernseiten/test/02-zweites" title="Zweites">').join("\n"),
      /title="Titel 02-zweites"/,
    )
    assert.match(pruefe("01-erstes", '<link rel="next" href="/lernseiten/test/02-zweites">').join("\n"), /gefunden: nichts/)
    assert.match(pruefe("01-erstes", naechsterLink("01-erstes").repeat(2)).join("\n"), /mehrfach/)
    assert.match(pruefe("01-erstes", `<!-- ${naechsterLink("01-erstes")} -->`).join("\n"), /fehlt/)
  })

  test("letzte Station: kein Link (auch nicht zum Lernpfad)", () => {
    assert.match(pruefe("03-drittes", '<link rel="next" href="/lernseiten/test" title="Lernpfad">').join("\n"), /letzte Station/)
  })

  test("Gesamtpruefung meldet falschen Link mit Dateiname", () => {
    testfach(["01-erstes"])
    schreibe("test/02-zweites.html", seite("test", "02-zweites", { kopf: naechsterLink("01-erstes") }))
    assert.match(fehlerText(), /test\/02-zweites\.html: <link rel="next"> zeigt auf «\/lernseiten\/test\/02-zweites»/)
  })
})

// ---------------------------------------------------------------------------
// Gesamtpruefung
// ---------------------------------------------------------------------------

describe("Gesamtpruefung", () => {
  test("gueltige Inhalte: keine Fehler, fehlende Station als Hinweis", () => {
    testfach()
    const ergebnis = pruefeAlleInhalte(basis, [])
    assert.deepEqual(ergebnis.fehler, [])
    assert.deepEqual(ergebnis.hinweise, ["test/03-drittes: Station folgt (noch keine HTML-Datei)."])
  })

  test("Dateien mit «_» am Anfang werden ignoriert", () => {
    testfach()
    schreibe("test/_vorlage.html", "kein Geruest")
    schreibe("_entwurf/fach.json", "{kaputt")
    assert.deepEqual(pruefeAlleInhalte(basis, []).fehler, [])
  })

  test("meldet HTML-Datei, die nicht im Pfad steht", () => {
    testfach()
    schreibe("test/09-neu.html", seite("test", "09-neu"))
    assert.match(fehlerText(), /09-neu\.html: steht nicht im Pfad/)
  })

  test("meldet falschen Dateinamen", () => {
    testfach()
    schreibe("test/Neu.html", seite("test", "Neu"))
    assert.match(fehlerText(), /Neu\.html: Dateiname/)
  })

  test("meldet Geruestfehler mit Dateiname", () => {
    testfach(["01-erstes"])
    schreibe("test/02-zweites.html", seite("test", "02-zweites", { css: "" }))
    assert.match(fehlerText(), /test\/02-zweites\.html: <link rel="stylesheet"/)
  })

  test("meldet externe Ressource mit Dateiname", () => {
    testfach(["01-erstes"])
    schreibe("test/02-zweites.html", seite("test", "02-zweites", { kopf: '<script src="https://cdn.example.com/k.js"></script>' }))
    assert.match(fehlerText(), /test\/02-zweites\.html: externe Ressource <script src="https:\/\/cdn\.example\.com\/k\.js">/)
  })

  test("Ordner und fremde Dateien im Fachordner ergeben Hinweise", () => {
    testfach()
    schreibe("test/04-alt/seite.json", {})
    schreibe("test/notiz.md", "x")
    const ergebnis = pruefeAlleInhalte(basis, [])
    assert.deepEqual(ergebnis.fehler, [])
    assert.match(ergebnis.hinweise.join("\n"), /test\/04-alt: wird nicht ausgeliefert/)
    assert.match(ergebnis.hinweise.join("\n"), /test\/notiz\.md: wird nicht ausgeliefert/)
  })

  test("meldet Fachordner mit Namen einer App-Seite", () => {
    schreibe("chat/fach.json", fach("CHAT"))
    assert.match(fehlerText(pruefeAlleInhalte(basis, ["chat", "decks"])), /App-Seite/)
  })

  test("meldet Fachordner, der nicht zum Kuerzel passt", () => {
    schreibe("anders/fach.json", fach("TEST"))
    assert.match(fehlerText(), /Kürzel/)
  })

  test("meldet ungueltigen Fachordner, fehlende und kaputte fach.json", () => {
    schreibe("Gross/fach.json", fach("GROSS"))
    fs.mkdirSync(path.join(basis, "leer"))
    schreibe("kaputt/fach.json", "{kaputt")
    const fehler = fehlerText()
    assert.match(fehler, /Gross: Fachordner nur mit a-z/)
    assert.match(fehler, /leer\/fach\.json: Datei fehlt/)
    assert.match(fehler, /kaputt\/fach\.json: ungültiges JSON/)
  })

  test("App-Seiten inklusive Routen-Gruppen", () => {
    const app = path.join(basis, "app")
    for (const ordner of ["(dashboard)/decks", "(lernpfad)/lernseiten", "api", "[slug]", "_intern"]) {
      fs.mkdirSync(path.join(app, ordner), { recursive: true })
    }
    assert.deepEqual(appSeiten(app).sort(), ["api", "decks", "lernseiten"])
  })

  test("Namen aus public/ (Ordner und Dateien) zaehlen mit", () => {
    const oeffentlich = path.join(basis, "public")
    fs.mkdirSync(path.join(oeffentlich, "Lernpfad"), { recursive: true })
    fs.writeFileSync(path.join(oeffentlich, "robots.txt"), "")
    assert.deepEqual(publicNamen(oeffentlich).sort(), ["lernpfad", "robots.txt"])
    assert.deepEqual(publicNamen(path.join(basis, "gibtsnicht")), [])
  })

  test("meldet Fachordner, der wie ein Eintrag in public/ heisst", () => {
    schreibe("lernpfad/fach.json", fach("LERNPFAD"))
    assert.match(fehlerText(pruefeAlleInhalte(basis, ["lernpfad", "_next"])), /lernpfad: .*public\//)
  })
})

// ---------------------------------------------------------------------------
// Echte Inhalte (nur fach.json; die Themenseiten prueft npm run lernseiten:pruefen)
// ---------------------------------------------------------------------------

describe("MSTW fach.json im Repo", () => {
  test("18 Stationen in Reihenfolge, Sektionen wie vereinbart", () => {
    const ergebnis = ladeFach("mstw")
    assert.ok(ergebnis)
    assert.deepEqual(
      ergebnis.fach.sektionen.map((s) => s.id),
      ["s1", "s2", "s3", "abschluss"],
    )
    assert.equal(ergebnis.pfad.length, 18)
    ergebnis.pfad.forEach((s, i) => {
      assert.ok(s.slug.startsWith(String(i + 1).padStart(2, "0") + "-"), s.slug)
    })
    assert.equal(ergebnis.pfad[17].slug, "18-pruefungstraining")
    assert.equal(ergebnis.pfad[17].sektion, "abschluss")
  })

  test("Fachordner kollidiert nicht mit App-Seiten, public/ oder _next", () => {
    const reserviert = reservierteNamen()
    for (const name of ["lernpfad", "_next", "api", "lernseiten"]) {
      assert.ok(reserviert.includes(name), name)
    }
    assert.equal(reserviert.includes("mstw"), false)
  })
})

describe("AVSW fach.json im Repo", () => {
  test("12 Stationen in Reihenfolge nach Lernblöcken, Prüfungstraining am Schluss", () => {
    const ergebnis = ladeFach("avsw")
    assert.ok(ergebnis)
    assert.equal(ergebnis.fach.kuerzel, "AVSW")
    assert.deepEqual(
      ergebnis.fach.sektionen.map((s) => s.id),
      ["lb1", "lb2", "lb3", "praxis", "abschluss"],
    )
    assert.equal(ergebnis.pfad.length, 12)
    ergebnis.pfad.forEach((s, i) => {
      assert.ok(s.slug.startsWith(String(i + 1).padStart(2, "0") + "-"), s.slug)
    })
    assert.equal(ergebnis.pfad[11].slug, "12-pruefungstraining")
    assert.equal(ergebnis.pfad[11].sektion, "abschluss")
  })

  test("Fachordner kollidiert nicht mit App-Seiten, public/ oder _next", () => {
    assert.equal(reservierteNamen().includes("avsw"), false)
  })
})
