# DEPLOYMENT.md — Deployment-Dokumentation

## Architektur

Seit 2026-10-28 baut GitHub Actions das Image und legt es in der GitHub Container Registry (GHCR) ab. Der VPS baut nichts mehr, er zieht das fertige Image.

```
git push auf master
  |
  v
GitHub Actions (Runner)
  |-- Job build-and-push: Image bauen --> ghcr.io/stoecki99/lernassistent (:latest, :<sha>)
  |-- Job deploy (SSH auf den VPS):
  |     git pull (repo/), docker compose pull app, Migration, docker compose up -d, Health Check
  v
VPS
```

```
Internet
  |
  v
Caddy (~/stack/, Port 80/443, Auto-SSL)
  |
  |-- jan-stocker.ch        --> stack-app:3000 (Webseite v2)
  |-- jan-stocker.cloud     --> cv-website:3000 (CV)
  |-- lernen.jan-stocker.cloud --> lernassistent-app:3000 (Lernassistent)
  |
  v
Docker Networks:
  - caddy-app (Webseite)
  - caddy-cv (CV)
  - caddy-lernassistent (Lernassistent <-> Caddy)
  - lernassistent_internal (App <-> DB)
```

## Verzeichnisstruktur auf dem VPS

```
~/stack/                          # Caddy + andere Services (NICHT ANFASSEN)
  docker-compose.yml              # Caddy, Webseite, CV
  caddy/Caddyfile                 # Reverse Proxy Config

~/lernassistent/                  # Lernassistent Deployment
  docker-compose.yml              # App (Image aus GHCR) + PostgreSQL
  docker-compose.yml.bak-2026-10-28  # Sicherung vor der Umstellung auf GHCR (noch mit build:)
  .env                            # Secrets (DB-Passwort, NextAuth, Anthropic, Resend, reCAPTCHA)
  repo/                           # Git-Klon von GitHub (nur noch fuer die Migrationen)
```

## Deployment-Methode: CI/CD via GitHub Actions (AKTIV)

**Deployment ist vollautomatisch.** Bei jedem `git push` auf `master` (oder manuell über «Run workflow») fuehrt GitHub Actions aus:

**Job `build-and-push`** (auf dem GitHub-Runner):

1. Image nach `Dockerfile` bauen. Der Build prueft die Lernpfad-Inhalte (`npm run lernseiten:pruefen`) und stoppt bei Fehlern, danach `next build`.
2. `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` kommt als Build-Arg aus dem gleichnamigen GitHub-Secret.
3. Push nach GHCR mit zwei Tags: `latest` und dem kurzen Commit-SHA (7 Zeichen, z. B. `b3baed9`).

**Job `deploy`** (per SSH auf dem VPS, nach erfolgreichem Build):

1. `git pull` in `~/lernassistent/repo/` (Migrationsdateien aktuell halten)
2. `docker compose pull app` (zieht `ghcr.io/stoecki99/lernassistent:latest`)
3. Prisma-Migrationen automatisch: `prisma migrate deploy` in einem `node:20-alpine`-Container mit gemountetem `repo/` im Netzwerk `lernassistent_internal`
4. `docker compose up -d` (Container mit neuem Image neu starten)
5. `docker image prune -f` (alte, unbenannte Images entfernen)
6. Health Check auf `/api/health`

**Es ist KEIN manuelles Deployment auf dem VPS noetig.** Einfach Code pushen — der Rest passiert automatisch.

### Workflow-Datei
`.github/workflows/deploy.yml`

### Benoetigte GitHub Secrets
- `VPS_HOST` — VPS IP-Adresse
- `VPS_USER` — `jan`
- `VPS_SSH_KEY` — Private SSH Key (ohne Passphrase, ed25519)
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — Google reCAPTCHA v3 Site Key (Build-Arg)

Den Push nach GHCR erledigt der automatische `GITHUB_TOKEN` (Berechtigung `packages: write` im Workflow).

### GHCR-Login auf dem VPS

Das Paket `ghcr.io/stoecki99/lernassistent` ist **privat**. Der VPS braucht deshalb einen Login bei GHCR, sonst scheitert `docker compose pull` mit `denied` oder `unauthorized`:

```bash
docker login ghcr.io -u Stoecki99
```

Als Passwort ein GitHub Personal Access Token mit der Berechtigung `read:packages` eingeben. Docker speichert den Zugang in `~/.docker/config.json` des Users `jan`. Laeuft das Token ab, ein neues erstellen und den Login wiederholen.

### Wichtig fuer NEXT_PUBLIC_ Variablen
`NEXT_PUBLIC_`-Variablen werden von Next.js zur **Build-Zeit** ins Client-Bundle eingebettet.
Sie muessen als `ARG` in der Dockerfile und als Build-Arg im Workflow (`build-args` in `deploy.yml`) uebergeben werden.
Runtime-Environment-Variablen auf dem VPS reichen dafuer **nicht** aus.

Aktuell betroffene Variable:
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — kommt aus dem GitHub-Secret. Der Wert in der `.env` auf dem VPS hat auf das Image keinen Einfluss mehr.

## Environment-Variablen (.env auf dem VPS)

```env
POSTGRES_PASSWORD=<generiert>               # DB-Passwort
NEXTAUTH_SECRET=<generiert>                 # Session-Verschluesselung
ANTHROPIC_API_KEY=sk-ant-...                # Claude API Key
ADMIN_EMAIL=<admin-email>                   # E-Mail fuer Admin-Panel-Zugriff
RESEND_API_KEY=re_...                       # Resend API Key (E-Mail-Versand)
RECAPTCHA_SECRET_KEY=6Le...                 # Google reCAPTCHA v3 Secret Key (serverseitig)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Le...       # nur noch Nachschlagewert, das Image bekommt ihn aus dem GitHub-Secret
```

Die DATABASE_URL wird in docker-compose.yml zusammengebaut:
`postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/lernassistent`

## docker-compose.yml auf dem VPS

Seit 2026-10-28 steht beim Dienst `app` das Image aus GHCR statt eines lokalen Builds (wie `docker-compose.yml` im Repo):

```yaml
app:
  image: ghcr.io/stoecki99/lernassistent:latest
  container_name: lernassistent-app
  env_file: .env
  # ... environment, depends_on, healthcheck, networks
```

Die fruehere Fassung mit `build: { context: ./repo, dockerfile: Dockerfile }` liegt als `docker-compose.yml.bak-2026-10-28` daneben.

## Manuelles Deployment (nur falls CI/CD ausfaellt)

Zuerst den Workflow in GitHub erneut starten (Actions → «Deploy to VPS» → «Run workflow»). Nur wenn das nicht geht, auf dem VPS das zuletzt gebaute Image ziehen (Befehle einzeln ausfuehren):

```bash
cd ~/lernassistent
docker compose pull app
docker compose up -d
```

Gab es neue Migrationen, vorher `repo/` aktualisieren (`git pull` in `~/lernassistent/repo`) und die Migration ausfuehren (siehe unten). Ein neues Image entsteht nur in GitHub Actions — auf dem VPS nicht bauen.

### Manuelle Migration (nur falls CI/CD die Migration nicht ausfuehrt)

```bash
cd ~/lernassistent

# DB-Passwort aus .env lesen
DB_PASS=$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//')

# Migration ausfuehren (gleicher Befehl wie im Workflow)
docker run --rm --network lernassistent_internal -e DATABASE_URL="postgresql://postgres:${DB_PASS}@lernassistent-db:5432/lernassistent" -v "$(pwd)/repo:/app" -w /app node:20-alpine sh -c "npm ci --ignore-scripts && npx prisma generate && npx prisma migrate deploy"
```

## Rollback

Jeder Build liegt in GHCR zusaetzlich unter seinem kurzen Commit-SHA. Fuer einen Rollback das Image eines frueheren Commits ziehen und als `latest` markieren (Befehle einzeln ausfuehren, `<sha>` ersetzen, z. B. `efc2dae`):

```bash
cd ~/lernassistent
docker pull ghcr.io/stoecki99/lernassistent:<sha>
docker tag ghcr.io/stoecki99/lernassistent:<sha> ghcr.io/stoecki99/lernassistent:latest
docker compose up -d app
```

- Den SHA zeigen `git log --oneline` oder die Paketseite auf GitHub (Packages → lernassistent).
- Migrationen werden **nicht** zurueckgerollt. Vor einem Rollback ueber eine Schema-Aenderung hinweg pruefen, ob das alte Image mit der neuen Datenbank laeuft (`prisma/migrations/`).
- Der naechste Push auf `master` setzt `latest` wieder auf den neuesten Build. Fuer einen dauerhaften Rollback den fehlerhaften Commit mit `git revert` rueckgaengig machen und pushen.

## Container verwalten

```bash
cd ~/lernassistent

# Status pruefen
docker compose ps

# Logs anschauen
docker compose logs -f app
docker compose logs -f db

# Neustart
docker compose restart app

# Alles stoppen
docker compose down

# Alles stoppen + DB-Daten loeschen (ACHTUNG!)
docker compose down -v
```

## Caddy-Konfiguration

Die Caddy-Config liegt in `~/stack/caddy/Caddyfile`. Der relevante Block:

```
lernen.jan-stocker.cloud {
  reverse_proxy lernassistent-app:3000
  header {
    -Server
    -Via
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
  }
  @static path *.webp *.png *.jpg *.jpeg *.gif *.svg *.ico *.woff2 *.woff *.css *.js
  header @static >Cache-Control "public, max-age=31536000, immutable"
}
```

> **Hinweis (geprüft 2026-10-29):** Der `@static`-Block ist auf dem VPS nicht aktiv. `/lernpfad/lernpfad.js` antwortet mit `Cache-Control: public, max-age=0` (Standard von Next), siehe auch Vault `Caddy-Routing.md`. Nicht unbedacht nachrüsten: `public/lernpfad/*` hat keine Hash-Namen, mit `immutable` kämen Änderungen am Baukasten ein Jahr lang nicht bei den Nutzern an.

Caddy handhabt SSL automatisch via Let's Encrypt. Kein manuelles Zertifikat noetig.

## DNS

| Typ | Name | Wert | Wo |
|-----|------|------|-----|
| A | lernen | VPS-IP | Hostinger DNS-Manager |

## Externe Services

| Service | Zweck | Dashboard |
|---------|-------|-----------|
| Resend | E-Mail-Versand (Kontaktformular) | https://resend.com/domains |
| Google reCAPTCHA v3 | Spam-Schutz Kontaktformular | https://www.google.com/recaptcha/admin |
| GitHub Container Registry | Ablage der App-Images (privat) | https://github.com/Stoecki99?tab=packages |

**Wichtig:** Domain `jan-stocker.cloud` muss bei Resend verifiziert sein (DNS-Eintraege im Hostinger DNS-Manager).

## Troubleshooting

### App startet nicht
```bash
docker compose logs app
```

### DB-Verbindung fehlgeschlagen
```bash
docker compose exec db psql -U postgres -d lernassistent -c "SELECT 1"
```

### Caddy kann App nicht erreichen
```bash
# Pruefen ob App im richtigen Netzwerk ist
docker network inspect caddy-lernassistent

# Caddy neustarten
cd ~/stack && docker compose restart caddy
```

### CI/CD schlaegt fehl
- Pruefe GitHub Actions Logs: https://github.com/Stoecki99/Lernassistent/actions
- Job `build-and-push` rot: Build-Log lesen; oft meldet `npm run lernseiten:pruefen` fehlerhafte Lernpfad-Inhalte
- Job `deploy` rot: SSH-Key muss ohne Passphrase sein, alle GitHub Secrets muessen gesetzt sein
- `docker compose pull` meldet `denied` oder `unauthorized`: GHCR-Login auf dem VPS fehlt oder das Token ist abgelaufen (siehe «GHCR-Login auf dem VPS»)

### Kontaktformular zeigt "nicht verfuegbar"
`NEXT_PUBLIC_RECAPTCHA_SITE_KEY` fehlt im Build. GitHub-Secret pruefen und den Workflow erneut laufen lassen (neues Image).

### Bekanntes Problem: Prisma v7 Migration
Prisma v7 hat die `url` aus dem `datasource`-Block entfernt. Die URL steht in `prisma.config.ts`.
Das standalone Docker Image enthaelt diese Datei nicht — Migrationen laufen daher via separatem Container mit gemountem Repo.
