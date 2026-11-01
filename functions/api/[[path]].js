// Temporary same-origin bridge. Vercel continues to use api/server.ts.
const UPSTREAM = 'https://jfjzpwlrhzqbcrvqxhzf.supabase.co/functions/v1/autopilot-api';
export async function onRequest({request}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return new Response(null, {status:404});
  const headers = new Headers(request.headers);
  for (const key of ['host','cookie','x-vercel-forwarded-for','x-forwarded-for']) headers.delete(key);
  try {
    const response = await fetch(UPSTREAM + url.pathname + url.search, {
      method: request.method, headers, body: ['GET','HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual', signal: AbortSignal.timeout(25000)
    });
    const output = new Headers(response.headers);
    output.set('Cache-Control','no-store');
    output.set('X-Content-Type-Options','nosniff');
    output.delete('set-cookie');
    return new Response(response.body,{status:response.status,headers:output});
  } catch {
    return Response.json({error:'AUTOPILOT_BACKEND_UNAVAILABLE'}, {status:503,headers:{'Cache-Control':'no-store'}});
  }
}
