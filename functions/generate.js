import { clampAllowedYear, parseIntParam } from "./_common.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  const fiber = parseIntParam(url, "fiber");
  const team  = parseIntParam(url, "team");
  const year  = parseIntParam(url, "year");

  if (!fiber || !team || !year) {
    return new Response(JSON.stringify({ error: "Missing params: fiber, team, year" }), {
      status: 400, headers: { "content-type":"application/json; charset=utf-8" }
    });
  }

  const yr = clampAllowedYear(year);
  if (!yr.ok) {
    return new Response(JSON.stringify({ error: `year muss ${yr.minYear} bis ${yr.maxYear} sein` }), {
      status: 400, headers: { "content-type":"application/json; charset=utf-8" }
    });
  }

  const qs = `fiber=${encodeURIComponent(fiber)}&team=${encodeURIComponent(team)}&year=${encodeURIComponent(year)}`;
  const icsPath = `/ics?${qs}`;
  const origin = url.origin;
  const httpsUrl = origin + icsPath;

  // iOS Abo: webcal:// (funktioniert mit GET URL)
  const webcalUrl = httpsUrl.replace(/^https:\/\//, "webcal://");

  // Android RAW: einfach https (Download/Import)
  const rawUrl = httpsUrl;

  
  // ---- Stats (D1) ----
  // Counts only REAL "Generieren" triggers (this endpoint).
  try {
    const nowIso = new Date().toISOString();
    await env.STATS_DB.prepare(`
      INSERT INTO stats (fiber, team, year, count, last_ts)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(fiber, team, year)
      DO UPDATE SET count = stats.count + 1, last_ts = excluded.last_ts
    `).bind(fiber, team, year, nowIso).run();
  } catch (e) {
    // Never break generation if stats fails
    console.log("STATS_DB update failed", e);
  }

return new Response(JSON.stringify({
    ok: true,
    ics_url: icsPath,
    raw_url: rawUrl,
    webcal_url: webcalUrl
  }), { headers: { "content-type":"application/json; charset=utf-8" }});
}
