export async function onRequest(context) {
  const url = new URL(context.request.url);

  const fiber = Number(url.searchParams.get("fiber"));
  const team  = Number(url.searchParams.get("team"));
  const year  = Number(url.searchParams.get("year"));

  // ---------- VALIDIERUNG ----------
  if (!Number.isInteger(fiber) || !Number.isInteger(team) || !Number.isInteger(year)) {
    return new Response("fiber, team und year müssen Zahlen sein", { status: 400 });
  }

  const nowYear = new Date().getFullYear();
  const minYear = nowYear;
  const maxYear = nowYear + 4;

  if (year < minYear || year > maxYear) {
    return new Response(
      `Jahr nur erlaubt von ${minYear} bis ${maxYear}`,
      { status: 400 }
    );
  }

  // ---------- LINKS ----------
  const baseUrl = `${url.origin}`;

  const icsUrl = `${baseUrl}/ics?fiber=${fiber}&team=${team}&year=${year}`;

  const result = {
    fiber,
    team,
    year,
    generatedAt: new Date().toISOString(),
    ics: icsUrl,
    webcal: icsUrl.replace("https://", "webcal://")
  };

  return new Response(JSON.stringify(result, null, 2), {
    headers: { "Content-Type": "application/json" }
  });
}
