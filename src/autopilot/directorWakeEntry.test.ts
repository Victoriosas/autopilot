import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';

test('Edge entrypoint works over independent HTTP loopback without Deno or Supabase credentials', async () => {
  const scopedToken = 'synthetic-only-'+ 'c'.repeat(40);
  let entryHandler: ((request: Request)=>Promise<Response>) | undefined;
  const earlier = (globalThis as typeof globalThis & {Deno?:unknown}).Deno;
  (globalThis as typeof globalThis & {Deno?:unknown}).Deno = {
    env:{get:(name:string)=>name==='AUTOPILOT_DIRECTOR_WAKE_TOKEN'?scopedToken:undefined},
    serve:(fn:(request:Request)=>Promise<Response>)=>{entryHandler=fn;}
  };
  try {
    await import('../../supabase/functions/autopilot-director-wake/index.ts');
    assert.equal(typeof entryHandler,'function');
    const handler = entryHandler!;
    const server = createServer(async (incoming, outgoing) => {
      const url='http://127.0.0.1'+ incoming.url;
      const response=await handler(new Request(url,{
        method: incoming.method,
        headers: incoming.headers as HeadersInit
      }));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(await response.text());
    });
    server.listen(0,'127.0.0.1');
    await once(server,'listening');
    try {
      const address = server.address();
      if (!address || typeof address==='string') throw Error('unavailable_test_port');
      const base='http://127.0.0.1:'+address.port+'/functions/v1/autopilot-director-wake';
      const send=(token:string, path=base)=>fetch(path,{
        method:'POST',headers:{'x-autopilot-wake-token':token}
      });
      assert.equal((await send('wrong'.repeat(12))).status,401);
      assert.equal((await send(scopedToken,base+'/run')).status,404);
      const result=await send(scopedToken);
      assert.equal(result.status,200);
      const body=await result.json();
      assert.equal(body.state,'wake_preflight_authenticated');
      assert.equal(body.executed,false);
      assert.equal(body.tasksClaimed,0);
      assert.equal(body.noSend,true);
    } finally {
      server.close();
      await once(server,'close');
    }
  } finally {
    (globalThis as typeof globalThis & {Deno?:unknown}).Deno=earlier;
  }
});
