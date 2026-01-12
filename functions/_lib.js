// functions/_lib.js
// 1:1 aus VBA-Rhythmus übertragen (28 Tage) + Helfer

export const MIN_YEAR = 2026;

export function maxYearNowPlus4() {
  const y = new Date().getFullYear();
  return y + 4;
}

export function assertParams({ fiber, team, year }) {
  if (![1, 2].includes(fiber)) throw new Error("fiber muss 1 oder 2 sein");
  if (![1, 2, 3, 4].includes(team)) throw new Error("team muss 1 bis 4 sein");
  if (!Number.isFinite(year)) throw new Error("year muss Zahl sein");
  const maxY = maxYearNowPlus4();
  if (year < MIN_YEAR || year > maxY) throw new Error(`year muss ${MIN_YEAR} bis ${maxY} sein`);
}

export function pad2(n) { return String(n).padStart(2, "0"); }

export function ymd(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

export function ymdThms(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function isoDowShortDe(d) {
  // VBA V1 nutzt Left$(Format(d,"ddd"),2) -> Mo, Di, Mi, ...
  const map = ["So","Mo","Di","Mi","Do","Fr","Sa"];
  return map[d.getDay()];
}

export function fullDowDe(d) {
  // für V2 "dddd"
  const map = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
  return map[d.getDay()];
}

export function phoneBlockForFiber(fiber) {
  // VBA: prefix fiber1 -> 277/508/594, else fiber2 -> 273/505/530
  if (fiber === 1) {
    return {
      telB: "Büro: 06542/802277",
      telM: "Mobil: 06542/802508",
      telT: "Teamleiter: 06542/802594",
    };
  }
  return {
    telB: "Büro: 06542/802273",
    telM: "Mobil: 06542/802505",
    telT: "Teamleiter: 06542/802530",
  };
}

export function teamLabelRoman(team) {
  return team === 1 ? "P I" : team === 2 ? "P II" : team === 3 ? "P III" : "P IV";
}

// ======================
//  RHYTHMEN 1:1 VBA
// ======================
const FIBER2 = {
  1: ["Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh"],
  2: ["Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät"],
  3: ["Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht"],
  4: ["Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei"],
};

const FIBER1 = {
  1: ["Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät"],
  2: ["Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht"],
  3: ["Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei"],
  4: ["Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh"],
};

export function rhythmFor(fiber, team) {
  return (fiber === 1 ? FIBER1 : FIBER2)[team];
}

// VBA: refDate=2026-01-01, refPos=0, pos=(refPos+daysDiff) mod 28
const REF_DATE = new Date(2026, 0, 1);

export function shiftForDate({ fiber, team, date }) {
  const rhythm = rhythmFor(fiber, team);
  const daysDiff = Math.floor((date - REF_DATE) / (24 * 3600 * 1000));
  const pos = ((0 + daysDiff) % 28 + 28) % 28;
  return rhythm[pos];
}

export function shiftLetter(shift) {
  const s = String(shift || "").toLowerCase();
  if (s === "früh") return "F";
  if (s === "spät") return "S";
  if (s === "nacht") return "N";
  return "";
}

export function shiftColor(letter) {
  // Excel-Farben: F gelb, S rot, N blau (hellblau im Print)
  if (letter === "F") return "#ffff00";
  if (letter === "S") return "#ff0000";
  if (letter === "N") return "#00b0f0";
  return "";
}
