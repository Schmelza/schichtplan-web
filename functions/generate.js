// functions/generate.js
import { assertParams } from "./_lib.js";

export async function onRequestGet({ request }) {
  try {
    const url = new URL(request.url);
    const fiber = parseInt(url.searchParams.get("fiber") || "", 10);
    const team  = parseInt(url.searchParams.get("team")  || "", 10);
    const year  = parseInt(url.searchParams.get("year")  || "", 10);

    assertParams({ fiber, team, year });

    const origin = url.origin;
    const host = url.host;

    const icsHttps = `${origin}/ics?fiber=${fiber}&team=${team}&year=${year}`;
    const webcal = `webcal://${host}/ics?fiber=${fiber}&team=${team}&year=${year}`;
    const print1 = `${origin}/print?v=1&fiber=${fiber}&team=${team}&year=${year}`;
    const print2 = `${origin}/print?v=2&fiber=${fiber}&team=${team}&year=${year}`;

    return new Response(JSON.stringify({ ok:true, icsHttps, webcal, print1, print2 }), {
      headers: { "content-type": "application/json; charset=utf-8" }
    });
  } catch (e) {
    return new Response(String(e?.message || e), { status: 400, headers: { "content-type": "text/plain; charset=utf-8" }});
  }
}
