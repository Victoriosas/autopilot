export type HealthCode = 'ok'|'dns'|'tls'|'timeout'|'http'|'unexpected_content'|'network';
export interface HealthDiagnostic { code:HealthCode; status:number|null; healthy:boolean }
export function networkFailure(error:unknown):HealthCode {
 const e=error as {name?:string;code?:string;message?:string;cause?:{code?:string;name?:string;message?:string}};
 const code=e?.cause?.code??e?.code??'';
 // Deno may expose its Rust transport cause only in the message. Classify it
 // internally; never return/log the message (it can contain a URL or credential).
 const message=String(e?.message??'')+' '+String(e?.cause?.message??'');
 if(['ENOTFOUND','EAI_AGAIN','ENODATA'].includes(code)||/dns error|failed to lookup address|name or service not known/i.test(message))return 'dns';
 if(/TLS|CERT|SSL/.test(code)||/invalid peer certificate|certificate verify|tls handshake|unknown issuer/i.test(message))return 'tls';
 if(['TimeoutError','AbortError'].includes(e?.name??'')||/TIMEOUT|TIMEDOUT/.test(code))return 'timeout';
 return 'network';
}
/** Exactly one fixed-origin request, no redirect or retry. Bound body and deadline too. */
export async function diagnosePublicHealth(fetcher:typeof fetch=fetch):Promise<HealthDiagnostic> {
 try {
  const response=await fetcher('https://victoriosas.online/',{method:'GET',redirect:'manual',headers:{accept:'text/html'},signal:AbortSignal.timeout(12000)});
  if(response.status!==200){await response.body?.cancel();return {code:'http',status:response.status,healthy:false};}
  if(!response.headers.get('content-type')?.includes('text/html')){await response.body?.cancel();return {code:'unexpected_content',status:200,healthy:false};}
  const reader=response.body?.getReader();let text='',size=0;
  if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>524288)return {code:'unexpected_content',status:200,healthy:false};text+=new TextDecoder().decode(value);}}finally{await reader.cancel();}
  const healthy=text.includes('Victoriosas');return {code:healthy?'ok':'unexpected_content',status:200,healthy};
 }catch(error){return {code:networkFailure(error),status:null,healthy:false};}
}
