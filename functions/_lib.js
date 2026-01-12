// functions/_lib.js

const FERIEN_URL = "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-rheinland-pfalz.ics";

export function json(data, status=200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export function text(data, status=200, contentType="text/plain; charset=utf-8") {
  return new Response(data, {
    status,
    headers: { "content-type": contentType, "cache-control": "no-store" }
  });
}

// =============== Feiertage RLP (1:1 Logik wie VBA) ===============
function osterdatum(y){
  // Gauß
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19*a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2*e + 2*i - h - k) % 7;
  const m = Math.floor((a + 11*h + 22*L) / 451);
  const month = Math.floor((h + L - 7*m + 114) / 31);
  const day = ((h + L - 7*m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month-1, day));
}

function sameDayUTC(a,b){
  return a.getUTCFullYear()===b.getUTCFullYear() &&
         a.getUTCMonth()===b.getUTCMonth() &&
         a.getUTCDate()===b.getUTCDate();
}

export function isFeiertagRLP(dateUTC){
  const y = dateUTC.getUTCFullYear();
  const ost = osterdatum(y);

  const fixed = [
    new Date(Date.UTC(y,0,1)),   // Neujahr
    new Date(Date.UTC(y,4,1)),   // Tag der Arbeit
    new Date(Date.UTC(y,9,3)),   // Deutsche Einheit
    new Date(Date.UTC(y,11,25)), // 1. Weihnachtstag
    new Date(Date.UTC(y,11,26)), // 2. Weihnachtstag
  ];

  for (const d of fixed) if (sameDayUTC(dateUTC, d)) return true;

  // beweglich
  const addDays = (dt, n) => new Date(dt.getTime() + n*86400000);
  const movable = [
    addDays(ost, -2),  // Karfreitag
    addDays(ost, 1),   // Ostermontag
    addDays(ost, 39),  // Christi Himmelfahrt
    addDays(ost, 49),  // Pfingstsonntag (optional) -> du wolltest markieren
    addDays(ost, 50),  // Pfingstmontag
    addDays(ost, 60),  // Fronleichnam
  ];
  for (const d of movable) if (sameDayUTC(dateUTC, d)) return true;

  return false;
}

// =============== Ferien RLP aus ICS (crash-sicher wie VBA) ===============
let ferienSet = null; // Set<number> of UTC day key

function dayKeyUTC(dt){
  return Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function parseICSDate(line){
  // DTSTART;VALUE=DATE:20260701
  const idx = line.indexOf(":");
  if (idx < 0) return null;
  const s = line.slice(idx+1).trim().slice(0,8);
  if (!/^\d{8}$/.test(s)) return null;
  const y = Number(s.slice(0,4));
  const m = Number(s.slice(4,6));
  const d = Number(s.slice(6,8));
  return new Date(Date.UTC(y, m-1, d));
}

async function loadFerien(){
  try{
    const res = await fetch(FERIEN_URL, { cf: { cacheTtl: 86400, cacheEverything: true } });
    if(!res.ok) return null;
    const ics = await res.text();

    const set = new Set();
    const lines = ics.split(/\r?\n/);

    let inEvent = false;
    let dtStart = null;
    let dtEnd = null;

    for(const line of lines){
      if(line.startsWith("BEGIN:VEVENT")){
        inEvent = true; dtStart=null; dtEnd=null;
      } else if(line.startsWith("END:VEVENT")){
        if(inEvent && dtStart){
          let end = dtEnd ? new Date(dtEnd.getTime() - 86400000) : dtStart; // DTEND exklusiv -> -1 Tag
          for(let d = new Date(dtStart); d <= end; d = new Date(d.getTime()+86400000)){
            set.add(dayKeyUTC(d));
          }
        }
        inEvent = false;
      } else if(inEvent && line.startsWith("DTSTART")){
        dtStart = parseICSDate(line);
      } else if(inEvent && line.startsWith("DTEND")){
        dtEnd = parseICSDate(line);
      }
    }

    return set;
  } catch {
    return null;
  }
}

export async function isFerienRLP(dateUTC){
  if(!ferienSet){
    ferienSet = await loadFerien();
    if(!ferienSet) ferienSet = new Set(); // crash-sicher
  }
  return ferienSet.has(dayKeyUTC(dateUTC));
}

// =============== Schichtlogik (DEIN Pattern) ===============
// Hier musst du (falls nötig) dein EXACT Excel-Pattern eintragen.
// Ich lasse es bewusst so, dass du nur *eine* Stelle anfasst.
const SHIFT_PATTERN = ["F","F","S","S","N","N","F","F","S","S","N","N"]; 
// ↑ Beispiel. Wenn dein Excel eine andere Rotation hat: sag kurz das Pattern,
// dann setz ich dir das 1:1 um.

export function shiftForDate(dateUTC, fiber, team){
  // Startdatum fixieren (Excel-Start). Wenn Excel z.B. 01.01.2026 = bestimmter Shift:
  // Dann ist "anchor" dieses Datum.
  const anchor = new Date(Date.UTC(2026,0,1)); // ggf. anpassen, falls Excel anders anchored
  const days = Math.floor((dateUTC - anchor) / 86400000);

  // Fiber/Team Offset (damit P1/P2 verschoben sind). Wenn Excel anders: hier anpassen.
  const teamOffset = (team === 1 ? 0 : 2);
  const fiberOffset = (fiber === 1 ? 0 : 0);

  const idx = (days + teamOffset + fiberOffset) % SHIFT_PATTERN.length;
  const shift = SHIFT_PATTERN[(idx + SHIFT_PATTERN.length) % SHIFT_PATTERN.length];
  return shift;
}

export function daysInMonthUTC(y, m0){
  // m0: 0..11
  return new Date(Date.UTC(y, m0+1, 0)).getUTCDate();
}
