import { clampAllowedYear, parseIntParam } from "./_common.js";

function colMap(ev){
  if (ev === "pdfv1") return ["pdfv1_count", "last_pdfv1_ts"];
  if (ev === "pdfv2") return ["pdfv2_count", "last_pdfv2_ts"];
  if (ev === "ics")   return ["ics_count",   "last_ics_ts"];
  return null;
}

export async function onRequest({ request, env }) {
  try{
    const url = new URL(request.url);

    const ev = (url.searchParams.get("event") || "").toLowerCase();
    const cols = colMap(ev);
    if (!cols) return new Response("Bad event", { status: 400 });

    const fiber = parseIntParam(url, "fiber");
    const team  = parseIntParam(url, "team");
    const year  = parseIntParam(url, "year");
    if (!fiber || !team || !year) return new Response("Missing params: fiber, team, year", { status: 400 });

    const yr = clampAllowedYear(year);
    if (!yr.ok) return new Response(`year muss ${yr.minYear} bis ${yr.maxYear} sein`, { status: 400 });

    const nowIso = new Date().toISOString();
    const [countCol, tsCol] = cols;

    await env.STATS_DB.prepare(`
      INSERT INTO stats (fiber, team, year, count, last_ts, ${countCol}, ${tsCol})
      VALUES (?, ?, ?, 0, NULL, 1, ?)
      ON CONFLICT(fiber, team, year)
      DO UPDATE SET ${countCol} = COALESCE(stats.${countCol}, 0) + 1,
                    ${tsCol} = excluded.${tsCol}
    `).bind(fiber, team, year, nowIso).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store" }
    });
  } catch (e) {
    console.log("track error", e);
    return new Response("DB error", { status: 500 });
  }
}
