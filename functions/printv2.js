import { clampAllowedYear, parseIntParam, shiftForDate, isHolidayRLP, getFerienSetForYear, isFerien, teamLabel, TEL, safeHtml } from "./_common.js";

const SHIFT_COLORS = {
  "F": "#ffff00",
  "S": "#ff0000",
  "N": "#00b0f0",
};

const HOLIDAY_BG = "#ffc8c8";
const VACATION_BG = "#c8dcff";
const HEADER_BG = "#c6e0b4";

// V2 Wunsch: kurze Wochentage (Mo/Di/...) statt voller Namen
// Reihenfolge muss zu getDay()/getUTCDay() passen: 0=So ... 6=Sa
const DAYS_DE = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function shiftLetter(shift){
  const s = String(shift||"").toLowerCase();
  if (s === "früh") return "F";
  if (s === "spät") return "S";
  if (s === "nacht") return "N";
  return "";
}

function isShiftDay(letter){ return letter === "F" || letter === "S" || letter === "N"; }

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const fiber = parseIntParam(url, "fiber");
  const team  = parseIntParam(url, "team");
  const year  = parseIntParam(url, "year");

  if (!fiber || !team || !year) return new Response("Missing params: fiber, team, year", { status: 400 });

  const yr = clampAllowedYear(year);
  if (!yr.ok) return new Response(`year muss ${yr.minYear} bis ${yr.maxYear} sein`, { status: 400 });

  const ferienSet = await getFerienSetForYear(year);

const tel = (fiber === 1 ? TEL.fiber1 : TEL.fiber2);
const title = `Schichtplan ${year} – Fiber ${fiber} - P${team}`;
const printTitle = title;


  // Build table: 12 months horizontally, each month 2 columns (Tag + Wochentag/Schicht)
  // Like your Excel "V2": Mark (holiday/vacation) | Day number | Day name + shift color
  let bodyRows = "";
  for (let dayNum = 1; dayNum <= 31; dayNum++) {
    let rowTds = "";
    for (let m = 0; m < 12; m++) {
      const lastDay = new Date(Date.UTC(year, m+1, 0)).getUTCDate();
      if (dayNum > lastDay) {
        rowTds += `<td class="mark"></td><td class="day"></td><td class="txt"></td>`;
        continue;
      }
      const d = new Date(Date.UTC(year, m, dayNum));
      const holiday = isHolidayRLP(d);
      const vacation = !holiday && isFerien(ferienSet, d);

      const markStyle = holiday ? `background:${HOLIDAY_BG}` : (vacation ? `background:${VACATION_BG}` : "");
      const dayName = DAYS_DE[d.getUTCDay()];

      const shift = shiftForDate(fiber, team, d);
      const letter = shiftLetter(shift);

      // IMPORTANT: like Excel -> only the shift cell gets shift color.
      const txtStyle = isShiftDay(letter) ? `background:${SHIFT_COLORS[letter]};` : "";

      rowTds += `<td class="mark" style="${markStyle}"></td>`;
      rowTds += `<td class="day"><b>${dayNum}</b></td>`;
      rowTds += `<td class="txt" style="${txtStyle}">${safeHtml(dayName)}</td>`;
    }
    bodyRows += `<tr>${rowTds}</tr>`;
  }

  const monthHeaders = MONTHS_DE.map(m => `<th class="mhead" colspan="3">${safeHtml(m)}</th>`).join("");

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Calibri,Arial,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#fff;color:#000}

  body.readonly{-webkit-user-select:none;user-select:none}
  body.readonly .page{pointer-events:none}
  .page{padding:18px}
  .top{
    display:grid;
    grid-template-columns: 1fr auto;
    gap:14px;
    align-items:start;
  }
  h1{margin:0;font-size:24px;text-align:center}
  .printed{margin:4px 0 0;text-align:center;font-style:italic;font-size:12px}
  .phones{font-size:11px;line-height:1.2;border:1px solid #000;padding:6px 8px;white-space:pre-line;text-align:center}
  .tablewrap{margin-top:10px;border:1px solid #000;padding:8px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #000;font-size:11px;padding:2px 4px;text-align:center;vertical-align:middle}
  th.mhead{background:${HEADER_BG};font-weight:700}
  /* Mark-Spalte (Feiertag/Ferien) etwas schmaler als die Tageszahl */
  /* Mark-Spalte (Feiertag/Ferien) etwas schmaler als Zahlenspalte */
  td.mark{width:16px}
  td.day{width:22px}
  td.txt{width:auto;font-weight:700}
  .sletter{display:inline-block;min-width:14px;font-weight:900}
  .legend{margin-top:8px;text-align:center;font-size:11px}
  .legend span{display:inline-block;border:1px solid #000;padding:4px 8px;margin:0 4px}
  .feiertag{background:${HOLIDAY_BG}}
  .ferien{background:${VACATION_BG}}
  .f{background:${SHIFT_COLORS["F"]}}
  .s{background:${SHIFT_COLORS["S"]}}
  .n{background:${SHIFT_COLORS["N"]}}
  @media print{
    /* More usable print area (height was overflowing) */
    @page{ size: A4 landscape; margin: 5mm; }

    body{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
    .page{padding:9px}

    /* Tighten header to save vertical space */
    .top{gap:10px}
    h1{font-size:19px; margin:0}
    .printed{font-size:10px; margin:3px 0 0}
    .phones{font-size:10.5px; line-height:1.1; padding:5px 7px}

    /* Tighten table area */
    .tablewrap{margin-top:8px; padding:7px;}
    table{table-layout:fixed}
    th,td{font-size:10.5px; padding:1px 3px; line-height:1.1; height:17px}

    /* Prevent weekday text from wrapping (wrap increases row height) */
    td.txt{white-space:nowrap; overflow:hidden; text-overflow:clip}

    /* Legend smaller */
    .legend{margin-top:8px; font-size:10px}
    .legend span{padding:3px 8px; margin:0 4px}
  }

  /* PWA/iOS Print helpers */
  .topbar{
    position:fixed;
    top:10px; left:10px;
    z-index:99999;
    display:flex;
    gap:10px;
    pointer-events:auto;
  }
  .topbar button{
    padding:10px 12px;
    border:1px solid #000;
    background:#fff;
    color:#000;
    border-radius:10px;
    font-size:14px;
    pointer-events:auto;
  }
  .topbar button:active{ transform: translateY(1px); }
  @media print{ .topbar{ display:none !important; } }

</style>
</head>
<body class="readonly">
<div class="topbar" role="toolbar" aria-label="Druck-Tools">
    <button type="button" onclick="(function(){ try{ if(history.length>1){ history.back(); } else { location.href='/'; } }catch(e){ location.href='/'; } })()">← Zurück</button>
    <button id="printBtn" type="button" onclick="(function(){ try{ window.print(); }catch(e){} })()">🖨️ Drucken</button>
  </div>

<div class="page">
  <div class="top">
    <div>
      <h1>${safeHtml(title)}</h1>
      <div class="printed">Printed by: Johannes Trippen©</div>
    </div>
    <div class="phones">${safeHtml(tel.b)}\n${safeHtml(tel.m)}\n${safeHtml(tel.t)}</div>
  </div>

  <div class="tablewrap">
    <table>
      <thead><tr>${monthHeaders}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>

    <div class="legend">
      <span class="feiertag">Feiertag</span>
      <span class="ferien">Ferien</span>
      <span class="f">F = Früh</span>
      <span class="s">S = Spät</span>
      <span class="n">N = Nacht</span>
    </div>
  </div>
</div>

<script>
  // Auto-open print dialog
  try{ document.title = ${JSON.stringify(printTitle)}; }catch(e){}

  function exitPrint(){
    try{
      if (history.length > 1) { history.back(); }
      else { location.href = "/"; }
    }catch(e){
      location.href = "/";
    }
  }
  window.onafterprint = exitPrint;
const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);

  // iOS (especially standalone/PWA) sometimes doesn't fire onafterprint reliably.
  // Only enable the focus fallback on iOS to avoid Firefox/desktop immediately navigating back.
  if (isIOS) {
    window.addEventListener("focus", () => {
      setTimeout(exitPrint, 150);
    }, { once: true });
  }
  </script>
</body>
</html>`;

  return new Response(html, { headers: { "content-type":"text/html; charset=utf-8" }});
}
