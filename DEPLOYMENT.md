# DEPLOYMENT.md — Deployment-Dokumentation

## Architektur auf dem VPS

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
  docker-compose.yml              # App (lokaler Build) + PostgreSQL
  .env                            # Secrets (DB-Passwort, NextAuth, Anthropic, Resend, reCAPTCHA)
  repo/                           # Git-Klon von GitHub
```

## Deployment-Methode: CI/CD via GitHub Actions (AKTIV)

**Deployment ist vollautomatisch.** Bei jedem `git push` auf `master` fuehrt GitHub Actions aus:

1. Docker-Image lokal auf dem VPS bauen (mit `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` als Build-Arg)
2. Prisma-Migrationen automatisch ausfuehren
3. Container neu starten
4. Health Check

**Es ist KEIN manuelles Deployment auf dem VPS noetig.** Einfach Code pushen — der Rest passiert automatisch.

### Workflow-Datei
`.github/workflows/deploy.yml`

### Benoetigte GitHub Secrets
- `VPS_HOST` — VPS IP-Adresse
- `VPS_USER` — `jan`
- `VPS_SSH_KEY` — Private SSH Key (ohne Passphrase, ed25519)
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — Google reCAPTCHA v3 Site Key

### Wichtig fuer NEXT_PUBLIC_ Variablen
`NEXT_PUBLIC_`-Variablen werden von Next.js zur **Build-Zeit** ins Client-Bundle eingebettet.
Sie muessen als `ARG` in der Dockerfile und als `--build-arg` beim `docker compose build` uebergeben werden.
Runtime-Environment-Variablen reichen dafuer **nicht** aus.

Aktuell betroffene Variable:
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — wird aus der `.env` auf dem VPS gelesen und als Build-Arg uebergeben

## Environment-Variablen (.env auf dem VPS)

```env
POSTGRES_PASSWORD=<generiert>               # DB-Passwort
NEXTAUTH_SECRET=<generiert>                 # Session-Verschluesselung
ANTHROPIC_API_KEY=sk-ant-...                # Claude API Key
ADMIN_EMAIL=<admin-email>                   # E-Mail fuer Admin-Panel-Zugriff
RESEND_API_KEY=re_...                       # Resend API Key (E-Mail-Versand)
RECAPTCHA_SECRET_KEY=6Le...                 # Google reCAPTCHA v3 Secret Key (serverseitig)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Le...       # Google reCAPTCHA v3 Site Key (wird beim Build eingebettet)
```

Die DATABASE_URL wird in docker-compose.yml zusammengebaut:
`postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/lernassistent`

## docker-compose.yml auf dem VPS

Die App wird **lokal auf dem VPS gebaut** (nicht von ghcr.io gezogen):

```yaml
app:
  build:
    context: ./repo
    dockerfile: Dockerfile
  # ... environment, depends_on, etc.
```

## Manuelles Deployment (nur falls CI/CD ausfaellt)

```bash
cd ~/lernassistent/repo
git pull

cd ~/lernassistent

# RECAPTCHA_KEY aus .env lesen und als Build-Arg uebergeben
RECAPTCHA_KEY=$(grep -m1 '^NEXT_PUBLIC_RECAPTCHA_SITE_KEY=' .env | sed 's/^NEXT_PUBLIC_RECAPTCHA_SITE_KEY=//')
docker compose build --build-arg NEXT_PUBLIC_RECAPTCHA_SITE_KEY="$RECAPTCHA_KEY" app

docker compose up -d
```

### Manuelle Migration (nur falls CI/CD die Migration nicht ausfuehrt)

```bash
cd ~/lernassistent

# DB-Passwort aus .env lesen
DB_PASS=$(grep -m1 '^POSTGRES_PASSWORD=' .env | sed 's/^POSTGRES_PASSWORD=//')

# Migration ausfuehren
docker run -it --rm --network lernassistent_internal \
  -e DATABASE_URL="postgresql://postgres:${DB_PASS}@lernassistent-db:5432/lernassistent" \
  -v $(pwd)/repo:/app -w /app node:20-alpine sh

# Im Container:
npm ci
npx prisma migrate deploy
exit
```

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
- SSH-Key muss ohne Passphrase sein
- Alle GitHub Secrets muessen gesetzt sein

### Kontaktformular zeigt "nicht verfuegbar"
`NEXT_PUBLIC_RECAPTCHA_SITE_KEY` fehlt im Build. Neu bauen mit `--build-arg`.

### Bekanntes Problem: Prisma v7 Migration
Prisma v7 hat die `url` aus dem `datasource`-Block entfernt. Die URL steht in `prisma.config.ts`.
Das standalone Docker Image enthaelt diese Datei nicht — Migrationen laufen daher via separatem Container mit gemountem Repo.
