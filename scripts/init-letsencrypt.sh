#!/bin/bash
# =============================================================================
# init-letsencrypt.sh — SSL Certificate Setup for Lernassistent
#
# This script initializes Let's Encrypt SSL certificates using Certbot
# running inside Docker. Run once on initial server setup.
#
# Usage:
#   chmod +x scripts/init-letsencrypt.sh
#   ./scripts/init-letsencrypt.sh
#
# Requirements:
#   - Docker and Docker Compose installed
#   - Domain DNS pointing to this server
#   - Ports 80 and 443 open
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via .env or environment variables)
# ---------------------------------------------------------------------------
DOMAIN="${DOMAIN:-lernen.jan-stocker.cloud}"
EMAIL="${EMAIL:-jan@jan-stocker.cloud}"
STAGING="${STAGING:-0}"  # Set to 1 for testing (avoids rate limits)
RSA_KEY_SIZE=4096
DATA_PATH="./certbot"

# ---------------------------------------------------------------------------
# Colors for output
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
if ! command -v docker &> /dev/null; then
  error "Docker is not installed. Please install Docker first."
fi

if ! docker compose version &> /dev/null; then
  error "Docker Compose V2 is not available."
fi

# ---------------------------------------------------------------------------
# Load .env if present
# ---------------------------------------------------------------------------
if [ -f .env ]; then
  info "Loading variables from .env ..."
  set -a
  source .env
  set +a
  DOMAIN="${DOMAIN:-lernen.jan-stocker.cloud}"
  EMAIL="${EMAIL:-jan@jan-stocker.cloud}"
fi

info "Domain:  $DOMAIN"
info "Email:   $EMAIL"
info "Staging: $STAGING"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Create required directories
# ---------------------------------------------------------------------------
info "Creating certbot directories ..."
mkdir -p "$DATA_PATH/conf"
mkdir -p "$DATA_PATH/www"

# ---------------------------------------------------------------------------
# Step 2: Download recommended TLS parameters
# ---------------------------------------------------------------------------
if [ ! -f "$DATA_PATH/conf/options-ssl-nginx.conf" ]; then
  info "Downloading recommended TLS parameters ..."
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    > "$DATA_PATH/conf/options-ssl-nginx.conf"
fi

if [ ! -f "$DATA_PATH/conf/ssl-dhparams.pem" ]; then
  info "Downloading Diffie-Hellman parameters ..."
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
    > "$DATA_PATH/conf/ssl-dhparams.pem"
fi

# ---------------------------------------------------------------------------
# Step 3: Create dummy certificate (so nginx can start)
# ---------------------------------------------------------------------------
CERT_PATH="$DATA_PATH/conf/live/$DOMAIN"

if [ -d "$CERT_PATH" ]; then
  warn "Existing certificate found for $DOMAIN."
  read -p "Replace existing certificate? (y/N) " REPLY
  if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
    info "Keeping existing certificate. Done."
    exit 0
  fi
fi

info "Creating dummy certificate for $DOMAIN ..."
mkdir -p "$CERT_PATH"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN/privkey.pem' \
    -out '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' \
    -subj '/CN=localhost'" certbot

# ---------------------------------------------------------------------------
# Step 4: Start nginx with dummy cert
# ---------------------------------------------------------------------------
info "Starting nginx ..."
docker compose up -d nginx
sleep 5

# ---------------------------------------------------------------------------
# Step 5: Remove dummy certificate
# ---------------------------------------------------------------------------
info "Removing dummy certificate ..."
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

# ---------------------------------------------------------------------------
# Step 6: Request real certificate from Let's Encrypt
# ---------------------------------------------------------------------------
info "Requesting Let's Encrypt certificate for $DOMAIN ..."

STAGING_ARG=""
if [ "$STAGING" = "1" ]; then
  STAGING_ARG="--staging"
  warn "Using STAGING server (certificate will not be trusted)"
fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    --email $EMAIL \
    --rsa-key-size $RSA_KEY_SIZE \
    -d $DOMAIN \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

# ---------------------------------------------------------------------------
# Step 7: Reload nginx with real certificate
# ---------------------------------------------------------------------------
info "Reloading nginx ..."
docker compose exec nginx nginx -s reload

echo ""
info "SSL certificate successfully installed for $DOMAIN"
info "Certificate auto-renewal is handled by the certbot service."
info ""
info "You can now start the full stack with:"
info "  docker compose up -d"
