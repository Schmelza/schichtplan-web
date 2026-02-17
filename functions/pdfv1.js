import { clampAllowedYear, parseIntParam, shiftForDate, isHolidayRLP, getFerienSetForYear, isFerien, TEL } from "./_common.js";

const SHIFT_COLORS = {
  "F": [255,255,0],
  "S": [255,0,0],
  "N": [0,176,240],
};

const HOLIDAY_BG = [255,200,200];
const VACATION_BG = [200,220,255];
const MONTH_BG = [198,224,180];

const DAYS_DE = ["So","Mo","Di","Mi","Do","Fr","Sa"];
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function pdfEscape(text){
  return String(text)
    .replace(/\\/g,"\\\\")
    .replace(/\(/g,"\\(")
    .replace(/\)/g,"\\)");
}

export async function onRequestGet({ request }) {

  const url = new URL(request.url);
  const fiber = parseIntParam(url,"fiber");
  const team  = parseIntParam(url,"team");
  const year  = parseIntParam(url,"year");

  if(!fiber||!team||!year) return new Response("Missing params",{status:400});

  const yr = clampAllowedYear(year);
  if(!yr.ok) return new Response("Invalid year",{status:400});

  const ferienSet = await getFerienSetForYear(year);
  const tel = (fiber===1?TEL.fiber1:TEL.fiber2);

  const title = `Schichtplan ${year}  Fiber ${fiber} - P${team}`;

  const width = 842;
  const height = 595;
  let y = height - 40;

  let objects = [];
  let contentStream = "";

  function text(x,y,size,str,align="left"){
    const esc = pdfEscape(str);
    if(align==="center"){
      contentStream += `BT /F1 ${size} Tf ${x} ${y} Td (${esc}) Tj ET\n`;
    } else {
      contentStream += `BT /F1 ${size} Tf ${x} ${y} Td (${esc}) Tj ET\n`;
    }
  }

  function rect(x,y,w,h,color=null){
    if(color){
      contentStream += `${color[0]/255} ${color[1]/255} ${color[2]/255} rg\n`;
      contentStream += `${x} ${y} ${w} ${h} re f\n`;
      contentStream += `0 0 0 rg\n`;
    } else {
      contentStream += `${x} ${y} ${w} ${h} re S\n`;
    }
  }

  // Titel zentriert
  text(width/2-150,y,18,title,"center");
  y -= 22;

  // Printed by links über Monaten
  text(60,y,11,"Printed by: Johannes Trippen©");
  
  // Telefonnummern oben rechts zentriert im Block
  const phoneBlockX = width-220;
  rect(phoneBlockX-10,y+5,180,40);
  text(phoneBlockX+30,y+25,10,tel.b,"center");
  text(phoneBlockX+30,y+15,10,tel.m,"center");
  text(phoneBlockX+30,y+5,10,tel.t,"center");

  y -= 35;

  const startX = 60;
  const colWidth = 20;
  const rowHeight = 14;

  for(let m=0;m<12;m++){
    const monthY = y - (m*rowHeight*2);

    rect(startX,monthY-10,80,rowHeight*2,MONTH_BG);
    // Monatsname zentriert
    text(startX+20,monthY,rowHeight,MONTHS_DE[m],"center");

    for(let d=1;d<=31;d++){
      const date = new Date(Date.UTC(year,m,d));
      if(date.getUTCMonth()!==m) continue;

      const x = startX+90+(d-1)*colWidth;

      const holiday = isHolidayRLP(date);
      const vacation = !holiday && isFerien(ferienSet,date);
      const shift = shiftForDate(fiber,team,date);

      let bg=null;
      if(holiday) bg=HOLIDAY_BG;
      if(vacation) bg=VACATION_BG;
      if(shift) bg=SHIFT_COLORS[shift];

      rect(x,monthY,colWidth,rowHeight,bg);
      rect(x,monthY-rowHeight,colWidth,rowHeight);

      text(x+4,monthY+3,8,String(d));
      text(x+4,monthY-rowHeight+3,8,DAYS_DE[date.getUTCDay()]);
    }
  }

  // Legende zentriert
  const legendY = 40;
  const legendX = width/2 - 150;

  rect(legendX,legendY,60,15,HOLIDAY_BG);
  text(legendX+10,legendY+4,9,"Feiertag");

  rect(legendX+70,legendY,60,15,VACATION_BG);
  text(legendX+80,legendY+4,9,"Ferien");

  rect(legendX+140,legendY,60,15,SHIFT_COLORS["F"]);
  text(legendX+150,legendY+4,9,"F = Früh");

  rect(legendX+210,legendY,60,15,SHIFT_COLORS["S"]);
  text(legendX+220,legendY+4,9,"S = Spät");

  rect(legendX+280,legendY,60,15,SHIFT_COLORS["N"]);
  text(legendX+290,legendY+4,9,"N = Nacht");

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${contentStream.length} >>
stream
${contentStream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
0
%%EOF`;

  return new Response(pdf,{
    headers:{
      "content-type":"application/pdf"
    }
  });
}
