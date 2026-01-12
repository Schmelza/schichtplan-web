// Cloudflare Pages Function: /generate?fiber=1|2&team=1..4&year=2026..
// Returns JSON with links (webcal + https) and filename.
// No secrets, no GitHub token.

function rhythmFiber2(team) {
  switch (team) {
    case 1: return ["Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh"];
    case 2: return ["Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät"];
    case 3: return ["Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht"];
    case 4: return ["Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei"];
    default: throw new Error("Team muss 1-4 sein");
  }
}

function rhythmFiber1(team) {
  switch (team) {
    case 1: return ["Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät"];
    case 2: return ["Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht"];
    case 3: return ["Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh","Früh","Spät","Spät","Spät","Nacht","Nacht","Frei"];
    case 4: return ["Früh","Spät","Spät","Spät","Nacht","Nacht","Frei","Frei","Früh","Früh","Früh","Spät","Spät","Nacht","Nacht","Frei","Frei","Frei","Früh","Früh","Spät","Spät","Nacht","Nacht","Nacht","Frei","Frei","Früh"];
    default: throw new Error("Team muss 1-4 sein");
  }
}

function pad2(n){ return String(n).padStart(2,"0"); }
function fmtLocal(dt){
  // YYYYMMDDTHHMMSS (no Z) like your VBA export
  return `${dt.getFullYear()}${pad2(dt.getMonth()+1)}${pad2(dt.getDate())}T${pad2(dt.getHours())}${pad2(dt.getMinutes())}${pad2(dt.getSeconds())}`;
}
function fmtUTCStamp(){
  const d = new Date();
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth()+1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

function buildIcs(fiber, team, year){
  if (year < 2026) throw new Error("Jahre vor 2026 nicht erlaubt");

  const start = new Date(year,0,1);
  const end = new Date(year,11,31);
  const rhythm = (fiber===2) ? rhythmFiber2(team) : rhythmFiber1(team);

  const ref = new Date(2026,0,1);
  const daysDiff = Math.floor((start - ref) / 86400000);
  let pos = ((daysDiff % 28) + 28) % 28;

  const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Schichtplan Export//DE"];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1), pos++){
    const sc = String(rhythm[pos % 28]).toLowerCase();
    if (sc === "frei") continue;

    let dtStart, dtEnd, summary;
    if (sc === "früh"){
      dtStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 6,0,0);
      dtEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(),14,0,0);
      summary = `Frühschicht P${team}`;
    } else if (sc === "spät"){
      dtStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(),14,0,0);
      dtEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(),22,0,0);
      summary = `Spätschicht P${team}`;
    } else if (sc === "nacht"){
      dtStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(),22,0,0);
      dtEnd   = new Date(dtStart.getTime() + 8*3600*1000);
      summary = `Nachtschicht P${team}`;
    } else {
      continue;
    }

    const uid = `${Date.now()}-${d.toISOString().slice(0,10)}-${fiber}-${team}`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${fmtUTCStamp()}`);
    lines.push(`DTSTART:${fmtLocal(dtStart)}`);
    lines.push(`DTEND:${fmtLocal(dtEnd)}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export async function onRequestGet(context) {
  try {
    const url = new URL(context.request.url);
    const fiber = Number(url.searchParams.get("fiber"));
    const team  = Number(url.searchParams.get("team"));
    const year  = Number(url.searchParams.get("year"));

    const maxYear = (new Date().getFullYear()) + 4;

    if (![1,2].includes(fiber)) throw new Error("fiber muss 1 oder 2 sein");
    if (!(team>=1 && team<=4)) throw new Error("team muss 1-4 sein");
    if (!(year>=2026 && year<=maxYear)) throw new Error(`year muss 2026 bis ${maxYear} sein`);

    const file = `Fiber${fiber}_P${team}_${year}.ics`;
    // build URL on same host
    const httpsUrl = `${url.origin}/ics?fiber=${fiber}&team=${team}&year=${year}`;
    const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

    return new Response(JSON.stringify({ file, webcal: webcalUrl, https: httpsUrl }), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  }
}
