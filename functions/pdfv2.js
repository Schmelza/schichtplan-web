
import { clampAllowedYear, parseIntParam, shiftForDate, isHolidayRLP, getFerienSetForYear, isFerien, TEL } from "./_common.js";

const SHIFT_COLORS = { "F": "#ffff00", "S": "#ff0000", "N": "#00b0f0" };
const HOLIDAY_BG = "#ffc8c8";
const VACATION_BG = "#c8dcff";
const HEADER_BG  = "#c6e0b4";

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


// Minimal PDF generator (no deps) for consistent A4 landscape output.
const A4_LANDSCAPE = { w: 842, h: 595 }; // points (1/72 inch)

function pdfEscape(str){
  // PDF strings are byte-strings for the built-in fonts (WinAnsi). We keep the PDF file UTF-8,
  // but encode non-ASCII characters as octal escapes so they render correctly (ÄÖÜäöüß© etc.).
  const s = String(str ?? "");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);

    // Escape special PDF string chars
    if (code === 0x5C) { out += "\\"; continue; } // backslash
    if (code === 0x28) { out += "\("; continue; }  // (
    if (code === 0x29) { out += "\)"; continue; }  // )

    // ASCII is safe as-is
    if (code >= 0x20 && code <= 0x7E) { out += s[i]; continue; }

    // Map anything in 0..255 to a single byte using octal escape
    if (code <= 0xFF) {
      const oct = code.toString(8).padStart(3, "0");
      out += "\\" + oct;
      continue;
    }

    // Fallback for characters outside WinAnsi
    out += "?";
  }
  return out;
}

function rgbHexTo01(hex){
  const h = String(hex||"").replace("#","").trim();
  if (h.length !== 6) return [0,0,0];
  const r = parseInt(h.slice(0,2),16)/255;
  const g = parseInt(h.slice(2,4),16)/255;
  const b = parseInt(h.slice(4,6),16)/255;
  return [r,g,b];
}

function fmt(n){ return (Math.round(n*1000)/1000).toString(); }

function buildPdf({ title, printedBy, telLines, drawContent }){
  const { w, h } = A4_LANDSCAPE;

  // PDF objects
  const objects = [];
  const offsets = [];

  function addObject(str){
    objects.push(str);
    return objects.length; // 1-based obj number
  }

  // Font object (Helvetica)
  const fontObj = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  // Content stream placeholder; fill later
  let content = "";
  const ops = [];
  const push = (s)=>ops.push(s);

  // Graphics helpers
  function setStrokeRGB(r,g,b){ push(`${fmt(r)} ${fmt(g)} ${fmt(b)} RG`); }
  function setFillRGB(r,g,b){ push(`${fmt(r)} ${fmt(g)} ${fmt(b)} rg`); }
  function setLineWidth(w){ push(`${fmt(w)} w`); }
  function rect(x,y,w,h){ push(`${fmt(x)} ${fmt(y)} ${fmt(w)} ${fmt(h)} re`); }
  function fill(){ push("f"); }
  function stroke(){ push("S"); }
  function fillStroke(){ push("B"); }
  function text(x,y,size,str){
    // Ensure text is always black for readability
    push("0 0 0 rg");
    push("BT");
    push(`/F1 ${fmt(size)} Tf`);
    push(`${fmt(x)} ${fmt(y)} Td`);
    push(`(${pdfEscape(str)}) Tj`);
    push("ET");
  }
  function clipRect(x,y,w,h){
    push("q");
    rect(x,y,w,h);
    push("W n");
  }
  function restore(){ push("Q"); }

  // Draw page content via callback
  drawContent({
    w, h,
    setStrokeRGB, setFillRGB, setLineWidth, rect, fill, stroke, fillStroke, text, clipRect, restore,
    rgbHexTo01,
    title, printedBy, telLines
  });

  content = ops.join("\n");
  const contentStream = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  const contentObj = addObject(contentStream);

  // Page / Pages / Catalog
  const pageObjNum = objects.length + 1;
  const pagesObjNum = objects.length + 2;
  const catalogObjNum = objects.length + 3;

  const pageObj = `<< /Type /Page /Parent ${pagesObjNum} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 ${fontObj} 0 R >> >> /Contents ${contentObj} 0 R >>`;
  objects.push(pageObj);

  const pagesObj = `<< /Type /Pages /Kids [${pageObjNum} 0 R] /Count 1 >>`;
  objects.push(pagesObj);

  const catalogObj = `<< /Type /Catalog /Pages ${pagesObjNum} 0 R >>`;
  objects.push(catalogObj);

  // Build xref
  let pdf = "%PDF-1.4\n";
  offsets.push(0); // object 0
  for (let i=0;i<objects.length;i++){
    offsets.push(pdf.length);
    pdf += `${i+1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = pdf.length;
  pdf += "xref\n";
  pdf += `0 ${objects.length+1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i=1;i<offsets.length;i++){
    const off = String(offsets[i]).padStart(10,"0");
    pdf += `${off} 00000 n \n`;
  }
  pdf += "trailer\n";
  pdf += `<< /Size ${objects.length+1} /Root ${catalogObjNum} 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
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
  const title = `Schichtplan ${year}  Fiber ${fiber} - P${team}`;
  const printedBy = "Printed by: Johannes Trippen©";
  const telLines = [tel.b, tel.m, tel.t];

  const pdfBytes = buildPdf({
    title,
    printedBy,
    telLines,
    drawContent: ({ w, h, setStrokeRGB, setFillRGB, setLineWidth, rect, fill, stroke, text, clipRect, restore, rgbHexTo01 }) => {
      // --- Text width helpers (Courier is fixed-width: 600 units => 0.6 * fontSize per char) ---
      const _tw = (s, size) => String(s ?? "").length * size * 0.6;
      const _tc = (cx, y, size, s) => text(cx - _tw(s, size) / 2, y, size, s);

      const margin = 24;
      const headerH = 62;
      const legendH = 26;
      const tableTopY = h - margin - headerH;
      const tableBottomY = margin + legendH + 10;
      const tableH = tableTopY - tableBottomY;
      const usableW = w - margin*2;

      // Header
      setFillRGB(0,0,0); setStrokeRGB(0,0,0);
      _tc(w/2, h - margin - 24, 18, title);
      text(margin, h - margin - 42, 11, printedBy);
// Tel box right
      const boxW = 190, boxH = 44;
      const boxX = w - margin - boxW;
      const boxY = h - margin - boxH - 8;
      setLineWidth(1);
      rect(boxX, boxY, boxW, boxH);
      stroke();
      
function centerPhone(line, yOffset){
  const tw = _tw(line, 9.5);
  text(boxX + boxW/2 - tw/2, boxY + yOffset, 9.5, line);
}
centerPhone(telLines[0], 28);
centerPhone(telLines[1], 16);
centerPhone(telLines[2], 4);


      // Table layout for V2: 12 months across, each month 3 columns.
      const headerRowH = 16;
      const rows = 31;
      const rowH = (tableH - headerRowH) / rows;

      // Base widths (scaled to fill width)
      const baseMark = 12, baseDay = 21, baseTxt = 30;
      const monthW = baseMark + baseDay + baseTxt; // 63
      const totalBase = monthW * 12;
      const scale = usableW / totalBase;

      const markW = baseMark * scale;
      const dayW  = baseDay  * scale;
      const txtW  = baseTxt  * scale;
      const monthWidth = monthW * scale;

      const startX = margin;
      let y = tableTopY;

      // Month headers
      setLineWidth(0.6);
      setStrokeRGB(0,0,0);
      const [hr,hg,hb] = rgbHexTo01(HEADER_BG);
      for (let m = 0; m < 12; m++) {
        const x = startX + m * monthWidth;
        setFillRGB(hr,hg,hb);
        rect(x, y - headerRowH, monthWidth, headerRowH);
        fill();
        setStrokeRGB(0,0,0);
        rect(x, y - headerRowH, monthWidth, headerRowH);
        stroke();

        clipRect(x, y - headerRowH, monthWidth, headerRowH);
        const mw = MONTHS_DE[m].length * 4.6;
        text(x + monthWidth/2 - mw/2, y - headerRowH + 4, 10.5, MONTHS_DE[m]);
restore();
      }
      y -= headerRowH;

      // Body rows 1..31
      for (let dayNum = 1; dayNum <= 31; dayNum++) {
        const rowYBottom = y - rowH;
        for (let m = 0; m < 12; m++) {
          const x0 = startX + m * monthWidth;
          const lastDay = new Date(Date.UTC(year, m+1, 0)).getUTCDate();

          // 3 cells: mark | day | txt (weekday)
          const markX = x0;
          const dayX  = x0 + markW;
          const txtX  = x0 + markW + dayW;

          // Borders
          rect(markX, rowYBottom, markW, rowH); stroke();
          rect(dayX,  rowYBottom, dayW,  rowH); stroke();
          rect(txtX,  rowYBottom, txtW,  rowH); stroke();

          if (dayNum > lastDay) continue;

          const d = new Date(Date.UTC(year, m, dayNum));
          const holiday = isHolidayRLP(d);
          const vacation = !holiday && isFerien(ferienSet, d);
          const dayName = DAYS_DE[d.getUTCDay()];

          // mark cell background
          if (holiday || vacation) {
            const col = holiday ? HOLIDAY_BG : VACATION_BG;
            const [r1,g1,b1] = rgbHexTo01(col);
            setFillRGB(r1,g1,b1);
            rect(markX, rowYBottom, markW, rowH); fill();
            setStrokeRGB(0,0,0);
            rect(markX, rowYBottom, markW, rowH); stroke();
          }

          // day number
          const dn = String(dayNum);
          text(dayX + dayW/2 - (dn.length*2.8), rowYBottom + rowH/2 - 3.5, 9.5, dn);

          // weekday cell background = shift color only (like HTML): but in v2 you colored only txt cell when shift exists
          const shift = shiftForDate(fiber, team, d);
          const letter = shiftLetter(shift);
          if (isShiftDay(letter)) {
            const [r2,g2,b2] = rgbHexTo01(SHIFT_COLORS[letter]);
            setFillRGB(r2,g2,b2);
            rect(txtX, rowYBottom, txtW, rowH); fill();
            setStrokeRGB(0,0,0);
            rect(txtX, rowYBottom, txtW, rowH); stroke();
          }
          // weekday text
          const dw = dayName.length * 3.6;
          text(txtX + txtW/2 - dw/2, rowYBottom + rowH/2 - 3.5, 9.5, dayName);
}
        y -= rowH;
      }

      // Outer border around whole table
      const totalTableH = headerRowH + rowH*31;
      rect(startX, tableTopY - totalTableH, usableW, totalTableH);
      stroke();

      // Legend
      const legY = margin + 6;
      const gap = 10;
      const legendTotalW = 70 + 60 + 55 + 55 + 70 + gap*4;
      const legX = margin + usableW/2 - legendTotalW/2;
      const box = (x, y, w, h, fillHex, label) => {
        const [r,g,b] = rgbHexTo01(fillHex);
        setFillRGB(r,g,b); rect(x,y,w,h); fill();
        setStrokeRGB(0,0,0); rect(x,y,w,h); stroke();
        const lw = label.length * 4.6;
      text(x + w/2 - lw/2, y + 4, 9.5, label);
      };
      box(legX, legY, 70, 16, HOLIDAY_BG, "Feiertag");
      box(legX + 70 + gap, legY, 60, 16, VACATION_BG, "Ferien");
      box(legX + 70 + gap + 60 + gap, legY, 55, 16, SHIFT_COLORS["F"], "F = Früh");
      box(legX + 70 + gap + 60 + gap + 55 + gap, legY, 55, 16, SHIFT_COLORS["S"], "S = Spät");
      box(legX + 70 + gap + 60 + gap + 55 + gap + 55 + gap, legY, 70, 16, SHIFT_COLORS["N"], "N = Nacht");
    }
  });

  const filename = `schichtplan-${year}-fiber${fiber}-p${team}-v2.pdf`;
  return new Response(pdfBytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
}
