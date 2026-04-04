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
  docker-compose.yml              # App + PostgreSQL
  .env                            # Secrets (DB-Passwort, NextAuth, Anthropic Key)
  repo/                           # Git-Klon von GitHub
```

## Environment-Variablen (.env)

```env
POSTGRES_PASSWORD=<generiert>     # DB-Passwort
NEXTAUTH_SECRET=<generiert>       # Session-Verschluesselung
ANTHROPIC_API_KEY=sk-ant-...      # Claude API Key
```

Die DATABASE_URL wird in docker-compose.yml zusammengebaut:
`postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/lernassistent`

## Deployment-Schritte (manuell)

### Erstmaliges Setup

```bash
# 1. Repo klonen (bereits erledigt)
cd ~/lernassistent
git clone https://github.com/Stoecki99/Lernassistent.git repo

# 2. .env erstellen (bereits erledigt)
# POSTGRES_PASSWORD, NEXTAUTH_SECRET, ANTHROPIC_API_KEY setzen

# 3. Docker-Netzwerk erstellen (bereits erledigt)
docker network create caddy-lernassistent

# 4. Image bauen
docker compose build app

# 5. Container starten
docker compose up -d

# 6. DB migrieren (NOCH OFFEN — siehe Problem unten)
# 7. Badges seeden (NOCH OFFEN)
```

### Update deployen (nach Code-Aenderungen)

```bash
cd ~/lernassistent/repo
git pull

cd ~/lernassistent
docker compose build app
docker compose up -d

# Falls Schema-Aenderungen:
# Migration ausfuehren (siehe Abschnitt unten)
```

### Container verwalten

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

## Bekanntes Problem: Prisma v7 Migration

### Problem
Prisma v7 hat die `url` aus dem `datasource`-Block im Schema entfernt. Die URL muss jetzt in `prisma.config.ts` stehen. Das standalone Docker Image enthaelt diese Datei nicht.

### Loesung: Migration via separaten Container

```bash
cd ~/lernassistent

# Migration ausfuehren (mit vollem Repo + node_modules)
docker run --rm \
  --network lernassistent_internal \
  -e DATABASE_URL="postgresql://postgres:$(grep POSTGRES_PASSWORD .env | cut -d= -f2)@lernassistent-db:5432/lernassistent" \
  -v $(pwd)/repo:/app \
  -w /app \
  node:20-alpine sh -c "npm ci && npx prisma migrate deploy"

# Badges seeden
docker run --rm \
  --network lernassistent_internal \
  -e DATABASE_URL="postgresql://postgres:$(grep POSTGRES_PASSWORD .env | cut -d= -f2)@lernassistent-db:5432/lernassistent" \
  -v $(pwd)/repo:/app \
  -w /app \
  node:20-alpine sh -c "npm ci && npx prisma db seed"
```

### Alternative: Dockerfile anpassen
`prisma.config.ts` in den Runner-Stage kopieren:
```dockerfile
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
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

## GitHub Actions CI/CD (aktuell deaktiviert)

Der Workflow in `.github/workflows/deploy.yml` ist konfiguriert aber funktioniert nicht wegen SSH-Key-Passphrase-Problem. Wird aktuell manuell deployed.

### Benoetigte GitHub Secrets (fuer spaeter)
- `VPS_HOST` — VPS IP-Adresse
- `VPS_USER` — `jan`
- `VPS_SSH_KEY` — Private SSH Key (ohne Passphrase!)
- `VPS_SSH_PASSPHRASE` — SSH Key Passphrase

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

### Image neu bauen nach Code-Aenderung
```bash
cd ~/lernassistent/repo && git pull
cd ~/lernassistent && docker compose build app && docker compose up -d
```
