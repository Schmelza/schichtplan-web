import { clampAllowedYear, parseIntParam, shiftForDate } from "./_common.js";

function pad(n){ return String(n).padStart(2,'0'); }

function fmtDT(dt){
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth()+1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`;
}

function fmtLocal(y, m, d, h, min = 0, sec = 0) {
  return `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}${pad(sec)}`;
}

function uid(fiber, team, dateObj){
  const y = dateObj.getUTCFullYear();
  const m = pad(dateObj.getUTCMonth()+1);
  const d = pad(dateObj.getUTCDate());

  // Wichtig: neue UID-Version, damit Google alte UTC-gecachete Events nicht weiterverwendet
  return `f${fiber}-p${team}-${y}${m}${d}-berlin-v2@schichtplan-web`;
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
  out += "METHOD:PUBLISH\r\n";
  out += "X-WR-CALNAME:Schichtplan\r\n";
  out += "X-WR-TIMEZONE:Europe/Berlin\r\n";

  out += "BEGIN:VTIMEZONE\r\n";
  out += "TZID:Europe/Berlin\r\n";
  out += "X-LIC-LOCATION:Europe/Berlin\r\n";
  out += "BEGIN:DAYLIGHT\r\n";
  out += "TZOFFSETFROM:+0100\r\n";
  out += "TZOFFSETTO:+0200\r\n";
  out += "TZNAME:CEST\r\n";
  out += "DTSTART:19700329T020000\r\n";
  out += "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\n";
  out += "END:DAYLIGHT\r\n";
  out += "BEGIN:STANDARD\r\n";
  out += "TZOFFSETFROM:+0200\r\n";
  out += "TZOFFSETTO:+0100\r\n";
  out += "TZNAME:CET\r\n";
  out += "DTSTART:19701025T030000\r\n";
  out += "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\n";
  out += "END:STANDARD\r\n";
  out += "END:VTIMEZONE\r\n";

  for (let d = new Date(start.getTime()); d <= end; d = new Date(d.getTime() + 86400000)) {
    const shift = shiftForDate(fiber, team, d);
    if (!shift || String(shift).toLowerCase() === "frei") continue;

    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();

    let dtStart, dtEnd, summary;

    if (String(shift).toLowerCase() === "früh") {
      dtStart = fmtLocal(y, m, day, 6, 0, 0);
      dtEnd   = fmtLocal(y, m, day, 14, 0, 0);
      summary = `Frühschicht P${team}`;

    } else if (String(shift).toLowerCase() === "spät") {
      dtStart = fmtLocal(y, m, day, 14, 0, 0);
      dtEnd   = fmtLocal(y, m, day, 22, 0, 0);
      summary = `Spätschicht P${team}`;

    } else if (String(shift).toLowerCase() === "nacht") {
      const nextDay = new Date(Date.UTC(y, d.getUTCMonth(), day + 1));

      dtStart = fmtLocal(y, m, day, 22, 0, 0);
      dtEnd   = fmtLocal(
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
    out += `DTSTAMP:${fmtDT(new Date())}\r\n`;
    out += `DTSTART;TZID=Europe/Berlin:${dtStart}\r\n`;
    out += `DTEND;TZID=Europe/Berlin:${dtEnd}\r\n`;
    out += `SUMMARY:${summary}\r\n`;
    out += "END:VEVENT\r\n";
  }

  out += "END:VCALENDAR\r\n";

  const filename = `Fiber${fiber}_P${team}_${year}.ics`;

  return new Response(out, {
    headers: {
      "content-type":"text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control":"no-store, no-cache, must-revalidate, max-age=0"
    }
  });
}
