import { clampAllowedYear, parseIntParam, statsInc } from "./_common.js";

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
    await statsInc(env?.STATS_DB, { fiber, team, year, kind: "generate" });
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
