// functions/ics.js
import { text, isFeiertagRLP, isFerienRLP, shiftForDate, daysInMonthUTC } from "./_lib.js";

function pad(n){ return String(n).padStart(2,"0"); }
function ymd(dt){
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth()+1)}${pad(dt.getUTCDate())}`;
}

export async function onRequestGet(context){
  const url = new URL(context.request.url);

  const fiber = Number(url.searchParams.get("fiber"));
  const team  = Number(url.searchParams.get("team"));
  const year  = Number(url.searchParams.get("year"));

  const nowYear = new Date().getFullYear();
  const minYear = nowYear;
  const maxYear = nowYear + 4;

  if (![1,2].includes(fiber)) return text("fiber muss 1 oder 2 sein", 400);
  if (![1,2].includes(team))  return text("team muss 1 oder 2 sein", 400);
  if (!Number.isFinite(year)) return text("year fehlt", 400);
  if (year < minYear || year > maxYear) return text(`year muss ${minYear} bis ${maxYear} sein`, 400);

  const calName = `Schichtplan ${year} Fiber ${fiber} Team P${team}`;
  let out = "";
  out += "BEGIN:VCALENDAR\r\n";
  out += "VERSION:2.0\r\n";
  out += "PRODID:-//Schichtplan Web//DE\r\n";
  out += "CALSCALE:GREGORIAN\r\n";
  out += `X-WR-CALNAME:${calName}\r\n`;

  for(let m=0;m<12;m++){
    const dim = daysInMonthUTC(year, m);
    for(let d=1; d<=dim; d++){
      const dt = new Date(Date.UTC(year, m, d));
      const shift = shiftForDate(dt, fiber, team);
      const fei = isFeiertagRLP(dt);
      const fer = await isFerienRLP(dt);

      // Titel wie du willst – hier: Schicht + Marker
      let summary = shift;
      if (fei) summary += " (Feiertag)";
      else if (fer) summary += " (Ferien)";

      const uid = `${year}${pad(m+1)}${pad(d)}-f${fiber}-p${team}@schichtplan-web`;

      out += "BEGIN:VEVENT\r\n";
      out += `UID:${uid}\r\n`;
      out += `DTSTART;VALUE=DATE:${ymd(dt)}\r\n`;
      out += `DTEND;VALUE=DATE:${ymd(new Date(dt.getTime()+86400000))}\r\n`;
      out += `SUMMARY:${summary}\r\n`;
      out += "END:VEVENT\r\n";
    }
  }

  out += "END:VCALENDAR\r\n";

  // Download-Header
  return new Response(out, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="Schichtplan_${year}_Fiber${fiber}_P${team}.ics"`,
      "cache-control": "no-store"
    }
  });
}
