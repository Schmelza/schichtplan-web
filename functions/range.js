import { MIN_YEAR, clampAllowedYear } from "./_common.js";

export async function onRequestGet(context) {
  const now = new Date();
  const maxYear = now.getFullYear() + 5;
  const minYear = Math.max(MIN_YEAR, now.getFullYear());

  return new Response(JSON.stringify({ minYear, maxYear }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
