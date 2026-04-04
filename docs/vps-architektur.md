# VPS Architektur — Gesamtübersicht

## Netzwerk-Diagramm

```
                         INTERNET
                            |
                            v
                   +------------------+
                   |   DNS (Hostinger) |
                   +------------------+
                   | jan-stocker.ch      --> VPS-IP
                   | jan-stocker.cloud   --> VPS-IP
                   | lernen.jan-stocker.cloud --> VPS-IP
                   +------------------+
                            |
                            v
                +-----------------------+
                |      VPS (Hostinger)  |
                |      User: jan        |
                |      srv1389794       |
                +-----------------------+
                |    Port 80 + 443      |
                +-----------+-----------+
                            |
                            v
    +-----------------------------------------------+
    |              CADDY (~/stack/)                  |
    |         Reverse Proxy + Auto-SSL               |
    |         Container: stack-caddy-1               |
    +-----------------------------------------------+
    |                       |                        |
    |  jan-stocker.ch       |  jan-stocker.cloud     |  lernen.jan-stocker.cloud
    |  www.jan-stocker.ch   |                        |
    |                       |                        |
    v                       v                        v
+-------------+    +-----------------+    +---------------------+
| Webseite v2 |    |   CV-Website    |    |   Lernassistent     |
| stack-app-1 |    |   cv-website    |    |  lernassistent-app  |
| Port 3000   |    |   Port 3000     |    |   Port 3000         |
+-------------+    +-----------------+    +----------+----------+
      |                   |                          |
      | Netzwerk:         | Netzwerk:                | Netzwerk:
      | caddy-app         | caddy-cv                 | caddy-lernassistent
      |                   |                          | + lernassistent_internal
      |                   |                          |
      |                   |                          v
      |                   |               +---------------------+
      |                   |               |    PostgreSQL DB     |
      |                   |               |   lernassistent-db   |
      |                   |               |     Port 5432        |
      |                   |               | (nur intern, nicht   |
      |                   |               |  von aussen sichtbar)|
      |                   |               +---------------------+
      |                   |
      v                   v
  ~/stack/             Separater
  webseitev2/          Docker Container
  (Quellcode)          (extern)
```

## Docker-Container Übersicht

```
+------------------------------------------------------------------+
|                    Docker auf dem VPS                              |
+------------------------------------------------------------------+
|                                                                    |
|  ~/stack/docker-compose.yml verwaltet:                            |
|  +-------------------+                                             |
|  | stack-caddy-1     |  Caddy 2 (Reverse Proxy)                  |
|  | Ports: 80, 443    |  Config: ~/stack/caddy/Caddyfile           |
|  +-------------------+                                             |
|  | stack-app-1       |  Webseite v2 (jan-stocker.ch)              |
|  | Port: 3000 intern |  Build: ~/stack/webseitev2/                |
|  +-------------------+                                             |
|  | cv-website        |  CV (jan-stocker.cloud)                    |
|  | Port: 3000 intern |  Separater Container                      |
|  +-------------------+                                             |
|                                                                    |
|  ~/lernassistent/docker-compose.yml verwaltet:                    |
|  +-------------------+                                             |
|  | lernassistent-app |  Next.js 14 App                            |
|  | Port: 3000 intern |  Build: ~/lernassistent/repo/              |
|  +-------------------+                                             |
|  | lernassistent-db  |  PostgreSQL 16                             |
|  | Port: 5432 intern |  Volume: postgres_data                     |
|  +-------------------+                                             |
|                                                                    |
+------------------------------------------------------------------+
```

## Docker-Netzwerke

```
caddy-app (extern)
  Verbindet: stack-caddy-1 <--> stack-app-1

caddy-cv (extern)
  Verbindet: stack-caddy-1 <--> cv-website

caddy-lernassistent (extern)
  Verbindet: stack-caddy-1 <--> lernassistent-app

lernassistent_internal (intern)
  Verbindet: lernassistent-app <--> lernassistent-db
```

## Wer verwaltet was?

```
~/stack/                        ~/lernassistent/
+---------------------------+   +---------------------------+
| NICHT ANFASSEN!           |   | Lernassistent Projekt     |
|                           |   |                           |
| docker-compose.yml        |   | docker-compose.yml        |
|   - caddy                 |   |   - app (Next.js)         |
|   - app (Webseite v2)     |   |   - db (PostgreSQL)       |
|                           |   |                           |
| caddy/Caddyfile           |   | .env (Secrets)            |
|   - Alle 3 Domains        |   | repo/ (Git-Klon)          |
|                           |   |                           |
+---------------------------+   +---------------------------+
        |                               |
        | Caddy routet Traffic          | App antwortet
        | an alle 3 Apps                | auf Port 3000
        v                               v
   Port 80/443                     Nur intern
   (oeffentlich)                   (via Docker-Netzwerk)
```

## Domains und ihre Zuordnung

| Domain | Zeigt auf | Container | Verwaltet in |
|--------|-----------|-----------|-------------|
| jan-stocker.ch | Webseite v2 | stack-app-1 | ~/stack/ |
| www.jan-stocker.ch | Webseite v2 | stack-app-1 | ~/stack/ |
| jan-stocker.cloud | CV-Website | cv-website | ~/stack/ (extern) |
| lernen.jan-stocker.cloud | Lernassistent | lernassistent-app | ~/lernassistent/ |

## Wichtige Regel

```
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
!!                                              !!
!!   ~/stack/ NIEMALS AENDERN                   !!
!!   Dort laufen jan-stocker.ch                 !!
!!   und jan-stocker.cloud (CV)                 !!
!!                                              !!
!!   NUR ~/lernassistent/ bearbeiten!           !!
!!                                              !!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```
