export async function onRequest(context) {
  const url = new URL(context.request.url);

  const fiber = Number(url.searchParams.get("fiber"));
  const team  = Number(url.searchParams.get("team"));
  const year  = Number(url.searchParams.get("year"));

  // ---------- VALIDIERUNG ----------
  if (!Number.isInteger(fiber) || !Number.isInteger(team) || !Number.isInteger(year)) {
    return new Response("fiber, team und year müssen Zahlen sein", { status: 400 });
  }

  const nowYear = new Date().getFullYear();
  const minYear = nowYear;
  const maxYear = nowYear + 4;

  if (year < minYear || year > maxYear) {
    return new Response(
      `Jahr nur erlaubt von ${minYear} bis ${maxYear}`,
      { status: 400 }
    );
  }

  // ---------- ICS GENERIEREN ----------
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatDate(d) {
    return (
      d.getUTCFullYear() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T000000Z"
    );
  }

  let ics = "";
  ics += "BEGIN:VCALENDAR\r\n";
  ics += "VERSION:2.0\r\n";
  ics += "PRODID:-//Schichtplan//DE\r\n";
  ics += "CALSCALE:GREGORIAN\r\n";

  // Beispiel-Schicht-Rotation (anpassbar)
  const shifts = ["Frühschicht", "Spätschicht", "Nachtschicht"];
  let shiftIndex = 0;

  let date = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  while (date < end) {
    const start = new Date(date);
    const endDate = new Date(date);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    ics += "BEGIN:VEVENT\r\n";
    ics += `UID:${year}-${fiber}-${team}-${date.getTime()}@schichtplan\r\n`;
    ics += `DTSTAMP:${formatDate(new Date())}\r\n`;
    ics += `DTSTART:${formatDate(start)}\r\n`;
    ics += `DTEND:${formatDate(endDate)}\r\n`;
    ics += `SUMMARY:${shifts[shiftIndex]} (Fiber ${fiber}, Team ${team})\r\n`;
    ics += "END:VEVENT\r\n";

    shiftIndex = (shiftIndex + 1) % shifts.length;
    date.setUTCDate(date.getUTCDate() + 1);
  }

  ics += "END:VCALENDAR\r\n";

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="schichtplan_${fiber}_${team}_${year}.ics"`
    }
  });
}
