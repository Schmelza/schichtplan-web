// Common helpers for Cloudflare Pages Functions

const MIN_YEAR = 2026;

const TEL = {
  fiber1: {
    b: "Büro: 06542/802277",
    m: "Mobil: 06542/802508",
    t: "Teamleiter: 06542/802594",
  },
  fiber2: {
    b: "Büro: 06542/802273",
    m: "Mobil: 06542/802505",
    t: "Teamleiter: 06542/802530",
  }
};

function parseIntParam(url, key) {
  const v = url.searchParams.get(key);
  const n = Number(v);
  if (!Number.isFinite(n) || String(Math.trunc(n)) !== String(v)) return null;
  return Math.trunc(n);
}

function clampAllowedYear(year) {
  const now = new Date();
  const maxYear = now.getFullYear() + 5;
  const minYear = Math.max(MIN_YEAR, now.getFullYear());
  if (year < minYear || year > maxYear) return { ok:false, minYear, maxYear };
  return { ok:true, minYear, maxYear };
}

function getRhythm(fiber, team) {
  // 28-day rhythm exactly like VBA you pasted (reference date 2026-01-01 pos 0)
  const t = String(team);
  if (fiber === 2) {
    switch (t) {
      case "1": return ["Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh"];
      case "2": return ["Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät"];
      case "3": return ["Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht"];
      case "4": return ["Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei"];
      default: return null;
    }
  } else if (fiber === 1) {
    switch (t) {
      case "1": return ["Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät"];
      case "2": return ["Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht"];
      case "3": return ["Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei"];
      case "4": return ["Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh"];
      default: return null;
    }
  }
  return null;
}

function shiftForDate(fiber, team, dateObj) {
  const rhythm = getRhythm(fiber, team);
  if (!rhythm) return null;

  const ref = new Date(Date.UTC(2026,0,1)); // 2026-01-01 UTC
  const cur = new Date(Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()));
  const diffDays = Math.floor((cur - ref) / 86400000);
  let pos = ((0 + diffDays) % 28 + 28) % 28;
  return rhythm[pos];
}

function easterDate(year) {
  // Gregorian Easter (Gauss / Meeus)
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
  const month = Math.floor((h + L - 7 * m + 114) / 31); // 3=March,4=April
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function isHolidayRLP(dateObj) {
  const y = dateObj.getUTCFullYear();
  const m = dateObj.getUTCMonth() + 1;
  const d = dateObj.getUTCDate();
  const fixed = (mm, dd) => (m === mm && d === dd);

  if (fixed(1,1)) return true;
  if (fixed(5,1)) return true;
  if (fixed(10,3)) return true;
  if (fixed(12,25)) return true;
  if (fixed(12,26)) return true;

  const ost = easterDate(y);
  const daysFromEaster = Math.floor((dateObj - ost) / 86400000);
  // Karfreitag -2, Ostermontag +1, Christi Himmelfahrt +39, Pfingstmontag +50, Fronleichnam +60
  if (daysFromEaster === -2) return true;
  if (daysFromEaster === 1) return true;
  if (daysFromEaster === 39) return true;
  if (daysFromEaster === 50) return true;
  if (daysFromEaster === 60) return true;

  return false;
}

// Ferien ICS caching
const FERIEN_URL = "https://www.feiertage-deutschland.de/kalender-download/ics/schulferien-rheinland-pfalz.ics";
let ferienCache = { fetchedAt: 0, daysByYear: new Map() };

async function getFerienSetForYear(year) {
  const now = Date.now();
  // refresh every 24h
  const needsFetch = (now - ferienCache.fetchedAt) > 24*60*60*1000 || ferienCache.daysByYear.size === 0;

  if (needsFetch) {
    try{
      const res = await fetch(FERIEN_URL, { headers: { "User-Agent":"schichtplan-web" }});
      if (res.ok) {
        const text = await res.text();
        ferienCache = { fetchedAt: now, daysByYear: parseFerienICS(text) };
      }
    }catch(_e){
      // keep old cache if any
    }
  }

  return ferienCache.daysByYear.get(year) || new Set();
}

function parseICSDate(line) {
  // expects YYYYMMDD
  const m = line.match(/:(\d{8})/);
  if (!m) return null;
  const s = m[1];
  const y = Number(s.slice(0,4));
  const mo = Number(s.slice(4,6));
  const d = Number(s.slice(6,8));
  if (!Number.isFinite(y)||!Number.isFinite(mo)||!Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo-1, d));
}

function parseFerienICS(text) {
  const map = new Map(); // year -> Set(yyyy-mm-dd)
  const blocks = text.split("BEGIN:VEVENT");
  for (const b of blocks) {
    if (!b.includes("DTSTART")) continue;
    const lines = b.split(/\r?\n/);
    const dtStartLine = lines.find(l => l.startsWith("DTSTART"));
    const dtEndLine = lines.find(l => l.startsWith("DTEND"));
    const ds = dtStartLine ? parseICSDate(dtStartLine) : null;
    if (!ds) continue;
    let de = dtEndLine ? parseICSDate(dtEndLine) : null;
    if (!de) de = new Date(ds.getTime());
    else de = new Date(de.getTime() - 86400000); // DTEND exclusive -> -1 day

    for (let cur = new Date(ds.getTime()); cur <= de; cur = new Date(cur.getTime() + 86400000)) {
      const y = cur.getUTCFullYear();
      const key = `${y}-${String(cur.getUTCMonth()+1).padStart(2,'0')}-${String(cur.getUTCDate()).padStart(2,'0')}`;
      if (!map.has(y)) map.set(y, new Set());
      map.get(y).add(key);
    }
  }
  return map;
}

function isFerien(setForYear, dateObj) {
  const key = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth()+1).padStart(2,'0')}-${String(dateObj.getUTCDate()).padStart(2,'0')}`;
  return setForYear.has(key);
}

function teamLabel(team) {
  const n = Number(team);
  const romans = ["","P I","P II","P III","P IV"];
  if (n>=1 && n<=4) return romans[n];
  return "P " + String(team);
}

function safeHtml(s){
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// --- D1 Stats helpers -------------------------------------------------------
// We keep stats in a single row per (fiber, team, year).
// The schema can evolve; we apply safe, idempotent migrations at runtime.
async function ensureStatsSchema(db){
  if (!db) return;

  // Base table (legacy columns kept).
  await db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      fiber INTEGER NOT NULL,
      team  INTEGER NOT NULL,
      year  INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      last_ts TEXT,
      PRIMARY KEY (fiber, team, year)
    );
  `);

  // New columns for post-generate actions.
  const alters = [
    "ALTER TABLE stats ADD COLUMN ics_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE stats ADD COLUMN last_ics_ts TEXT",
    "ALTER TABLE stats ADD COLUMN pdfv1_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE stats ADD COLUMN last_pdfv1_ts TEXT",
    "ALTER TABLE stats ADD COLUMN pdfv2_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE stats ADD COLUMN last_pdfv2_ts TEXT",
  ];
  for (const sql of alters){
    try { await db.exec(sql + ";"); } catch (_) { /* ignore duplicate-column errors */ }
  }
}

async function statsInc(db, { fiber, team, year, kind }){
  // kind: 'generate' | 'ics' | 'pdfv1' | 'pdfv2'
  if (!db) return;
  await ensureStatsSchema(db);

  const now = new Date().toISOString();
  if (kind === 'generate'){
    await db.prepare(`
      INSERT INTO stats (fiber, team, year, count, last_ts)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(fiber,team,year)
      DO UPDATE SET count = count + 1, last_ts = excluded.last_ts
    `).bind(fiber, team, year, now).run();
    return;
  }

  const map = {
    ics:   { c: "ics_count",   t: "last_ics_ts" },
    pdfv1: { c: "pdfv1_count", t: "last_pdfv1_ts" },
    pdfv2: { c: "pdfv2_count", t: "last_pdfv2_ts" },
  };
  const m = map[kind];
  if (!m) return;

  // Ensure row exists, then increment.
  await db.prepare(`
    INSERT INTO stats (fiber, team, year, count, last_ts)
    VALUES (?, ?, ?, 0, NULL)
    ON CONFLICT(fiber,team,year) DO NOTHING
  `).bind(fiber, team, year).run();

  await db.prepare(`
    UPDATE stats
    SET ${m.c} = COALESCE(${m.c},0) + 1,
        ${m.t} = ?
    WHERE fiber=? AND team=? AND year=?
  `).bind(now, fiber, team, year).run();
}

export {
  MIN_YEAR, TEL, parseIntParam, clampAllowedYear, shiftForDate,
  isHolidayRLP, getFerienSetForYear, isFerien, teamLabel, safeHtml,
  ensureStatsSchema, statsInc
};
