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

  if (action !== "reset_all" && action !== "reset_kv" && action !== "reset_all_and_kv") {
    return new Response("Bad Request", { status: 400 });
  }

  // 1) Reset D1 counters (ICS/PDF)
  if (action === "reset_all" || action === "reset_all_and_kv") {
    try {
      await env.STATS_DB.prepare(`
        DELETE FROM stats
      `).run();
    } catch (e) {
      return new Response("DB error: " + (e?.message || String(e)), { status: 500 });
    }
  }

  // 2) Reset KV global counter
  if (action === "reset_kv" || action === "reset_all_and_kv") {
    try {
      await env.COUNTER_KV.put("counter:huhtamaki_generator", "0");
    } catch (e) {
      return new Response("KV error: " + (e?.message || String(e)), { status: 500 });
    }
  }

  const qs = new URLSearchParams({ key });
  if (action === "reset_all" || action === "reset_all_and_kv") qs.set("reset", "1");
  if (action === "reset_kv" || action === "reset_all_and_kv") qs.set("kvreset", "1");

  // Redirect back to stats page (PRG pattern)
  return new Response(null, {
    status: 303,
    headers: { location: `/stats?${qs.toString()}` }
  });



}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";

  const resetMsg = url.searchParams.get("reset") === "1";
  const kvResetMsg = url.searchParams.get("kvreset") === "1";

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
  button{padding:10px 12px;border:1px solid #222;background:#fff;border-radius:8px;font-size:14px; line-height:1.2; color:#111; -webkit-appearance:none; appearance:none; font-weight:600; cursor:pointer;}
  button:active{transform:translateY(1px)}
</style>
</head>
<body>
  <h1>User Statistik</h1>
  <div class="meta">Gesamt Zähler: <b>${esc(kvGlobal)}</b></div>
  ${resetMsg ? '<div class="meta" style="color:#0a6;">ICS/PDF Statistik wurde zurückgesetzt.</div>' : ''}
  ${kvResetMsg ? '<div class="meta" style="color:#0a6;">Global Counter wurde zurückgesetzt.</div>' : ''}

  <div style="display:flex; gap:10px; flex-wrap:wrap; margin:0 0 14px;">
    <form method="post" action="/stats?key=${esc(key)}" style="margin:0;">
      <input type="hidden" name="action" value="reset_all"/>
      <button type="submit" onclick="return confirm('Wirklich ALLE Counter (ICS/PDF) auf 0 setzen?');">
        Reset Action Counter
      </button>
    </form>

    <form method="post" action="/stats?key=${esc(key)}" style="margin:0;">
      <input type="hidden" name="action" value="reset_kv"/>
      <button type="submit" onclick="return confirm('Wirklich den Global Counter (KV) auf 0 setzen?');">
        Reset Global Counter
      </button>
    </form>

    <form method="post" action="/stats?key=${esc(key)}" style="margin:0;">
      <input type="hidden" name="action" value="reset_all_and_kv"/>
      <button type="submit" onclick="return confirm('Wirklich ALLES zurücksetzen (ICS/PDF + Global KV)?');">
        Reset All
      </button>
    </form>
  </div>

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

<script>
(function(){
  try{
    var u = new URL(location.href);
    var changed = false;
    ["reset","kvreset"].forEach(function(k){
      if(u.searchParams.has(k)){ u.searchParams.delete(k); changed = true; }
    });
    if(changed){
      history.replaceState(null, "", u.pathname + "?" + u.searchParams.toString());
    }
  }catch(e){}
})();
</script>

</body>
</html>`;

  return new Response(html, { headers: { "content-type":"text/html; charset=utf-8" } });
}
