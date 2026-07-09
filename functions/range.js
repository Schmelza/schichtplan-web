import { MIN_YEAR, currentBerlinYear } from "./_common.js";

export async function onRequestGet(context) {
  const nowYear = currentBerlinYear();
  const maxYear = nowYear + 5;
  const minYear = Math.max(MIN_YEAR, nowYear);

  return new Response(JSON.stringify({ minYear, maxYear }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
