export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const key  = url.searchParams.get('key') || 'default';
  const mode = url.searchParams.get('mode') || 'inc';

  const KV_KEY = `counter:${key}`;

  let value = await env.COUNTER_KV.get(KV_KEY);
  value = value ? parseInt(value, 10) : 0;
  if (!Number.isFinite(value)) value = 0;

  if (mode === 'inc') {
    value += 1;
    await env.COUNTER_KV.put(KV_KEY, String(value));
  }

  return new Response(JSON.stringify({ value }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
