// Copyright (c) 2026 Jan Stocker. All rights reserved.
// Proprietary — copying, modification, or distribution prohibited without permission.

// tests/ps-konsole.test.ts
// Tests für den PowerShell-Simulator public/lernpfad/ps-konsole.js (läuft ohne DOM unter Node).
// Erwartete Ausgaben stammen aus echtem PowerShell 7.6.1 (pwsh -NoProfile, Kultur de-CH) in einem
// nachgebauten Ordner C:\Users\lea: tests/fixtures/ps-konsole-pwsh76.json.
// Ausfuehren: npm test

import { test, describe } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

/* eslint-disable @typescript-eslint/no-explicit-any */
// ps-konsole.js ist ein Browser-Skript mit UMD-Export (kein TypeScript)
const PS: any = require(path.join(process.cwd(), "public/lernpfad/ps-konsole.js"))

interface Fall { reset?: boolean; name?: string; code?: string; erwartet?: string | null }

/** Ausgabe ohne Leerzeichen am Zeilenende und ohne Leerzeilen am Anfang/Ende (wie im Vergleich mit pwsh) */
const norm = (t: string) => t.replace(/\r/g, "").split("\n").map((z) => z.replace(/\s+$/, "")).join("\n").replace(/^\n+/, "").replace(/\n+$/, "")

/** Neue Sitzung auf Leas Rechner, Befehl ausführen, Text zurück */
function lauf(code: string, optionen: any = {}): string {
  const s = new PS.Sitzung(optionen)
  return norm(s.zeile(code, { antworten: ["N", "N", "N"] }).text)
}
function zeilen(s: any, code: string, antworten?: string[]) {
  return s.zeile(code, { antworten: antworten || [] })
}

describe("Vergleich mit echtem pwsh 7.6 (Fixture)", () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests/fixtures/ps-konsole-pwsh76.json"), "utf8"))
  const faelle: Fall[] = fixture.faelle
  // Die Fälle laufen nacheinander auf demselben Rechner (Dateien kopieren, umbenennen …), «reset» beginnt neu
  let s = new PS.Sitzung({})
  const ergebnisse: { name: string; ist: string; soll: string }[] = []
  for (const f of faelle) {
    if (f.reset) { s = new PS.Sitzung({}); continue }
    s.i.orte.C = ["Users", "lea"]
    s.i.laufwerk = "C"
    const ist = norm(s.zeile(f.code, { antworten: ["N", "N", "N"] }).text)
    if (f.erwartet !== null && f.erwartet !== undefined) ergebnisse.push({ name: f.name as string, ist: ist, soll: norm(f.erwartet) })
  }
  test("mindestens 300 Blöcke werden verglichen", () => {
    assert.ok(ergebnisse.length >= 300, "nur " + ergebnisse.length)
  })
  for (const e of ergebnisse) {
    test(e.name, () => assert.equal(e.ist, e.soll))
  }
})

describe("Tokenizer", () => {
  const tokens = (text: string, modus: string) => {
    const lx = new PS.Lexer(text)
    const out: any[] = []
    for (;;) {
      const t = lx.naechstes(modus)
      if (t.art === "ende") break
      out.push(t)
    }
    return out
  }
  test("Befehlsmodus: Wörter, Parameter, Zahlen mit Einheit", () => {
    const t = tokens("Get-ChildItem -Path Logs\\*.log -Depth 1MB", "befehl")
    assert.deepEqual(t.map((x) => x.art), ["wort", "parameter", "wort", "parameter", "zahl"])
    assert.equal(t[2].wert, "Logs\\*.log")
    assert.equal(t[4].wert, 1048576)
  })
  test("Ausdrucksmodus: Operatoren, Variablen mit Bereich, Strings", () => {
    const t = tokens("$env:USERNAME -ceq 'lea' -and $x -gt 1.5", "ausdruck")
    assert.deepEqual(t.map((x) => x.art), ["variable", "operator", "string", "operator", "variable", "operator", "zahl"])
    assert.equal(t[0].bereich, "env")
    assert.equal(t[1].wert, "-ceq")
  })
  test("Zahl vor Bereichsoperator: 1..5 sind zwei Zahlen", () => {
    const t = tokens("1..5", "ausdruck")
    assert.deepEqual(t.map((x) => [x.art, x.wert]), [["zahl", 1], ["operator", ".."], ["zahl", 5]])
  })
  test("String mit Einsetzen und Backtick", () => {
    const [t] = tokens('"Hallo $name`t$(1+2)"', "ausdruck")
    assert.equal(t.art, "xstring")
    assert.deepEqual(t.teile.map((x: any) => x.art), ["text", "var", "text", "sub"])
    assert.equal(t.teile[2].wert, "\t")
  })
  test("Typografische Anführungszeichen und Gedankenstrich gelten wie in PowerShell", () => {
    assert.equal(lauf("Write-Output “Hallo”"), "Hallo")
    assert.equal(lauf("Get-ChildItem –Path Logs –Name | Select-Object -First 1"), "app-2026-07.log")
  })
  test("Umleitung und Kommentar", () => {
    const t = tokens("'x' >> datei.txt # Notiz", "befehl")
    assert.deepEqual(t.map((x) => x.art), ["string", "umleitung", "wort"])
  })
})

describe("Parser", () => {
  test("Pipeline mit drei Befehlen", () => {
    const b = PS.parsen("Get-ChildItem Logs | Sort-Object Length -Descending | Select-Object -First 3")
    const p = b.saetze[0]
    assert.equal(p.k, "pipeline")
    assert.deepEqual(p.elemente.map((e: any) => e.name), ["Get-ChildItem", "Sort-Object", "Select-Object"])
    assert.deepEqual(p.elemente[1].argumente.map((a: any) => a.art), ["wert", "param"])
  })
  test("Zuweisung, if/elseif/else, foreach, Funktion mit param()", () => {
    const b = PS.parsen("$x = 5\nif ($x -gt 3) { 'a' } elseif ($x) { 'b' } else { 'c' }\nforeach ($i in 1..3) { $i }\nfunction f { param([int]$n = 2) $n }")
    assert.deepEqual(b.saetze.map((s: any) => s.k), ["zuweisung", "if", "foreach", "funktion"])
    assert.equal(b.saetze[1].zweige.length, 2)
    assert.equal(b.saetze[3].koerper.knoten.param[0].typ, "int")
  })
  test("Vorrang: Komma bindet stärker als +, -f stärker als *", () => {
    assert.equal(lauf("(1,2 + 3).Count"), "3")
    assert.equal(lauf("'{0}' -f 2 * 3"), "222")
  })
  test("Unvollständige Eingabe wird erkannt (Fortsetzungszeile >>)", () => {
    const s = new PS.Sitzung({})
    assert.equal(s.zeile("if ($true) {", { interaktiv: true }).unvollstaendig, true)
    assert.equal(s.zeile("Get-ChildItem |", { interaktiv: true }).unvollstaendig, true)
    assert.equal(s.zeile("'offen", { interaktiv: true }).unvollstaendig, true)
    assert.equal(s.zeile("Get-ChildItem | Where-Object { $_.Length -gt }", { interaktiv: true }).unvollstaendig, false)
  })
  test("Parserfehler wie pwsh 7 (ConciseView mit Line |)", () => {
    assert.equal(lauf("Get-ChildItem | | Sort-Object"), [
      "ParserError:", "Line |", "   1 |  Get-ChildItem | | Sort-Object", "     |                  ~", "     | An empty pipe element is not allowed.",
    ].join("\n"))
  })
  test("Nach «}» darf die nächste Anweisung auf derselben Zeile folgen", () => {
    assert.equal(lauf("if ($true) { 'a' } 'b'"), "a\nb")
  })
})

describe("Pipeline, Variablen, Operatoren", () => {
  test("ForEach-Object läuft im Bereich des Aufrufers", () => {
    assert.equal(lauf("$s = 0; 1..4 | ForEach-Object { $s += $_ }; $s"), "10")
  })
  test("$null in der Pipeline läuft einmal, @() nie", () => {
    assert.equal(lauf("$null | ForEach-Object { 'x' }; @() | ForEach-Object { 'y' }"), "x")
  })
  test("Zuweisung eines Ausdrucks behält ein Array mit einem Element", () => {
    assert.equal(lauf("$a = @(5); $a.GetType().Name; $b = Get-ChildItem Logs\\app.log; $b.GetType().Name"), "Object[]\nFileInfo")
  })
  test("Der linke Wert bestimmt den Typ", () => {
    assert.equal(lauf("'5' + 5; 5 + '5'; '80' -lt 100; 80 -lt '100'"), "55\n10\nFalse\nTrue")
  })
  test("Ganzzahl geteilt durch Ganzzahl", () => {
    assert.equal(lauf("(4/2).GetType().Name; (7/2).GetType().Name; 7/2"), "Int32\nDouble\n3.5")
  })
  test("$Matches nach -match", () => {
    assert.equal(lauf("'Rechnung 2026-09' -match '(\\d{4})-(\\d{2})'; $Matches[1]"), "True\n2026")
  })
  test("Bereichsschutz: Endlosschleife bricht ab", () => {
    const t = lauf("while ($true) { $i++ }")
    assert.match(t, /abgebrochen \(Endlosschleife\?\)/)
  })
  test("$? zeigt den Erfolg der vorherigen Anweisung", () => {
    assert.equal(lauf("Get-Item nix -ErrorAction SilentlyContinue; $?; Get-Item Logs | Out-Null; $?"), "False\nTrue")
  })
})

describe("Prozesse und Dienste (Spiel-Rechner)", () => {
  test("Get-Process: Ansicht wie pwsh 7", () => {
    const t = lauf("Get-Process -Name berichtgenerator, notepad")
    assert.equal(t, [
      " NPM(K)    PM(M)      WS(M)     CPU(s)      Id  SI ProcessName",
      " ------    -----      -----     ------      --  -- -----------",
      "     51 1’824.00   1’920.00     812.44    6612   1 berichtgenerator",
      "     15     3.25      14.00       0.28    8840   1 notepad",
    ].join("\n"))
  })
  test("Speicherfresser finden und erst mit -WhatIf beenden", () => {
    const s = new PS.Sitzung({})
    assert.equal(norm(zeilen(s, "Get-Process | Sort-Object WS -Descending | Select-Object -First 1 -ExpandProperty Name").text), "berichtgenerator")
    assert.equal(norm(zeilen(s, "Stop-Process -Name berichtgenerator -WhatIf").text), 'What if: Performing the operation "Stop-Process" on target "berichtgenerator (6612)".')
    assert.ok(s.welt.prozess(6612))
    zeilen(s, "Stop-Process -Id 6612")
    assert.equal(s.welt.prozess(6612), null)
  })
  test("Systemprozesse: Zugriff verweigert", () => {
    assert.equal(lauf("Stop-Process -Id 812"), 'Stop-Process: Cannot stop process "lsass (812)" because of the following error: Access is denied.')
  })
  test("Get-Service: Ansicht Status, Name, DisplayName", () => {
    assert.equal(lauf("Get-Service Wolk*"), [
      "Status   Name               DisplayName", "------   ----               -----------",
      "Running  WolkenriedBackup   Wolkenried Sicherung", "Stopped  WolkenriedSync     Wolkenried Dateisynchronisation",
    ].join("\n"))
  })
  test("Start-Service ohne Adminrechte scheitert, mit Adminrechten läuft der Dienst", () => {
    assert.equal(lauf("Start-Service WolkenriedSync"),
      "Start-Service: Service 'Wolkenried Dateisynchronisation (WolkenriedSync)' cannot be started due to the following error: Cannot open 'WolkenriedSync' service on computer '.'.")
    const s = new PS.Sitzung({ admin: true })
    zeilen(s, "Start-Service WolkenriedSync")
    assert.equal(norm(zeilen(s, "(Get-Service WolkenriedSync).Status").text), "Running")
  })
  test("Status ist ein Enum (rechtsbündig, Vergleich mit Text)", () => {
    assert.equal(lauf("Get-Service | Where-Object Status -eq 'Stopped' | Measure-Object | Select-Object -ExpandProperty Count"), "4")
    assert.equal(lauf("Get-Service AudioSrv | Select-Object Name, Status"), "Name      Status\n----      ------\nAudioSrv Running")
  })
  test("Get-Service mit unbekanntem Namen", () => {
    assert.equal(lauf("Get-Service xyz"), "Get-Service: Cannot find any service with service name 'xyz'.")
  })
})

describe("System, Netz, Hilfe", () => {
  test("Get-Date liefert die feste Zeit Mo 2.11.2026 09:00", () => {
    assert.equal(lauf("Get-Date"), "Montag, 2. November 2026 09:00:00")
    assert.equal(lauf("(Get-Date).DayOfWeek; (Get-Date).AddDays(-30).ToString('dd.MM.yyyy')"), "Monday\n03.10.2026")
  })
  test("Test-Connection: Antwort, Zeitüberschreitung, unbekannter Name, -Quiet", () => {
    assert.match(lauf("Test-Connection server -Count 1"), /^ {3}Destination: server\n\nPing Source {11}Address {19}Latency BufferSize Status\n/)
    assert.match(lauf("Test-Connection sync.wolkenried.ch -Count 1"), /\* TimedOut$/)
    assert.equal(lauf("Test-Connection nix.invalid"), "Test-Connection: Testing connection to computer 'nix.invalid' failed: No such host is known.")
    assert.equal(lauf("Test-Connection www.wolkenried.ch -Quiet"), "True")
  })
  test("Laufwerke C:, Env:, HKCU:", () => {
    assert.match(lauf("Get-PSDrive"), /^Name {11}Used \(GB\) {5}Free \(GB\) Provider/)
    assert.equal(lauf("Get-ChildItem Env:USERNAME | Select-Object -ExpandProperty Value"), "lea")
    assert.equal(lauf("Set-Location HKCU:\\Software; (Get-Location).Path; Get-ChildItem -Name"), "HKCU:\\Software\nMicrosoft\nWolkenried")
  })
  test("Ausführungsrichtlinie: Get, Set ohne Adminrechte, Restricted blockiert Skripte", () => {
    assert.equal(lauf("Get-ExecutionPolicy"), "RemoteSigned")
    assert.match(lauf("Set-ExecutionPolicy RemoteSigned"), /^Set-ExecutionPolicy: Access to the path 'C:\\Program Files\\PowerShell\\7\\powershell\.config\.json' is denied\./)
    const t = lauf("Set-Content s.ps1 'Hallo'; Set-ExecutionPolicy Restricted -Scope CurrentUser; .\\s.ps1")
    assert.match(t, /cannot be loaded because running scripts is disabled on this system/)
  })
  test("Get-Help: deutscher Text, echte Syntax, -Examples, -Parameter, unbekannt", () => {
    const h = lauf("Get-Help Get-ChildItem")
    assert.match(h, /^NAME\n {4}Get-ChildItem/)
    assert.match(h, /SYNTAX\n {4}Get-ChildItem \[\[-Path\] <string\[\]>\] \[\[-Filter\] <string>\]/)
    assert.match(h, /ALIASES\n {4}dir\n {4}gci\n {4}ls/)
    assert.match(lauf("Get-Help Copy-Item -Examples"), /Example 1/)
    assert.match(lauf("Get-Help Get-ChildItem -Parameter Path"), /-Path <string\[\]>[\s\S]*Position\? {20}0/)
    assert.match(lauf("Get-Help Get-Nix"), /^Get-Help: Get-Help could not find Get-Nix in a help file in this session\./)
    assert.match(lauf("Get-Help about_Pipelines"), /TOPIC\n {4}about_Pipelines/)
  })
  test("Get-History, Get-Verb, Get-Alias", () => {
    const s = new PS.Sitzung({})
    zeilen(s, "Get-Date")
    assert.match(norm(zeilen(s, "Get-History").text), /^ {2}Id {5}Duration CommandLine\n {2}-- {5}-------- -----------\n {3}1 +0\.\d{3} Get-Date/)
    assert.equal(lauf("Get-Verb -Verb Stop | Select-Object -ExpandProperty Group"), "Lifecycle")
    assert.equal(lauf("(Get-Alias gci).Definition"), "Get-ChildItem")
  })
  test("Echte, aber nicht nachgebaute Befehle geben einen Hinweis", () => {
    assert.match(lauf("Get-CimInstance Win32_OperatingSystem"), /^\[Simulator\] «Get-CimInstance» gibt es in PowerShell, im Simulator ist der Befehl aber nicht nachgebaut/)
    assert.equal(lauf("Get-Nix").split("\n")[0], "Get-Nix: The term 'Get-Nix' is not recognized as a name of a cmdlet, function, script file, or executable program.")
  })
  test("hostname und whoami", () => {
    assert.equal(lauf("hostname; whoami"), "WR-LEA-01\nwolkenried\\lea")
  })
})

describe("Rückfragen (-Confirm) und Ausgabestrom", () => {
  test("Ohne Antwort hält die Zeile an, mit N bleibt die Datei, mit Y wird sie gelöscht", () => {
    const s = new PS.Sitzung({})
    const r = zeilen(s, "Remove-Item Downloads\\setup-alt.exe -Confirm")
    assert.match(r.rueckfrage, /^Confirm\nAre you sure you want to perform this action\?\nPerforming the operation "Remove File" on target "C:\\Users\\lea\\Downloads\\setup-alt\.exe"\.$/)
    zeilen(s, "Remove-Item Downloads\\setup-alt.exe -Confirm", ["N"])
    assert.equal(s.kontext(r).existiert("Downloads\\setup-alt.exe"), true)
    zeilen(s, "Remove-Item Downloads\\setup-alt.exe -Confirm", ["Y"])
    assert.equal(s.kontext(r).existiert("Downloads\\setup-alt.exe"), false)
  })
  test("Ordner mit Inhalt ohne -Recurse fragt nach", () => {
    const r = zeilen(new PS.Sitzung({}), "Remove-Item Dokumente\\Archiv")
    assert.match(r.rueckfrage, /has children and the Recurse parameter was not specified/)
  })
  test("Write-Host -ForegroundColor und Clear-Host im Strom", () => {
    const r = zeilen(new PS.Sitzung({}), "Write-Host 'grün' -ForegroundColor Green; Clear-Host")
    assert.deepEqual(r.strom.map((x: any) => x.art), ["host", "leeren"])
    assert.equal(r.strom[0].farbe, "Green")
  })
  test("Skriptfehler zeigen Datei und Zeile, throw bricht ab, Ausgabe davor bleibt", () => {
    const s = new PS.Sitzung({})
    s.welt.dateiSchreiben(["Users", "lea", "t.ps1"], "\"vorher\"\r\nGet-Item nix\r\nthrow 'Stopp'\r\n\"nie\"\r\n", {})
    assert.equal(norm(zeilen(s, ".\\t.ps1").text), [
      "vorher", "Get-Item: C:\\Users\\lea\\t.ps1:2", "Line |", "   2 |  Get-Item nix", "     |  ~~~~~~~~~~~~", "     | Cannot find path 'C:\\Users\\lea\\nix' because it does not exist.",
      "Exception: C:\\Users\\lea\\t.ps1:3", "Line |", "   3 |  throw 'Stopp'", "     |  ~~~~~~~~~~~~~", "     | Stopp",
    ].join("\n"))
  })
})

describe("Aufgaben-Kontext, Umgebung und API ohne Oberfläche", () => {
  test("Kontext: Eingabe, Befehle (Aliase aufgelöst), Objekte, Zustand", () => {
    const s = new PS.Sitzung({})
    const r = zeilen(s, "ls Logs | sort Length -Descending | select -First 1 -ExpandProperty Name")
    const ctx = s.kontext(r)
    assert.deepEqual(ctx.befehle, ["Get-ChildItem", "Sort-Object", "Select-Object"])
    assert.deepEqual(ctx.objekte, ["app-2026-07.log"])
    assert.equal(ctx.ort, "C:\\Users\\lea")
    assert.equal(ctx.inhalt("Dokumente\\einkaufsliste.txt"), "Milch\nBrot\nKäse\nÄpfel\nKaffee")
    assert.deepEqual(ctx.kinder("Berichte"), ["budget-2027.xlsx", "mitarbeitende.csv", "quartalsbericht-q3.xlsx"])
    assert.equal(ctx.dienst("WolkenriedSync").status, "Stopped")
    zeilen(s, "$zahl = 41 + 1")
    assert.equal(s.kontext(r).variable("zahl"), 42)
  })
  test("cfg.umgebung: Dateien ergänzen, entfernen, Ort, Variablen, Adminrechte, Zeit", () => {
    const u = { dateien: [{ pfad: "C:\\Users\\lea\\Test\\a.txt", inhalt: "eins\nzwei" }], entfernen: ["C:\\Users\\lea\\Bilder"], ort: "C:\\Users\\lea\\Test",
      variablen: { zahl: 5 }, admin: true, zeit: "2027-01-04T10:30:00", dienste: [{ name: "Test", anzeige: "Testdienst", status: "Running", start: "Manual" }] }
    const s = new PS.Sitzung({ umgebung: u })
    assert.equal(s.prompt(), "PS C:\\Users\\lea\\Test> ")
    assert.equal(norm(zeilen(s, "Get-Content a.txt; $zahl * 2; Test-Path ..\\Bilder; (Get-Date).Year; (Get-Service Test).Status").text), "eins\nzwei\n10\nFalse\n2027\nRunning")
    assert.equal(s.welt.admin, true)
    const leer = new PS.Sitzung({ umgebung: { ersetzen: true } })
    assert.equal(norm(zeilen(leer, "Get-ChildItem").text), "")
  })
  test("Lernpfad.konsole.ausfuehren: Text, Rückfragen werden mit N beantwortet", () => {
    assert.equal(PS.ausfuehren("Get-ChildItem Berichte -Name"), "budget-2027.xlsx\nmitarbeitende.csv\nquartalsbericht-q3.xlsx")
    assert.match(PS.ausfuehren("Remove-Item Dokumente\\Archiv"), /\(default is "Y"\): N$/)
  })
  test("sitzung().html: Zustand bleibt, Ausgabe ist HTML-sicher", () => {
    const f = PS.sitzung()
    f.ausfuehren("Set-Location Logs")
    const h = f.html("'<b>x</b>' + '&'")
    assert.match(h, /^<pre class="ps-ausgabe"><span class="psk-prompt">PS C:\\Users\\lea\\Logs&gt; <\/span>/)
    assert.ok(h.includes("&lt;b&gt;x&lt;/b&gt;&amp;"))
    assert.ok(!h.includes("<b>"))
  })
  test("Tab-Vervollständigung: Cmdlets, Parameter, Pfade, Variablen, Dienste", () => {
    const s = new PS.Sitzung({})
    assert.deepEqual(s.vervollstaendigen("get-chi").kandidaten, ["Get-ChildItem"])
    assert.deepEqual(s.vervollstaendigen("Get-ChildItem -Re").kandidaten, ["-Recurse", "-ReadOnly"])
    assert.deepEqual(s.vervollstaendigen("cd D").kandidaten, [".\\Dokumente", ".\\Downloads"])
    assert.deepEqual(s.vervollstaendigen("gci Logs\\app.").kandidaten, [".\\Logs\\app.log"])
    assert.deepEqual(s.vervollstaendigen("$PSV").kandidaten, ["$PSVersionTable"])
    assert.deepEqual(s.vervollstaendigen("Get-Service -Name Wo").kandidaten, ["WolkenriedBackup", "WolkenriedSync"])
  })
})

describe("Syntaxfärbung", () => {
  test("Teile mit Klassen", () => {
    const t = PS.faerbeTokens("Get-ChildItem -Path $HOME -Filter '*.log' | Where-Object { $_.Length -gt 1MB } # Notiz")
    const art = (text: string) => t.find((x: any) => x.t === text)?.k
    assert.equal(art("Get-ChildItem"), "befehl")
    assert.equal(art("-Path"), "parameter")
    assert.equal(art("$HOME"), "variable")
    assert.equal(art("'*.log'"), "string")
    assert.equal(art("Where-Object"), "befehl")
    assert.equal(art("-gt"), "operator")
    assert.equal(art("1MB"), "zahl")
    assert.equal(art("# Notiz"), "kommentar")
    assert.equal(t.map((x: any) => x.t).join(""), "Get-ChildItem -Path $HOME -Filter '*.log' | Where-Object { $_.Length -gt 1MB } # Notiz")
  })
  test("Schlüsselwörter und Typen", () => {
    const t = PS.faerbeTokens("foreach ($d in $liste) { if ([int]$d -gt 5) { 'gross' } }")
    assert.equal(t.find((x: any) => x.t === "foreach")?.k, "schluesselwort")
    assert.equal(t.find((x: any) => x.t === "if")?.k, "schluesselwort")
    assert.equal(t.find((x: any) => x.t === "[int]")?.k, "typ")
  })
})

describe("Sicherheit", () => {
  const quelle = fs.readFileSync(path.join(process.cwd(), "public/lernpfad/ps-konsole.js"), "utf8")
  test("kein eval und kein new Function im Simulator", () => {
    assert.ok(!/\beval\s*\(/.test(quelle), "eval gefunden")
    assert.ok(!/new\s+Function\s*\(/.test(quelle), "new Function gefunden")
  })
  test("Ausgaben gelangen nur per textContent ins DOM (innerHTML nur für Texte der Konfiguration)", () => {
    const zeilen = quelle.split("\n").filter((z) => /\.innerHTML\s*=/.test(z))
    assert.ok(zeilen.length <= 4, zeilen.join("\n"))
    zeilen.forEach((z) => assert.match(z, /a\.(titel|text|hinweis)/))
  })
  test("PowerShell-Eingaben, die JavaScript enthalten, laufen nicht als JavaScript", () => {
    const g = globalThis as any
    g.__psTest = 0
    lauf("globalThis.__psTest = 1; $x = '__psTest = 2'; Invoke-Expression $x")
    assert.equal(g.__psTest, 0)
  })
})
