const ADMIN_KEY = "Rammstein1"; // <-- change this to something secret, e.g. "Johannes123!"

function esc(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}


export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  const resetMsg = url.searchParams.get("reset") === "1"; 
  if (key !== ADMIN_KEY) return new Response("Forbidden", { status: 403 });

  let action = "";
  const ct = request.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const data = await request.json();
      action = String(data?.action || "");
    } else {
      const form = await request.formData();
      action = String(form.get("action") || "");
    }
  } catch (_) {}

  if (action !== "reset_all") {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    await env.STATS_DB.prepare(`
      UPDATE stats
      SET
        count = 0,
        last_ts = NULL,
        ics_count = 0,
        last_ics_ts = NULL,
        pdfv1_count = 0,
        last_pdfv1_ts = NULL,
        pdfv2_count = 0,
        last_pdfv2_ts = NULL
    `).run();
  } catch (e) {
    return new Response("DB error: " + (e?.message || String(e)), { status: 500 });
  }

  // Redirect back to stats page (PRG pattern)
  return new Response(null, {
    status: 303,
    headers: { location: `/stats?key=${encodeURIComponent(key)}&reset=1` }
  });
}


export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  if (key !== ADMIN_KEY) {
    return new Response("Forbidden", { status: 403 });
  }


  // Global Counter (KV) – identisch zur Index.html
  let kvGlobal = 0;
  try {
    const v = await env.COUNTER_KV.get("counter:huhtamaki_generator");
    kvGlobal = v ? parseInt(v, 10) : 0;
    if (!Number.isFinite(kvGlobal)) kvGlobal = 0;
  } catch (_) {}


  let rows = [];
  try {    const res = await env.STATS_DB.prepare(`
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
    rows = res.results || [];  } catch (e) {
    return new Response("DB error: " + (e?.message || String(e)), { status: 500 });
  }

  const body = rows.map(r => {
    const lastIcs  = r.last_ics_ts  ? new Date(r.last_ics_ts).toLocaleString("de-DE") : "-";
    const lastP1   = r.last_pdfv1_ts ? new Date(r.last_pdfv1_ts).toLocaleString("de-DE") : "-";
    const lastP2   = r.last_pdfv2_ts ? new Date(r.last_pdfv2_ts).toLocaleString("de-DE") : "-";
    return `<tr>
      <td>${esc(r.fiber)}</td>
      <td>P${esc(r.team)}</td>
      <td>${esc(r.year)}</td>
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
  button{padding:10px 12px;border:1px solid #222;background:#fff;border-radius:8px;font-size:14px}
  button:active{transform:translateY(1px)}
</style>
</head>
<body>
  <h1>User Statistik</h1>
  <div class="meta">Gesamt Zähler (KV): <b>${esc(kvGlobal)}</b></div>
  ${resetMsg ? '<div class="meta" style="color:#0a6;">Statistik wurde zurückgesetzt.</div>' : ''}

  <form method="post" action="/stats?key=${esc(key)}" style="margin:0 0 14px;">
    <input type="hidden" name="action" value="reset_all"/>
    <button type="submit" onclick="return confirm('Wirklich ALLE Counter (ICS/PDF) auf 0 setzen?');">
      Alle Counter zurücksetzen
    </button>
  </form>

  <table>
    <thead>
      <tr>
        <th>Fiber</th>
        <th>Team</th>
        <th>Jahr</th>
        <th>ICS</th>
        <th>PDF v1</th>
        <th>PDF v2</th>
      </tr>
    </thead>
    <tbody>
      ${body || '<tr><td colspan="6">Noch keine Daten.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

  return new Response(html, { headers: { "content-type":"text/html; charset=utf-8" } });
}
