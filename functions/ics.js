// functions/ics.js
import { assertParams, shiftForDate, ymdThms, addDays } from "./_lib.js";

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dtstamp() {
  const d = new Date();
  // Zulu "yyyymmddTHHmmssZ"
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return `${z.getFullYear()}${String(z.getMonth()+1).padStart(2,"0")}${String(z.getDate()).padStart(2,"0")}T${String(z.getHours()).padStart(2,"0")}${String(z.getMinutes()).padStart(2,"0")}${String(z.getSeconds()).padStart(2,"0")}Z`;
}

function eventLine(k, v){ return `${k}:${v}\r\n`; }

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const fiber = parseInt(url.searchParams.get("fiber") || "", 10);
    const team  = parseInt(url.searchParams.get("team")  || "", 10);
    const year  = parseInt(url.searchParams.get("year")  || "", 10);

    assertParams({ fiber, team, year });

    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);

    let ics = "";
    ics += "BEGIN:VCALENDAR\r\n";
    ics += "VERSION:2.0\r\n";
    ics += "PRODID:-//Schichtplan Export//DE\r\n";

    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const shift = shiftForDate({ fiber, team, date: d });
      const s = String(shift).toLowerCase();
      if (!s || s === "frei") continue;

      let dtStart, dtEnd, summary;

      if (s === "früh") {
        dtStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6, 0, 0);
        dtEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 14, 0, 0);
        summary = `Frühschicht P${team}`;
      } else if (s === "spät") {
        dtStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 14, 0, 0);
        dtEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 22, 0, 0);
        summary = `Spätschicht P${team}`;
      } else if (s === "nacht") {
        dtStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 22, 0, 0);
        // Ende +1 Tag 06:00
        const next = addDays(d, 1);
        dtEnd   = new Date(next.getFullYear(), next.getMonth(), next.getDate(), 6, 0, 0);
        summary = `Nachtschicht P${team}`;
      } else {
        continue;
      }

      ics += "BEGIN:VEVENT\r\n";
      ics += eventLine("UID", uid());
      ics += eventLine("DTSTAMP", dtstamp());
      ics += eventLine("DTSTART", ymdThms(dtStart));
      ics += eventLine("DTEND", ymdThms(dtEnd));
      ics += eventLine("SUMMARY", summary);
      ics += "END:VEVENT\r\n";
    }

    ics += "END:VCALENDAR\r\n";

    const fileName = `Fiber${fiber}_P${team}_${year}.ics`;

    return new Response(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `inline; filename="${fileName}"`,
        "cache-control": "no-store",
      }
    });
  } catch (e) {
    return new Response(String(e?.message || e), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" }});
  }
}
