export async function onRequestGet({ request }) {
  const url = new URL(request.url);

  // EXPERIMENT: Proxy to existing print endpoint so you can "Print -> Save as PDF"
  // without changing the UI/buttons.
  const targetUrl = new URL("/printv2", url.origin);
  targetUrl.search = url.search;

  const res = await fetch(targetUrl.toString(), {
    method: "GET",
    headers: { "accept": "text/html" }
  });

  const body = await res.text();

  return new Response(body, {
    status: res.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
