import { parseIntParam } from "./_common.js";

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
    const res = await env.STATS_DB.prepare(`
      SELECT fiber, team, year, count, last_ts
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
    return `<tr>
      <td>${esc(r.fiber)}</td>
      <td>P${esc(r.team)}</td>
      <td>${esc(r.year)}</td>
      <td><b>${esc(r.count)}</b></td>
      <td>${esc(last)}</td>
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
  .small{font-size:12px;color:#555;margin-top:10px}
</style>
</head>
<body>
  <h1>Schichtplan – Generierungen</h1>
  <div class="meta">Gesamt: <b>${esc(total)}</b></div>

  <table>
    <thead>
      <tr>
        <th>Fiber</th>
        <th>Team</th>
        <th>Jahr</th>
        <th>Count</th>
        <th>Letzte Generierung</th>
      </tr>
    </thead>
    <tbody>
      ${body || '<tr><td colspan="5">Noch keine Daten.</td></tr>'}
    </tbody>
  </table>

  <div class="small">Hinweis: zählt nur den Generieren Button</div>
</body>
</html>`;

  return new Response(html, { headers: { "content-type":"text/html; charset=utf-8" } });
}
