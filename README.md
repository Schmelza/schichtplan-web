# Schichtkalender (Cloudflare Pages)

## Was ist das?
- Statische Seite: `index.html`
- 2 Cloudflare Pages Functions:
  - `/generate?fiber=2&team=1&year=2026` → JSON (Links + Dateiname)
  - `/ics?fiber=2&team=1&year=2026` → liefert direkt die .ics Datei (`text/calendar`)

https://schichtplan-web.pages.dev
