import { clampAllowedYear, parseIntParam, shiftForDate, isHolidayRLP, getFerienSetForYear, isFerien, teamLabel, TEL, safeHtml } from "./_common.js";

const SHIFT_COLORS = {
  "F": "#ffff00",
  "S": "#ff0000",
  "N": "#00b0f0",
};

const HOLIDAY_BG = "#ffc8c8";
const VACATION_BG = "#c8dcff";
const HEADER_BG = "#c6e0b4";

const WD2 = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function shiftLetter(shift){
  const s = String(shift||"").toLowerCase();
  if (s === "früh") return "F";
  if (s === "spät") return "S";
  if (s === "nacht") return "N";
  return "";
}

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


  // Like Excel "V1": 12 months stacked; each month 3 rows: Wochentag, Tag (colored holiday/vac), Schicht (colored F/S/N)
  let monthsHtml = "";
  for (let m = 0; m < 12; m++) {
    const monthName = MONTHS_DE[m];
    const lastDay = new Date(Date.UTC(year, m+1, 0)).getUTCDate();

    // Build rows
    let rowWeek = `<tr><th class="mlabel" rowspan="3">${safeHtml(monthName)}</th>`;
    let rowDay  = `<tr>`;
    let rowShift= `<tr>`;

    for (let d = 1; d <= 31; d++) {
      if (d > lastDay) {
        rowWeek += `<td class="cell"></td>`;
        rowDay  += `<td class="cell"></td>`;
        rowShift+= `<td class="cell"></td>`;
        continue;
      }
      const dateObj = new Date(Date.UTC(year, m, d));
      const wd = WD2[dateObj.getUTCDay()];
      const holiday = isHolidayRLP(dateObj);
      const vacation = !holiday && isFerien(ferienSet, dateObj);
      const dayStyle = holiday ? `background:${HOLIDAY_BG}` : (vacation ? `background:${VACATION_BG}` : "");

      const shift = shiftForDate(fiber, team, dateObj);
      const letter = shiftLetter(shift);
      const shiftStyle = letter ? `background:${SHIFT_COLORS[letter]};font-weight:900;` : "";

      rowWeek += `<td class="cell">${safeHtml(wd)}</td>`;
      rowDay  += `<td class="cell" style="${dayStyle}">${d}</td>`;
      rowShift+= `<td class="cell" style="${shiftStyle}">${letter}</td>`;
    }

    rowWeek += `</tr>`;
    rowDay  += `</tr>`;
    rowShift+= `</tr>`;

    monthsHtml += rowWeek + rowDay + rowShift;
  }

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${safeHtml(title)}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#fff;color:#000}

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
  th.mlabel{width:90px;font-weight:700}
  th.rlabel{width:72px;background:${HEADER_BG}}
  td.cell{width:22px}
  @media print{
    @page{ size: A4 landscape; margin: 8mm; }
    body{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
    .page{padding:0}
    /* Try to keep everything on ONE page */
    h1{font-size:18px}
    .printed{font-size:10px}
    .phones{font-size:10px}
    th,td{font-size:9px; padding:2px}
  }
  .legend{margin-top:8px;text-align:center;font-size:11px}
  .legend span{display:inline-block;border:1px solid #000;padding:4px 8px;margin:0 4px}
  .feiertag{background:${HOLIDAY_BG}}
  .ferien{background:${VACATION_BG}}
  .f{background:${SHIFT_COLORS["F"]}}
  .s{background:${SHIFT_COLORS["S"]}}
  .n{background:${SHIFT_COLORS["N"]}}

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
      <tbody>
        ${monthsHtml}
      </tbody>
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
  window.addEventListener("focus", () => {
    setTimeout(exitPrint, 150);
  }, { once: true });

</script>
</body>
</html>`;

  return new Response(html, { headers: { "content-type":"text/html; charset=utf-8" }});
}
