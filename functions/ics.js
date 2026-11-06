import { clampAllowedYear, parseIntParam, shiftForDate } from "./_common.js";

function pad(n){ return String(n).padStart(2,'0'); }
function fmtDT(dt){ // liest die UTC-Komponenten eines Date-Objekts (als reine Wanduhr-Zahlen genutzt)
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth()+1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}`;
}
function uid(fiber, team, dateObj){
  // Deterministisch statt zufällig: dieselbe Schicht bekommt bei jeder
  // Neu-Generierung dieselbe UID. Das ist entscheidend für Kalender-Abos
  // (webcal) - sonst erkennt der Kalender bei jedem automatischen Refresh
  // "neue" Events statt eines Updates und legt Dubletten an.
  const y = dateObj.getUTCFullYear();
  const m = pad(dateObj.getUTCMonth()+1);
  const d = pad(dateObj.getUTCDate());
  return `f${fiber}-p${team}-${y}${m}${d}@schichtplan-web`;
}

// Schicht-Zeiten sind Berliner Ortszeit (Wanduhr). Wir schreiben sie mit
// TZID=Europe/Berlin und liefern die Zeitzonen-Definition (VTIMEZONE) mit.
// Der Kalender rechnet Sommer-/Winterzeit selbst korrekt um, und der Termin
// gehoert fuer Apple/Google/Outlook zur Zeitzone Berlin (kein "GMT"-Zusatz).
// fmtDT liest die UTC-Komponenten eines Date-Objekts - hier bewusst als
// reine Wanduhr-Zahlen genutzt (06:00 bleibt 06:00).
function wallClock(year, month0, day, hour){
  return new Date(Date.UTC(year, month0, day, hour, 0, 0));
}

const VTIMEZONE_BERLIN =
  "BEGIN:VTIMEZONE\r\n" +
  "TZID:Europe/Berlin\r\n" +
  "BEGIN:DAYLIGHT\r\n" +
  "TZOFFSETFROM:+0100\r\n" +
  "TZOFFSETTO:+0200\r\n" +
  "TZNAME:CEST\r\n" +
  "DTSTART:19700329T020000\r\n" +
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU\r\n" +
  "END:DAYLIGHT\r\n" +
  "BEGIN:STANDARD\r\n" +
  "TZOFFSETFROM:+0200\r\n" +
  "TZOFFSETTO:+0100\r\n" +
  "TZNAME:CET\r\n" +
  "DTSTART:19701025T030000\r\n" +
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\r\n" +
  "END:STANDARD\r\n" +
  "END:VTIMEZONE\r\n";

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
  out += VTIMEZONE_BERLIN;

  let r = 0;
  for (let d = new Date(start.getTime()); d <= end; d = new Date(d.getTime() + 86400000)) {
    const shift = shiftForDate(fiber, team, d);
    if (!shift || String(shift).toLowerCase() === "frei") continue;

    let dtStart, dtEnd, summary;
    if (String(shift).toLowerCase() === "früh") {
      dtStart = wallClock(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 6);
      dtEnd   = wallClock(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 14);
      summary = `Frühschicht P${team}`;
    } else if (String(shift).toLowerCase() === "spät") {
      dtStart = wallClock(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 14);
      dtEnd   = wallClock(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22);
      summary = `Spätschicht P${team}`;
    } else if (String(shift).toLowerCase() === "nacht") {
      dtStart = wallClock(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22);
      const nextDay = new Date(d.getTime() + 86400000);
      dtEnd   = wallClock(nextDay.getUTCFullYear(), nextDay.getUTCMonth(), nextDay.getUTCDate(), 6);
      summary = `Nachtschicht P${team}`;
    } else {
      continue;
    }

    out += "BEGIN:VEVENT\r\n";
    out += `UID:${uid(fiber, team, d)}\r\n`;
    out += `DTSTAMP:${fmtDT(new Date())}Z\r\n`;
    out += `DTSTART;TZID=Europe/Berlin:${fmtDT(dtStart)}\r\n`;
    out += `DTEND;TZID=Europe/Berlin:${fmtDT(dtEnd)}\r\n`;
    out += `SUMMARY:${summary}\r\n`;
    out += "END:VEVENT\r\n";
    r++;
  }

  out += "END:VCALENDAR\r\n";

  const filename = `Fiber${fiber}_P${team}_${year}.ics`;

  return new Response(out, {
    headers: {
      "content-type":"text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}
