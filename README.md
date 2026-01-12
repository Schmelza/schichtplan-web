# Schichtkalender (Cloudflare Pages)

## Was ist das?
- Statische Seite: `index.html`
- 2 Cloudflare Pages Functions:
  - `/generate?fiber=2&team=1&year=2026` → JSON (Links + Dateiname)
  - `/ics?fiber=2&team=1&year=2026` → liefert direkt die .ics Datei (`text/calendar`)

## Deployment (idiotensicher)
1) Repo auf GitHub erstellen und diese Dateien hochladen.
2) Cloudflare → Workers & Pages → Pages → "Create application" → "Connect to GitHub" → Repo auswählen.
3) Build settings: Framework = None, Build command leer, Output dir = /
4) Deploy → Fertig.

Kein Token, keine Secrets, kein Excel.
