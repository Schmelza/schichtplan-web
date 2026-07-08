import { clampAllowedYear, parseIntParam, shiftForDate } from "./_common.js";

function pad(n){ return String(n).padStart(2,'0'); }
function fmtDT(dt){ // liest die UTC-Komponenten eines Date-Objekts (echtes UTC hier!)
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

// Findet den letzten Sonntag eines Monats (Tag als Zahl 1-31), UTC-Kalender.
function lastSundayOfMonth(year, month0 /* 0=Jan..11=Dez */){
  const lastDayOfMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  for (let day = lastDayOfMonth; day >= lastDayOfMonth - 6; day--) {
    if (new Date(Date.UTC(year, month0, day)).getUTCDay() === 0) return day;
  }
}

// Liefert den UTC-Offset (in Stunden) von Europe/Berlin für ein gegebenes
// Kalenderdatum - 2 (CEST/Sommerzeit) zwischen letztem Sonntag im März und
// letztem Sonntag im Oktober, sonst 1 (CET/Winterzeit). Das ist die
// EU-weite DST-Regel, exakt nachgebaut (unabhängig davon, ob Google die
// VTIMEZONE/TZID-Angabe respektiert - die Umrechnung passiert hier direkt
// im Code, wir liefern also von vornherein die korrekte, absolute UTC-Zeit).
function berlinUtcOffsetHours(year, month0, day){
  const marchLastSun = lastSundayOfMonth(year, 2);
  const octLastSun = lastSundayOfMonth(year, 9);
  const dateVal = Date.UTC(year, month0, day);
  const startCEST = Date.UTC(year, 2, marchLastSun);
  const endCEST = Date.UTC(year, 9, octLastSun);
  return (dateVal >= startCEST && dateVal < endCEST) ? 2 : 1;
}

// Baut aus "gewünschter Berliner Ortszeit" (Jahr/Monat/Tag/Stunde) die
// tatsächliche, korrekte UTC-Instanz - Sommer-/Winterzeit automatisch
// berücksichtigt.
function berlinLocalToUtc(year, month0, day, hour){
  const offset = berlinUtcOffsetHours(year, month0, day);
  return new Date(Date.UTC(year, month0, day, hour, 0, 0) - offset * 3600 * 1000);
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

  let r = 0;
  for (let d = new Date(start.getTime()); d <= end; d = new Date(d.getTime() + 86400000)) {
    const shift = shiftForDate(fiber, team, d);
    if (!shift || String(shift).toLowerCase() === "frei") continue;

    let dtStart, dtEnd, summary;
    if (String(shift).toLowerCase() === "früh") {
      dtStart = berlinLocalToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 6);
      dtEnd   = berlinLocalToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 14);
      summary = `Frühschicht P${team}`;
    } else if (String(shift).toLowerCase() === "spät") {
      dtStart = berlinLocalToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 14);
      dtEnd   = berlinLocalToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22);
      summary = `Spätschicht P${team}`;
    } else if (String(shift).toLowerCase() === "nacht") {
      dtStart = berlinLocalToUtc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 22);
      const nextDay = new Date(d.getTime() + 86400000);
      dtEnd   = berlinLocalToUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth(), nextDay.getUTCDate(), 6);
      summary = `Nachtschicht P${team}`;
    } else {
      continue;
    }

    out += "BEGIN:VEVENT\r\n";
    out += `UID:${uid(fiber, team, d)}\r\n`;
    out += `DTSTAMP:${fmtDT(new Date())}Z\r\n`;
    out += `DTSTART:${fmtDT(dtStart)}Z\r\n`;
    out += `DTEND:${fmtDT(dtEnd)}Z\r\n`;
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
