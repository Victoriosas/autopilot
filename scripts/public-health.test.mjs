import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPublicHealth } from './public-health.mjs';

test('existing public monitor classifies only allowed readiness causes without printing provider text',async()=>{
  for(const reason of ['storage_timeout','PRIVATE_PROVIDER_DETAIL']) {
    const methods=[];
    const request=async(url,init)=>{
      methods.push(init.method);const p=new URL(url).pathname;
      if(['/tienda','/checkout','/tratamientos'].includes(p))return new Response('',{status:410});
      if(p.startsWith('/de-mi-para-ti/'))return new Response('',{status:404});
      if(p==='/api/health')return Response.json({status:'ok',commit:'a'.repeat(40),checkoutEnabled:false,checkoutRequested:false});
      if(p==='/api/beauty/inquiries/config')return Response.json({enabled:false,unavailableReason:reason});
      return new Response('');
    };
    await assert.rejects(checkPublicHealth('https://victoriosas.online',request),error=>{
      assert.match(error.message,new RegExp('consultation intake unavailable: '+(reason==='storage_timeout'?'storage_timeout':'unknown')));
      assert.doesNotMatch(error.message,/PRIVATE_PROVIDER_DETAIL/);return true;
    });
    assert.ok(methods.every(x=>x==='GET'));
  }
});

test('reports a confirmed Cloudflare challenge without exposing headers or body', async () => {
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, method: init.method, redirect: init.redirect });
    return new Response('PRIVATE RESPONSE CONTENT', {
      status: 403,
      headers: {
        'cf-mitigated': 'challenge',
        'cf-ray': 'a5668ad9fa25e2ca-MVD',
        'set-cookie': 'do-not-log-this-cookie',
      },
    });
  };
  await assert.rejects(
    checkPublicHealth('https://victoriosas.online', request),
    (error) => {
      assert.match(error.message, /HTTP 403/);
      assert.match(error.message, /Cloudflare challenge confirmed/);
      assert.match(error.message, /cf-ray=a5668ad9fa25e2ca/);
      assert.doesNotMatch(error.message, /PRIVATE RESPONSE CONTENT|do-not-log-this-cookie/);
      return true;
    },
  );
  assert.deepEqual(calls, [{
    url: 'https://victoriosas.online/',
    method: 'GET',
    redirect: 'manual',
  }]);
});

test('does not invent a Cloudflare diagnosis for an unexplained 403', async () => {
  const request = async () => new Response('UNKNOWN ERROR', { status: 403 });
  await assert.rejects(
    checkPublicHealth('https://victoriosas.online', request),
    (error) => {
      assert.match(error.message, /HTTP 403/);
      assert.match(error.message, /cause not confirmed/);
      assert.doesNotMatch(error.message, /Cloudflare challenge confirmed|UNKNOWN ERROR/);
      return true;
    },
  );
});

test('keeps other unexpected statuses as failures', async () => {
  const request = async () => new Response('ERROR DETAILS', { status: 502 });
  await assert.rejects(
    checkPublicHealth('https://victoriosas.online', request),
    (error) => {
      assert.match(error.message, /HTTP 502/);
      assert.match(error.message, /expected 200/);
      assert.doesNotMatch(error.message, /Cloudflare challenge confirmed|ERROR DETAILS/);
      return true;
    },
  );
});

test('keeps an unclassified 403 unconfirmed while exposing only a validated Ray ID', async () => {
  const request = async () => new Response('SECRET RESPONSE', {
    status: 403,
    headers: { 'cf-ray': 'a5623f55fe6c2b5b-EZE' },
  });
  await assert.rejects(
    checkPublicHealth('https://victoriosas.online', request),
    (error) => {
      assert.match(error.message, /cause not confirmed/);
      assert.match(error.message, /cf-ray=a5623f55fe6c2b5b/);
      assert.doesNotMatch(error.message, /SECRET RESPONSE|EZE/);
      return true;
    },
  );
});

test('never prints malformed or untrusted Ray header values', async () => {
  const request = async () => new Response('SECRET BODY', {
    status: 403,
    headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'fake-ray-with-private-token' },
  });
  await assert.rejects(
    checkPublicHealth('https://victoriosas.online', request),
    (error) => {
      assert.match(error.message, /Cloudflare challenge confirmed/);
      assert.doesNotMatch(error.message, /fake-ray-with-private-token|cf-ray=|SECRET BODY/);
      return true;
    },
  );
});
