import { clampAllowedYear, parseIntParam, shiftForDate } from "./_common.js";

function pad(n){ return String(n).padStart(2,'0'); }

function fmtUTC(dt){
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth()+1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`;
}

function lastSundayDay(year, monthIndex) {
  const d = new Date(Date.UTC(year, monthIndex + 1, 0));
  return d.getUTCDate() - d.getUTCDay();
}

function berlinOffsetMinutes(y, m, d, h) {
  const marchLastSunday = lastSundayDay(y, 2);
  const octoberLastSunday = lastSundayDay(y, 9);

  if (m > 3 && m < 10) return 120;
  if (m < 3 || m > 10) return 60;

  if (m === 3) {
    if (d > marchLastSunday) return 120;
    if (d < marchLastSunday) return 60;
    return h >= 2 ? 120 : 60;
  }

  if (m === 10) {
    if (d < octoberLastSunday) return 120;
    if (d > octoberLastSunday) return 60;
    return h >= 3 ? 60 : 120;
  }

  return 60;
}

function berlinLocalToUTC(y, m, d, h, min = 0, sec = 0) {
  const offset = berlinOffsetMinutes(y, m, d, h);
  return new Date(Date.UTC(y, m - 1, d, h, min, sec) - offset * 60000);
}

function uid(fiber, team, dateObj){
  const y = dateObj.getUTCFullYear();
  const m = pad(dateObj.getUTCMonth()+1);
  const d = pad(dateObj.getUTCDate());
  return `f${fiber}-p${team}-${y}${m}${d}@schichtplan-web`;
}

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
  out += "X-WR-TIMEZONE:Europe/Berlin\r\n";

  for (let d = new Date(start.getTime()); d <= end; d = new Date(d.getTime() + 86400000)) {
    const shift = shiftForDate(fiber, team, d);
    if (!shift || String(shift).toLowerCase() === "frei") continue;

    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    let dtStart, dtEnd, summary;

    if (String(shift).toLowerCase() === "früh") {
      dtStart = berlinLocalToUTC(y, m, day, 6, 0, 0);
      dtEnd   = berlinLocalToUTC(y, m, day, 14, 0, 0);
      summary = `Frühschicht P${team}`;

    } else if (String(shift).toLowerCase() === "spät") {
      dtStart = berlinLocalToUTC(y, m, day, 14, 0, 0);
      dtEnd   = berlinLocalToUTC(y, m, day, 22, 0, 0);
      summary = `Spätschicht P${team}`;

    } else if (String(shift).toLowerCase() === "nacht") {
      const nextDay = new Date(Date.UTC(y, d.getUTCMonth(), day + 1));

      dtStart = berlinLocalToUTC(y, m, day, 22, 0, 0);
      dtEnd   = berlinLocalToUTC(
        nextDay.getUTCFullYear(),
        nextDay.getUTCMonth() + 1,
        nextDay.getUTCDate(),
        6,
        0,
        0
      );

      summary = `Nachtschicht P${team}`;

    } else {
      continue;
    }

    out += "BEGIN:VEVENT\r\n";
    out += `UID:${uid(fiber, team, d)}\r\n`;
    out += `DTSTAMP:${fmtUTC(new Date())}\r\n`;
    out += `DTSTART:${fmtUTC(dtStart)}\r\n`;
    out += `DTEND:${fmtUTC(dtEnd)}\r\n`;
    out += `SUMMARY:${summary}\r\n`;
    out += "END:VEVENT\r\n";
  }

  out += "END:VCALENDAR\r\n";

  const filename = `Fiber${fiber}_P${team}_${year}.ics`;

  return new Response(out, {
    headers: {
      "content-type":"text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control":"no-store, no-cache, must-revalidate, max-age=0",
      "pragma":"no-cache"
    }
  });
}