// functions/print.js
import {
  assertParams, shiftForDate, shiftLetter, shiftColor,
  isoDowShortDe, fullDowDe, phoneBlockForFiber, teamLabelRoman
} from "./_lib.js";
import { isHolidayRLP } from "./holidays.js";
import { isVacationRLP } from "./vacations.js";

const COLOR_FEIERTAG = "#ffc8c8"; // VBA: RGB(255,200,200)
const COLOR_FERIEN   = "#c8dcff"; // VBA: RGB(200,220,255)
const COLOR_HEADER   = "#c6e0b4"; // VBA: RGB(198,224,180)

function htmlEscape(s){
  return String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
}

function dayCount(year, month1based){
  return new Date(year, month1based, 0).getDate();
}

function monthNameDe(m){
  return ["","Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][m];
}

function styleBase(title){
  return `
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:18px;color:#000;}
    h1{margin:0;text-align:center;font-size:28px;}
    .printed{margin:6px 0 14px 0;text-align:center;font-style:italic;font-size:12px;}
    .top{display:flex;gap:12px;align-items:stretch;margin-bottom:10px;}
    .top .a{flex:1;border:1px solid #000;padding:8px;text-align:center;}
    .top .b{width:260px;border:1px solid #000;padding:8px;white-space:pre-line;text-align:center;font-size:12px;}
    table{border-collapse:collapse;width:100%;}
    td,th{border:1px solid #000;font-size:12px;padding:3px 4px;text-align:center;vertical-align:middle;}
    .hdr{background:${COLOR_HEADER};font-weight:700;}
    .legend{margin-top:10px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap;}
    .lg{border:1px solid #000;padding:6px 10px;font-weight:700;font-size:12px;}
    .lg.feiertag{background:${COLOR_FEIERTAG};}
    .lg.ferien{background:${COLOR_FERIEN};}
    .lg.f{background:#ffff00;}
    .lg.s{background:#ff0000;}
    .lg.n{background:#00b0f0;}
    @media print{
      body{margin:0;}
    }
  </style>`;
}

function renderTop({ year, fiber, team }){
  const t = teamLabelRoman(team);
  const { telB, telM, telT } = phoneBlockForFiber(fiber);
  return `
    <div class="top">
      <div class="a">
        <h1>Schichtplan ${year} – Fiber ${fiber} – Team P${team} (${t})</h1>
        <div class="printed">Printed by: Johannes Trippen©</div>
      </div>
      <div class="b">${htmlEscape(telB)}\n${htmlEscape(telM)}\n${htmlEscape(telT)}</div>
    </div>
  `;
}

// =======================
// V1 = Monate untereinander, genau wie Excel-Logik (ohne unnötiges "Info")
// Spalten: Monat (merged) + für jeden Tag: Wochentag/Tag/Schicht
// =======================
async function renderV1({ year, fiber, team }){
  let rows = "";

  for (let m = 1; m <= 12; m++){
    const days = dayCount(year, m);
    // 3 Zeilen pro Monat: Wochentag, Tag (mit Ferien/Feiertag), Schicht (F/S/N)
    rows += `<tr>
      <td class="hdr" rowspan="3" style="min-width:90px;font-weight:700;">${htmlEscape(monthNameDe(m))}</td>
      ${Array.from({length:31}).map((_,i)=>{
        const day = i+1;
        if(day>days) return `<td></td>`;
        const d = new Date(year, m-1, day);
        return `<td>${isoDowShortDe(d)}</td>`;
      }).join("")}
    </tr>`;

    // Tag-Zeile: NUR hier Ferien/Feiertag Hintergrund wie Excel
    const tagCells = [];
    for(let day=1; day<=31; day++){
      if(day>days){ tagCells.push(`<td></td>`); continue; }
      const d = new Date(year, m-1, day);
      const isH = isHolidayRLP(d);
      const isV = !isH ? await isVacationRLP(d) : false;
      const bg = isH ? COLOR_FEIERTAG : (isV ? COLOR_FERIEN : "");
      tagCells.push(`<td style="${bg?`background:${bg};`:``}font-weight:700;">${day}</td>`);
    }
    rows += `<tr>${tagCells.join("")}</tr>`;

    // Schicht-Zeile: nur F/S/N farbig
    const schCells = [];
    for(let day=1; day<=31; day++){
      if(day>days){ schCells.push(`<td></td>`); continue; }
      const d = new Date(year, m-1, day);
      const shift = shiftForDate({ fiber, team, date: d });
      const letter = shiftLetter(shift);
      const col = shiftColor(letter);
      schCells.push(`<td style="${col?`background:${col};font-weight:700;`:``}">${htmlEscape(letter)}</td>`);
    }
    rows += `<tr>${schCells.join("")}</tr>`;
  }

  return `
    ${styleBase("Druck V1")}
    ${renderTop({year,fiber,team})}
    <table>
      <tr>
        <th class="hdr">Monat</th>
        ${Array.from({length:31}).map((_,i)=>`<th class="hdr">${i+1}</th>`).join("")}
      </tr>
      ${rows}
    </table>
    <div class="legend">
      <div class="lg feiertag">Feiertag</div>
      <div class="lg ferien">Ferien</div>
      <div class="lg f">F = Früh</div>
      <div class="lg s">S = Spät</div>
      <div class="lg n">N = Nacht</div>
    </div>
    <script>window.onload=()=>{ setTimeout(()=>window.print(), 150); };</script>
  `;
}

// =======================
// V2 = Monate nebeneinander (3 Spalten je Monat):
// Mark (Ferien/Feiertag), Tag, Text(Wochentag) farbig nach Schicht
// WICHTIG: Ferien/Feiertag färbt NUR Mark-Spalte (wie Excel), nicht Schicht-Feld.
// =======================
async function renderV2({ year, fiber, team }){
  let header = `<tr>${Array.from({length:12}).map((_,i)=>{
    const m=i+1;
    return `<th class="hdr" colspan="3">${htmlEscape(monthNameDe(m))}</th>`;
  }).join("")}</tr>`;

  let body = "";
  for(let day=1; day<=31; day++){
    const cells = [];
    for(let m=1; m<=12; m++){
      const days = dayCount(year, m);
      if(day>days){
        cells.push(`<td></td><td></td><td></td>`);
        continue;
      }
      const d = new Date(year, m-1, day);

      const isH = isHolidayRLP(d);
      const isV = !isH ? await isVacationRLP(d) : false;

      const markBg = isH ? COLOR_FEIERTAG : (isV ? COLOR_FERIEN : "");

      const shift = shiftForDate({ fiber, team, date: d });
      const letter = shiftLetter(shift);
      const schBg = shiftColor(letter);

      // MARK: nur Ferien/Feiertag
      cells.push(`<td style="${markBg?`background:${markBg};`:``}"></td>`);

      // TAG: nur Zahl
      cells.push(`<td style="font-weight:700;">${day}</td>`);

      // TEXT: Wochentag, farbig nach Schicht
      cells.push(`<td style="${schBg?`background:${schBg};`:``}font-weight:700;">${htmlEscape(fullDowDe(d))}</td>`);
    }
    body += `<tr>${cells.join("")}</tr>`;
  }

  return `
    ${styleBase("Druck V2")}
    ${renderTop({year,fiber,team})}
    <table>
      ${header}
      ${body}
    </table>
    <div class="legend">
      <div class="lg feiertag">Feiertag</div>
      <div class="lg ferien">Ferien</div>
      <div class="lg f">F = Früh</div>
      <div class="lg s">S = Spät</div>
      <div class="lg n">N = Nacht</div>
    </div>
    <script>window.onload=()=>{ setTimeout(()=>window.print(), 150); };</script>
  `;
}

export async function onRequestGet({ request }) {
  try{
    const url = new URL(request.url);
    const v = parseInt(url.searchParams.get("v") || "1", 10);
    const fiber = parseInt(url.searchParams.get("fiber") || "", 10);
    const team  = parseInt(url.searchParams.get("team")  || "", 10);
    const year  = parseInt(url.searchParams.get("year")  || "", 10);

    assertParams({ fiber, team, year });

    const html = v === 2
      ? await renderV2({ year, fiber, team })
      : await renderV1({ year, fiber, team });

    return new Response(`<!doctype html><html><head><meta charset="utf-8"><title>Druck V${v}</title></head><body>${html}</body></html>`, {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control":"no-store" }
    });
  }catch(e){
    return new Response(String(e?.message || e), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" }});
  }
}
