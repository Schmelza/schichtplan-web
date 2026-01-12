// functions/vacations.js
// Quelle wie VBA:
// https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-rheinland-pfalz.ics
const FERIEN_URL = "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-rheinland-pfalz.ics";

let cacheSet = null;   // Set<number> of YYYYMMDD int
let cacheTs = 0;

function ymdInt(d){
  return d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate();
}

function parseICSDate(line){
  // z.B. DTSTART;VALUE=DATE:20260701
  const idx = line.indexOf(":");
  if (idx === -1) return null;
  const s = line.slice(idx+1).trim().slice(0,8);
  if (s.length !== 8) return null;
  const y = parseInt(s.slice(0,4),10);
  const m = parseInt(s.slice(4,6),10);
  const d = parseInt(s.slice(6,8),10);
  if (!y || !m || !d) return null;
  return new Date(y, m-1, d);
}

async function loadFerienSet() {
  // einfacher Cache (12h) – reicht völlig
  const now = Date.now();
  if (cacheSet && (now - cacheTs) < 12*60*60*1000) return cacheSet;

  const r = await fetch(FERIEN_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!r.ok) {
    // wie VBA: bei Fehlern -> einfach "keine Ferien"
    cacheSet = new Set();
    cacheTs = now;
    return cacheSet;
  }

  const text = await r.text();
  const lines = text.split(/\r?\n/);

  const set = new Set();
  let inEvent = false;
  let dtStart = null;
  let dtEnd = null;

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      dtStart = null;
      dtEnd = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && dtStart) {
        let end = dtEnd ? new Date(dtEnd) : new Date(dtStart);
        if (dtEnd) {
          // ICS: DTEND exklusiv -> -1 Tag
          end.setDate(end.getDate() - 1);
        }
        const cur = new Date(dtStart);
        while (cur <= end) {
          set.add(ymdInt(cur));
          cur.setDate(cur.getDate() + 1);
        }
      }
      inEvent = false;
      continue;
    }

    if (!inEvent) continue;

    if (line.startsWith("DTSTART")) dtStart = parseICSDate(line);
    if (line.startsWith("DTEND")) dtEnd = parseICSDate(line);
  }

  cacheSet = set;
  cacheTs = now;
  return cacheSet;
}

export async function isVacationRLP(date) {
  try {
    const set = await loadFerienSet();
    return set.has(ymdInt(date));
  } catch {
    return false;
  }
}
