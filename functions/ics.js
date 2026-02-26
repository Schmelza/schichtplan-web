import { clampAllowedYear, parseIntParam, shiftForDate, statsInc } from "./_common.js";

function pad(n){ return String(n).padStart(2,'0'); }
function fmtDT(dt){ // UTC local date-time (floating) like VBA: yyyymmddTHHmmss
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth()+1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}`;
}
function uid(seed){ return `${seed}-${Math.random().toString(16).slice(2)}@schichtplan-web`; }

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  const fiber = parseIntParam(url, "fiber");
  const team  = parseIntParam(url, "team");
  const year  = parseIntParam(url, "year");

  if (!fiber || !team || !year) {
    return new Response("Missing params: fiber, team, year", { status: 400 });
  }

  const yr = clampAllowedYear(year);
  if (!yr.ok) return new Response(`year muss ${yr.minYear} bis ${yr.maxYear} sein`, { status: 400 });

  const start = new Date(Date.UTC(year,0,1));
  const end   = new Date(Date.UTC(year,11,31));

  let out = "";
  out += "BEGIN:VCALENDAR\r\n";
  out += "VERSION:2.0\r\n";
  out += "PRODID:-//Schichtplan Export//DE\r\n";
  out += "CALSCALE:GREGORIAN\r\n";

  let r = 0;
  for (let d = new Date(start.getTime()); d <= end; d = new Date(d.getTime() + 86400000)) {
    const shift = shiftForDate(fiber, team, d);
    if (!shift || String(shift).toLowerCase() === "frei") continue;

    let dtStart, dtEnd, summary;
    if (String(shift).toLowerCase() === "früh") {
      dtStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 6, 0, 0));
      dtEnd   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 14, 0, 0));
      summary = `Frühschicht P${team}`;
    } else if (String(shift).toLowerCase() === "spät") {
      dtStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 14, 0, 0));
      dtEnd   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22, 0, 0));
      summary = `Spätschicht P${team}`;
    } else if (String(shift).toLowerCase() === "nacht") {
      dtStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22, 0, 0));
      dtEnd   = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()+1, 6, 0, 0));
      summary = `Nachtschicht P${team}`;
    } else {
      continue;
    }

    out += "BEGIN:VEVENT\r\n";
    out += `UID:${uid(`${year}${r}`)}\r\n`;
    out += `DTSTAMP:${fmtDT(new Date())}Z\r\n`;
    out += `DTSTART:${fmtDT(dtStart)}\r\n`;
    out += `DTEND:${fmtDT(dtEnd)}\r\n`;
    out += `SUMMARY:${summary}\r\n`;
    out += "END:VEVENT\r\n";
    r++;
  }

  out += "END:VCALENDAR\r\n";

  const filename = `Fiber${fiber}_P${team}_${year}.ics`;

  // ---- Stats (D1): ICS download ----
  try {
    await statsInc(env?.STATS_DB, { fiber, team, year, kind: "ics" });
  } catch (e) {
    console.log("STATS_DB update failed (ics)", e);
  }

  return new Response(out, {
    headers: {
      "content-type":"text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}
