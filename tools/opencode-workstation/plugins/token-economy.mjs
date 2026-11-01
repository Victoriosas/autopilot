import {DEFAULTS,responseCap,clipOutput,createStore,registerUsage,reserveCall,reserveDelegation,summary} from '../lib/token-economy.mjs';
export const TokenEconomy = async () => {
  const store=createStore();
  const deep=process.env.OPENCODE_ECONOMY_MODE==='deep';
  const limits=deep?{...DEFAULTS,calls:24,reportedVolume:180000}:DEFAULTS;
  return {
    'chat.params': async(input,output)=>{
      reserveCall(store,input.sessionID,limits);
      const cap=input.model.providerID==='freellmapi'?384:deep?4096:responseCap(input.agent);
      output.maxOutputTokens=Math.min(output.maxOutputTokens||cap,cap);
      // Keep model routing stable for cache reuse. Do not silently select a paid provider.
    },
    'tool.execute.before':async(input,output)=>{
      if(input.tool==='read')output.args.limit=Math.min(output.args.limit||100,deep?400:limits.readLines);
      if(input.tool==='task'){
        if(String(output.args.prompt||'').length>limits.taskPromptChars)throw new Error('DELEGATION_CONTEXT_TOO_LARGE: send the objective, exact files and acceptance criteria; do not copy conversation history.');
        reserveDelegation(store,input.sessionID,limits);
      }
    },
    'tool.execute.after':async(input,output)=>{
      const clipped=clipOutput(output.output,deep?16000:limits.outputChars);
      if(clipped.omitted){output.output=clipped.text;store.write(input.sessionID,s=>{s.omittedChars+=clipped.omitted;});}
    },
    event:async({event})=>{
      if(event.type==='message.updated')registerUsage(store,event.properties?.info);
    },
    'experimental.session.compacting':async(input,output)=>{
      (output.context??=[]).push('Preserve objective, changed files, exact validation evidence, blockers and next action. Omit full logs, repeated history, credentials and private reasoning. Keep project security restrictions.');
    },
  };
};
