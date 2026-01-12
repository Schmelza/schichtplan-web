export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const fiber = String(url.searchParams.get("fiber") || "").trim();
  const team = String(url.searchParams.get("team") || "").trim();
  const yearStr = String(url.searchParams.get("year") || "").trim();

  // --- Validate ---
  if (!["1", "2"].includes(fiber)) {
    return json({ error: "fiber muss 1 oder 2 sein" }, 400);
  }
  if (!["1", "2", "3", "4"].includes(team)) {
    return json({ error: "team muss 1..4 sein" }, 400);
  }
  if (!/^\d{4}$/.test(yearStr)) {
    return json({ error: "year muss vierstellig sein" }, 400);
  }

  const year = Number(yearStr);
  const minYear = 2026;
  const maxYear = new Date().getFullYear() + 4;

  if (year < minYear || year > maxYear) {
    return json({ error: `year muss ${minYear} bis ${maxYear} sein` }, 400);
  }

  const ics = buildICS({ fiber, team, year });

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="Fiber${fiber}_P${team}_${year}.ics"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ==========================================================
//  Schicht-Rhythmus (1:1 aus VBA übernommen)
// ==========================================================
function getRhythm(fiber, team) {
  if (fiber === "2") {
    switch (team) {
      case "1":
        return ["Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh"];
      case "2":
        return ["Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät"];
      case "3":
        return ["Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht"];
      case "4":
        return ["Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei"];
    }
  } else {
    // fiber === "1"
    switch (team) {
      case "1":
        return ["Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät"];
      case "2":
        return ["Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht"];
      case "3":
        return ["Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei"];
      case "4":
        return ["Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh"];
    }
  }
  return null;
}

function getShiftForDate({ fiber, team, date }) {
  const rhythm = getRhythm(fiber, team);
  if (!rhythm) return "Frei";

  // refDate = 2026-01-01, refPos = 0 (wie VBA)
  const ref = new Date(Date.UTC(2026, 0, 1));
  const dUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysDiff = Math.floor((dUtc - ref) / 86400000);
  let pos = ((0 + daysDiff) % 28 + 28) % 28;
  return rhythm[pos];
}

// ==========================================================
//  Feiertage RLP: 1:1 wie dein VBA
// ==========================================================
function easterDate(year) {
  // Gauß
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31); // 3=Mar,4=Apr
  const day = ((h + L - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(d, days) {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function ymdUTC(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isHolidayRLP(d) {
  const y = d.getUTCFullYear();
  const easter = easterDate(y);

  const fixed = new Set([
    `${y}-01-01`,
    `${y}-05-01`,
    `${y}-10-03`,
    `${y}-12-25`,
    `${y}-12-26`,
  ]);

  if (fixed.has(ymdUTC(d))) return true;

  const movable = new Set([
    ymdUTC(addDaysUTC(easter, -2)),  // Karfreitag
    ymdUTC(addDaysUTC(easter, 1)),   // Ostermontag
    ymdUTC(addDaysUTC(easter, 39)),  // Christi Himmelfahrt
    ymdUTC(addDaysUTC(easter, 49)),  // Pfingstsonntag (optional)
    ymdUTC(addDaysUTC(easter, 50)),  // Pfingstmontag
    ymdUTC(addDaysUTC(easter, 60)),  // Fronleichnam
  ]);

  return movable.has(ymdUTC(d));
}

// ==========================================================
//  ICS Builder (wie VBA Export_Fiber_ICS)
// ==========================================================
function formatICSDate(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  const hh = String(dt.getUTCHours()).padStart(2, "0");
  const mm = String(dt.getUTCMinutes()).padStart(2, "0");
  const ss = String(dt.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

function buildICS({ fiber, team, year }) {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));

  const now = new Date();
  const dtstamp = formatICSDate(new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds()
  ))) + "Z";

  let sb = "";
  sb += "BEGIN:VCALENDAR\r\n";
  sb += "VERSION:2.0\r\n";
  sb += "PRODID:-//Schichtplan Export//DE\r\n";

  let r = 0;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const sc = getShiftForDate({ fiber, team, date: d });
    if (!sc || sc.toLowerCase() === "frei") continue;

    let dtStart, dtEnd, summary;
    const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

    if (sc.toLowerCase() === "früh") {
      dtStart = new Date(day.getTime()); dtStart.setUTCHours(6, 0, 0, 0);
      dtEnd   = new Date(day.getTime()); dtEnd.setUTCHours(14, 0, 0, 0);
      summary = `Frühschicht P${team}`;
    } else if (sc.toLowerCase() === "spät") {
      dtStart = new Date(day.getTime()); dtStart.setUTCHours(14, 0, 0, 0);
      dtEnd   = new Date(day.getTime()); dtEnd.setUTCHours(22, 0, 0, 0);
      summary = `Spätschicht P${team}`;
    } else if (sc.toLowerCase() === "nacht") {
      dtStart = new Date(day.getTime()); dtStart.setUTCHours(22, 0, 0, 0);
      dtEnd   = new Date(day.getTime()); dtEnd.setUTCHours(6, 0, 0, 0);
      dtEnd.setUTCDate(dtEnd.getUTCDate() + 1); // +1 Tag
      summary = `Nachtschicht P${team}`;
    } else {
      continue;
    }

    const uid = `${Date.now()}${r}@schichtplan`;
    sb += "BEGIN:VEVENT\r\n";
    sb += `UID:${uid}\r\n`;
    sb += `DTSTAMP:${dtstamp}\r\n`;
    sb += `DTSTART:${formatICSDate(dtStart)}\r\n`;
    sb += `DTEND:${formatICSDate(dtEnd)}\r\n`;
    sb += `SUMMARY:${summary}\r\n`;

    // Optional: Feiertag Hinweis (nur als Beschreibung – Excel färbt, ICS nicht)
    if (isHolidayRLP(day)) {
      sb += `DESCRIPTION:Feiertag (RLP)\r\n`;
    }

    sb += "END:VEVENT\r\n";
    r++;
  }

  sb += "END:VCALENDAR\r\n";
  return sb;
}
