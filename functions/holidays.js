// functions/holidays.js
import { addDays } from "./_lib.js";

function easterDate(year) {
  // Gauß wie VBA
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

  return new Date(year, month - 1, day);
}

export function isHolidayRLP(date) {
  const y = date.getFullYear();
  const d0 = new Date(y, date.getMonth(), date.getDate());
  const ost = easterDate(y);

  const fixed = [
    new Date(y, 0, 1),   // Neujahr
    new Date(y, 4, 1),   // 1. Mai
    new Date(y, 9, 3),   // 3. Okt
    new Date(y, 11, 25), // 25. Dez
    new Date(y, 11, 26), // 26. Dez
  ];

  for (const f of fixed) {
    if (f.getTime() === d0.getTime()) return true;
  }

  // beweglich (wie VBA)
  const beweglich = [
    addDays(ost, -2), // Karfreitag
    addDays(ost, 1),  // Ostermontag
    addDays(ost, 39), // Christi Himmelfahrt
    // Pfingstsonntag optional (VBA Kommentar) -> wir markieren NICHT extra
    addDays(ost, 50), // Pfingstmontag
    addDays(ost, 60), // Fronleichnam (RLP)
  ];

  for (const b of beweglich) {
    if (b.getTime() === d0.getTime()) return true;
  }

  return false;
}
