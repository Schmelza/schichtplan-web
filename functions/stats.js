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
  const adminKey = env?.ADMIN_KEY || "";

  const resetMsg = url.searchParams.get("reset") === "1"; 
  if (!adminKey || key !== adminKey) return new Response("Forbidden", { status: 403 });

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
      try { await env.STATS_DB.prepare("DELETE FROM stats_events").run(); } catch (_) { /* Tabelle gibt es evtl. noch nicht */ }
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
  const adminKey = env?.ADMIN_KEY || "";

  const resetMsg = url.searchParams.get("reset") === "1";
  const kvResetMsg = url.searchParams.get("kvreset") === "1";

  if (!adminKey || key !== adminKey) {
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

  // Letzte Aktion: neuester Zeitstempel ueber alle Zeilen und Spalten
  // (Generieren, ICS, PDF v1, PDF v2). Wird in der Tabelle farbig markiert.
  const TS_FIELDS = [
    { key: "last_ts",       label: "Generieren" },
    { key: "last_ics_ts",   label: "ICS" },
    { key: "last_pdfv1_ts", label: "PDF v1" },
    { key: "last_pdfv2_ts", label: "PDF v2" },
  ];
  let latest = null;
  rows.forEach((r, i) => {
    for (const f of TS_FIELDS) {
      const ms = r[f.key] ? Date.parse(r[f.key]) : NaN;
      if (Number.isFinite(ms) && (!latest || ms > latest.ms)) {
        latest = { i, key: f.key, label: f.label, ms };
      }
    }
  });
  const fmtBerlin = (iso) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  const latestHtml = latest
    ? `<div class="latest">Letzte Aktion: <b>${esc(rows[latest.i].fiber)} &middot; P${esc(rows[latest.i].team)} &middot; ${esc(rows[latest.i].year)}</b> &ndash; ${esc(latest.label)} &ndash; ${esc(fmtBerlin(rows[latest.i][latest.key]))}</div>`
    : "";
  const cellCls = (i, key) => (latest && latest.i === i && latest.key === key) ? ' class="latest-cell"' : "";

  const body = rows.map((r, i) => {
    const lastIcs  = r.last_ics_ts  ? new Date(r.last_ics_ts).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "-";
    const lastP1   = r.last_pdfv1_ts ? new Date(r.last_pdfv1_ts).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "-";
    const lastP2   = r.last_pdfv2_ts ? new Date(r.last_pdfv2_ts).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "-";
    const rowCls = (latest && latest.i === i) ? ' class="latest-row"' : "";
    const genCls = cellCls(i, "last_ts"); // "Generieren" hat keine eigene Spalte -> Fiber/Team/Jahr markieren
    return `<tr${rowCls}>
      <td${genCls}>${esc(r.fiber)}</td>
      <td${genCls}>P${esc(r.team)}</td>
      <td${genCls}>${esc(r.year)}</td>
      <td${cellCls(i, "last_ics_ts")}><b>${esc(r.ics_count ?? 0)}</b><div class="sub">${esc(lastIcs)}</div></td>
      <td${cellCls(i, "last_pdfv1_ts")}><b>${esc(r.pdfv1_count ?? 0)}</b><div class="sub">${esc(lastP1)}</div></td>
      <td${cellCls(i, "last_pdfv2_ts")}><b>${esc(r.pdfv2_count ?? 0)}</b><div class="sub">${esc(lastP2)}</div></td>
    </tr>`;
  }).join("");

  // Letzte 5 Einzelaktionen (neueste zuerst) aus dem Protokoll
  let events = [];
  try {
    const evRes = await env.STATS_DB.prepare("SELECT ts, fiber, team, year, kind FROM stats_events ORDER BY id DESC LIMIT 5").all();
    events = evRes.results || [];
  } catch (_) { events = []; /* Tabelle gibt es erst nach der ersten Aktion */ }
  const KIND_LABEL = { generate: "Generieren", ics: "ICS / Abo / RAW", pdfv1: "PDF v1", pdfv2: "PDF v2" };
  const eventsBody = events.map((e, i) => `<tr${i === 0 ? ' class="latest-row"' : ""}>
      <td>${esc(fmtBerlin(e.ts))}</td>
      <td>${esc(KIND_LABEL[e.kind] || e.kind)}</td>
      <td>${esc(e.fiber)}</td>
      <td>P${esc(e.team)}</td>
      <td>${esc(e.year)}</td>
    </tr>`).join("");
  const recentHtml = `<h2 class="recent-h">Letzte 5 Aktionen</h2>
  <div class="tw"><table class="recent">
    <thead><tr><th>Zeit</th><th>Aktion</th><th>Fiber</th><th>Team</th><th>Jahr</th></tr></thead>
    <tbody>
      ${eventsBody || '<tr><td colspan="5">Noch keine Aktionen aufgezeichnet (die Liste startet mit diesem Update).</td></tr>'}
    </tbody>
  </table></div>`;

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
  .recent-h{margin:0 0 8px;font-size:16px}
  table.recent{margin:0 0 22px}
  .latest{margin:0 0 10px;padding:8px 10px;background:#fff3b0;border:1px solid #e0b800;border-radius:8px;font-size:14px}
  tr.latest-row td{background:#fff8d6}
  td.latest-cell{background:#ffd54a !important;box-shadow:inset 0 0 0 2px #e0a800}
  button{padding:10px 12px;border:1px solid #222;background:#fff;border-radius:8px;font-size:14px; line-height:1.2; color:#111; -webkit-appearance:none; appearance:none; font-weight:600; cursor:pointer;}
  button:active{transform:translateY(1px)}
  .tw{overflow-x:auto}
  @media (max-width:520px){
    body{margin:14px}
    th,td{padding:6px 5px;font-size:12px}
    .sub{font-size:10px;margin-top:3px}
    .latest{font-size:13px}
    .recent-h{font-size:15px}
  }
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
        ICS/PDF Statistik zurücksetzen
      </button>
    </form>

    <form method="post" action="/stats?key=${esc(key)}" style="margin:0;">
      <input type="hidden" name="action" value="reset_kv"/>
      <button type="submit" onclick="return confirm('Wirklich den Global Counter (KV) auf 0 setzen?');">
        Global Counter (KV) zurücksetzen
      </button>
    </form>

    <form method="post" action="/stats?key=${esc(key)}" style="margin:0;">
      <input type="hidden" name="action" value="reset_all_and_kv"/>
      <button type="submit" onclick="return confirm('Wirklich ALLES zurücksetzen (ICS/PDF + Global KV)?');">
        Alles zurücksetzen
      </button>
    </form>
  </div>

  ${latestHtml}
  ${recentHtml}

  <div class="tw">
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
  </div>

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
