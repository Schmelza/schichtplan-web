// functions/generate.js
import { json, text, isFeiertagRLP, isFerienRLP, shiftForDate, daysInMonthUTC } from "./_lib.js";

export async function onRequestGet(context){
  const url = new URL(context.request.url);

  const fiber = Number(url.searchParams.get("fiber"));
  const team  = Number(url.searchParams.get("team"));
  const year  = Number(url.searchParams.get("year"));
  const mode  = (url.searchParams.get("mode") || "").toLowerCase();

  // Jahr-Limit: aktuelles Jahr bis +4
  const nowYear = new Date().getFullYear();
  const minYear = nowYear;
  const maxYear = nowYear + 4;

  if (![1,2].includes(fiber)) return text("fiber muss 1 oder 2 sein", 400);
  if (![1,2].includes(team))  return text("team muss 1 oder 2 sein", 400);
  if (!Number.isFinite(year)) return text("year fehlt", 400);
  if (year < minYear || year > maxYear) return text(`year muss ${minYear} bis ${maxYear} sein`, 400);

  // mode=data => Print-Seiten holen strukturiertes JSON
  if (mode === "data") {
    const months = [];
    for(let m=0;m<12;m++){
      const dim = daysInMonthUTC(year, m);
      const days = [];
      for(let d=1; d<=dim; d++){
        const dt = new Date(Date.UTC(year, m, d));
        const shift = shiftForDate(dt, fiber, team);
        const isFeiertag = isFeiertagRLP(dt);
        const isFerien = await isFerienRLP(dt);
        days.push({
          day: d,
          month: m+1,
          weekday: dt.getUTCDay(), // 0..6
          shift,
          isFeiertag,
          isFerien
        });
      }
      months.push({ month: m+1, days });
    }

    return json({
      meta: { fiber, team, year, minYear, maxYear },
      months
    });
  }

  // Standard: Links zurückgeben
  const origin = url.origin;
  return json({
    icsUrl: `${origin}/ics?fiber=${fiber}&team=${team}&year=${year}`,
    printV1Url: `${origin}/print_v1.html?fiber=${fiber}&team=${team}&year=${year}`,
    printV2Url: `${origin}/print_v2.html?fiber=${fiber}&team=${team}&year=${year}`
  });
}
