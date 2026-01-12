export async function onRequest({ request }) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));

  if (!Number.isInteger(year)) {
    return new Response(JSON.stringify({ detail: "year muss eine Zahl sein" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const FERIEN_URL =
    "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-rheinland-pfalz.ics";

  let icsText = "";
  try {
    const res = await fetch(FERIEN_URL, {
      headers: { "User-Agent": "schichtplan-web" }
    });
    if (!res.ok) throw new Error("ICS Download fehlgeschlagen");
    icsText = await res.text();
  } catch (e) {
    // crash-sicher wie VBA -> einfach leere Ferienliste
    return new Response(JSON.stringify({ year, dates: [], warning: "Ferien-ICS konnte nicht geladen werden" }), {
      headers: { "Content-Type": "application/json" }
    });
  }

  const dates = new Set();

  function getICSDateFromBlock(block, key) {
    const idx = block.indexOf(key);
    if (idx === -1) return null;

    // Zeile holen
    const lineStart = block.lastIndexOf("\n", idx);
    const lineEnd = block.indexOf("\n", idx);
    const line = block.slice(lineStart === -1 ? 0 : lineStart + 1, lineEnd === -1 ? block.length : lineEnd).trim();

    const p = line.indexOf(":");
    if (p === -1) return null;

    let ds = line.slice(p + 1).trim();
    ds = ds.slice(0, 8); // nur YYYYMMDD
    if (ds.length !== 8) return null;

    const y = Number(ds.slice(0, 4));
    const m = Number(ds.slice(4, 6));
    const d = Number(ds.slice(6, 8));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

    // UTC Datum
    return new Date(Date.UTC(y, m - 1, d));
  }

  function isoDateUTC(dt) {
    return dt.toISOString().slice(0, 10);
  }

  // VEVENT Blöcke parsen (wie VBA)
  let pos = 0;
  while (true) {
    const bStart = icsText.indexOf("BEGIN:VEVENT", pos);
    if (bStart === -1) break;

    const bEnd = icsText.indexOf("END:VEVENT", bStart);
    if (bEnd === -1) break;

    const block = icsText.slice(bStart, bEnd);

    const dtStart = getICSDateFromBlock(block, "DTSTART");
    let dtEnd = getICSDateFromBlock(block, "DTEND");

    if (dtStart) {
      if (!dtEnd) {
        dtEnd = new Date(dtStart);
      } else {
        // ICS: DTEND exklusiv -> -1 Tag (wie VBA)
        dtEnd = new Date(dtEnd.getTime() - 24 * 60 * 60 * 1000);
      }

      // Tage eintragen
      for (let d = new Date(dtStart); d <= dtEnd; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
        if (d.getUTCFullYear() === year) dates.add(isoDateUTC(d));
      }
    }

    pos = bEnd + 9;
  }

  return new Response(JSON.stringify({ year, dates: Array.from(dates).sort() }, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
