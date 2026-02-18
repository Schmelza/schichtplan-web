
import { clampAllowedYear, parseIntParam, shiftForDate, isHolidayRLP, getFerienSetForYear, isFerien, TEL } from "./_common.js";

const SHIFT_COLORS = { "F": "#ffff00", "S": "#ff0000", "N": "#00b0f0" };
const HOLIDAY_BG = "#ffc8c8";
const VACATION_BG = "#c8dcff";
const HEADER_BG  = "#c6e0b4";

const WD2 = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function shiftLetter(shift){
  const s = String(shift||"").toLowerCase();
  if (s === "früh") return "F";
  if (s === "spät") return "S";
  if (s === "nacht") return "N";
  return "";
}


// Minimal PDF generator (no deps) for consistent A4 landscape output.
const A4_LANDSCAPE = { w: 842, h: 595 }; // points (1/72 inch)

function pdfEscape(str){
  // PDF strings are byte-strings for the built-in fonts (WinAnsi). We keep the PDF file UTF-8,
  // but encode non-ASCII characters as octal escapes so they render correctly (ÄÖÜäöüß© etc.).
  const s = String(str ?? "");
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);

    // Escape special PDF string chars (correct JS escaping)
    if (code === 0x5C) { out += "\\\\"; continue; } // backslash
    if (code === 0x28) { out += "\\(";  continue; }  // (
    if (code === 0x29) { out += "\\)";  continue; }  // )

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

  
  const dl = url.searchParams.get("dl");
if (!fiber || !team || !year) return new Response("Missing params: fiber, team, year", { status: 400 });

  const yr = clampAllowedYear(year);
  if (!yr.ok) return new Response(`year muss ${yr.minYear} bis ${yr.maxYear} sein`, { status: 400 });

  const ferienSet = await getFerienSetForYear(year);

  const tel = (fiber === 1 ? TEL.fiber1 : TEL.fiber2);
  // Use plain hyphens in the title to avoid unsupported glyphs (e.g. en-dash) showing as "?" in some PDF viewers.
  const title = `Schichtplan ${year}  Fiber ${fiber} - P${team}`;
  const printedBy = "Printed by: Johannes Trippen©";
  const telLines = [tel.b, tel.m, tel.t];

  const pdfBytes = buildPdf({
    title,
    printedBy,
    telLines,
    drawContent: ({ w, h, setStrokeRGB, setFillRGB, setLineWidth, rect, fillStroke, fill, stroke, text, clipRect, restore, rgbHexTo01 }) => {
      const margin = 24;
      const headerH = 62;
      const legendH = 26;
      const tableTopY = h - margin - headerH;
      const tableBottomY = margin + legendH + 10;
      const tableH = tableTopY - tableBottomY;
      const usableW = w - margin*2;

      // Table geometry (needed for left-aligned "Printed by" position)
      const monthColW = 72;
      const startX = margin;

      // Header
      // - Title centered
      // - "Printed by" left-aligned above the months (like the reference printout)
      setFillRGB(0,0,0); setStrokeRGB(0,0,0);
      text(w/2 - (title.length*4.2), h - margin - 24, 18, title);
      text(startX + 6,            h - margin - 42, 11, printedBy);

      // Tel box right
      const boxW = 190, boxH = 44;
      const boxX = w - margin - boxW;
      const boxY = h - margin - boxH - 8;
      setLineWidth(1);
      rect(boxX, boxY, boxW, boxH);
      stroke();
      
function centerInBox(line, yOffset){
  const tw = line.length * 4.6;
  text(
    boxX + boxW/2 - tw/2,
    boxY + yOffset,
    9.5,
    line
  );
}

centerInBox(telLines[0], 28);
centerInBox(telLines[1], 16);
centerInBox(telLines[2], 4);


      // Table geometry
      const rows = 12 * 3; // 36
      const rowH = tableH / rows;
      const dayColW = (usableW - monthColW) / 31;

      let y = tableTopY;

      // Background header band not used (v1 has none) - keep clean
      setLineWidth(0.6);
      setStrokeRGB(0,0,0);

      // Outer border
      rect(startX, tableBottomY, usableW, tableH);
      stroke();

      // Draw grid + content
      for (let m = 0; m < 12; m++) {
        const monthName = MONTHS_DE[m];
        const lastDay = new Date(Date.UTC(year, m+1, 0)).getUTCDate();

        // Month label cell spans 3 rows
        const monthSpanH = rowH * 3;
        const monthYBottom = y - monthSpanH;
        // Month label bg
        const [hr,hg,hb] = rgbHexTo01(HEADER_BG);
        setFillRGB(hr,hg,hb);
        rect(startX, monthYBottom, monthColW, monthSpanH);
        fill();
        setStrokeRGB(0,0,0);
        rect(startX, monthYBottom, monthColW, monthSpanH);
        stroke();

        // Month name centered-ish
        clipRect(startX, monthYBottom, monthColW, monthSpanH);
        const monthTextWidth = monthName.length * 4.6;
      text(
        startX + monthColW/2 - monthTextWidth/2,
        monthYBottom + monthSpanH/2 - 4,
        10.5,
        monthName
      );
        restore();

        // 3 rows: weekday, day, shift
        for (let r = 0; r < 3; r++) {
          const rowYBottom = y - rowH*(r+1);
          // Row horizontal line
          rect(startX + monthColW, rowYBottom, usableW - monthColW, rowH);
          stroke();

          for (let d = 1; d <= 31; d++) {
            const cellX = startX + monthColW + (d-1)*dayColW;
            const cellY = rowYBottom;
            // cell border
            rect(cellX, cellY, dayColW, rowH);
            stroke();

            if (d > lastDay) continue;

            const dateObj = new Date(Date.UTC(year, m, d));
            const wd = WD2[dateObj.getUTCDay()];
            const holiday = isHolidayRLP(dateObj);
            const vacation = !holiday && isFerien(ferienSet, dateObj);

            if (r === 1) {
              // day number row with holiday/vacation bg
              if (holiday || vacation) {
                const col = holiday ? HOLIDAY_BG : VACATION_BG;
                const [r1,g1,b1] = rgbHexTo01(col);
                setFillRGB(r1,g1,b1);
                rect(cellX, cellY, dayColW, rowH);
                fill();
                setStrokeRGB(0,0,0);
                rect(cellX, cellY, dayColW, rowH);
                stroke();
              }
              const s = String(d);
              text(cellX + dayColW/2 - (s.length*2.8), cellY + rowH/2 - 3.5, 9.5, s);
            } else if (r === 0) {
              // weekday row
              text(cellX + dayColW/2 - 4.5, cellY + rowH/2 - 3.5, 9.0, wd);
            } else {
              // shift row with colored bg and letter
              const shift = shiftForDate(fiber, team, dateObj);
              const letter = shiftLetter(shift);
              if (letter) {
                const [r2,g2,b2] = rgbHexTo01(SHIFT_COLORS[letter]);
                setFillRGB(r2,g2,b2);
                rect(cellX, cellY, dayColW, rowH);
                fill();
                setStrokeRGB(0,0,0);
                rect(cellX, cellY, dayColW, rowH);
                stroke();
                text(cellX + dayColW/2 - 3.5, cellY + rowH/2 - 3.5, 10, letter);
              }
            }
          }
        }

        // Month block bottom line
        y -= monthSpanH;
        // Line separating next month (already via borders)
      }

      // Legend
      const legY = margin + 6;
      const totalLegendWidth = 70 + 10 + 60 + 10 + 55 + 10 + 55 + 10 + 70;
    const legX = margin + usableW/2 - totalLegendWidth/2;
      const box = (x, y, w, h, fillHex, label) => {
        const [r,g,b] = rgbHexTo01(fillHex);
        setFillRGB(r,g,b); rect(x,y,w,h); fill();
        setStrokeRGB(0,0,0); rect(x,y,w,h); stroke();
        const tw = label.length * 4.6;
      text(x + w/2 - tw/2, y + 4, 9.5, label);
      };
      box(legX, legY, 70, 16, HOLIDAY_BG, "Feiertag");
      box(legX+80, legY, 60, 16, VACATION_BG, "Ferien");
      box(legX+150, legY, 55, 16, SHIFT_COLORS["F"], "F = Früh");
      box(legX+210, legY, 55, 16, SHIFT_COLORS["S"], "S = Spät");
      box(legX+270, legY, 70, 16, SHIFT_COLORS["N"], "N = Nacht");
    }
  });
const filename = `Schichtplan-Fiber${fiber}-P${team}-${year}-v1.pdf`;
  const disposition = (dl === "1") ? "attachment" : "inline";
  return new Response(pdfBytes, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${disposition}; filename="${filename}"`,
      "cache-control": "no-store"
    }
  });
}
