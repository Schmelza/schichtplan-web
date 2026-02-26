import { ensureStatsSchema } from "./_common.js";

const ADMIN_KEY = "Rammstein1"; // <-- change this to something secret, e.g. "Johannes123!"

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (key !== ADMIN_KEY) {
    return new Response("Forbidden", { status: 403 });
  }

  let rows = [];
  try {
    await ensureStatsSchema(env?.STATS_DB);
    const res = await env.STATS_DB.prepare(`
      SELECT fiber, team, year, count, last_ts,
             ics_count, last_ics_ts,
             pdfv1_count, last_pdfv1_ts,
             pdfv2_count, last_pdfv2_ts
      FROM stats
      ORDER BY
        CASE WHEN last_ts IS NULL THEN 1 ELSE 0 END,
        last_ts DESC,
        fiber ASC,
        team ASC,
        year DESC
    `).all();
    rows = res.results || [];
  } catch (e) {
    return new Response("DB error. Check STATS_DB binding.", { status: 500 });
  }

  const total = rows.reduce((a, r) => a + (Number(r.count) || 0), 0);

  const body = rows.map(r => {
    const last = r.last_ts ? new Date(r.last_ts).toLocaleString("de-DE") : "-";
    const lastIcs  = r.last_ics_ts  ? new Date(r.last_ics_ts).toLocaleString("de-DE") : "-";
    const lastP1   = r.last_pdfv1_ts ? new Date(r.last_pdfv1_ts).toLocaleString("de-DE") : "-";
    const lastP2   = r.last_pdfv2_ts ? new Date(r.last_pdfv2_ts).toLocaleString("de-DE") : "-";
    return `<tr>
      <td>${esc(r.fiber)}</td>
      <td>P${esc(r.team)}</td>
      <td>${esc(r.year)}</td>
      <td><b>${esc(r.count)}</b><div class="sub">${esc(last)}</div></td>
      <td><b>${esc(r.ics_count ?? 0)}</b><div class="sub">${esc(lastIcs)}</div></td>
      <td><b>${esc(r.pdfv1_count ?? 0)}</b><div class="sub">${esc(lastP1)}</div></td>
      <td><b>${esc(r.pdfv2_count ?? 0)}</b><div class="sub">${esc(lastP2)}</div></td>
    </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Schichtplan Stats</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:18px;color:#111}
  h1{margin:0 0 6px;font-size:20px}
  .meta{color:#444;margin:0 0 14px;font-size:13px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #222;padding:8px 10px;text-align:left;font-size:14px}
  th{background:#f2f2f2}
  .sub{margin-top:4px;font-size:11px;color:#666;line-height:1.2}
  .small{font-size:12px;color:#555;margin-top:10px}
</style>
</head>
<body>
  <h1>User Statistik</h1>
  <div class="meta">Gesamt Zähler: <b>${esc(total)}</b></div>

  <table>
    <thead>
      <tr>
        <th>Fiber</th>
        <th>Team</th>
        <th>Jahr</th>
        <th>Generieren</th>
        <th>ICS</th>
        <th>PDF v1</th>
        <th>PDF v2</th>
      </tr>
    </thead>
    <tbody>
      ${body || '<tr><td colspan="7">Noch keine Daten.</td></tr>'}
    </tbody>
  </table>

  <div class="small">Hinweis: „Generieren“ zählt nur den Generieren-Button (QR/ICS). ICS/PDF zählen die jeweiligen Downloads/Öffnungen.</div>
</body>
</html>`;

  return new Response(html, { headers: { "content-type":"text/html; charset=utf-8" } });
}
