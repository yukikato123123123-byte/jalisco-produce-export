// Test-only local Worker: never reuse the project's persisted D1 state.
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import process from 'node:process';
const state=mkdtempSync(join(tmpdir(),'nopahua-browser-d1-'));
const wrangler='node_modules/wrangler/bin/wrangler.js';
const env={...process.env,WRANGLER_SEND_METRICS:'false'};
const cleanup=()=>rmSync(state,{recursive:true,force:true});
process.once('exit',cleanup);
const migrations=spawnSync(process.execPath,[wrangler,'d1','migrations','apply','DB','--config','./wrangler.local.jsonc','--local','--persist-to',state],{stdio:'inherit',env});
if(migrations.error||migrations.status!==0)process.exit(migrations.status||1);
const worker=spawn(process.execPath,[wrangler,'dev','--config','./wrangler.local.jsonc','--local','--ip','127.0.0.1','--port','8787','--persist-to',state],{stdio:'inherit',env});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>worker.kill(signal));
worker.once('error',()=>process.exit(1));
worker.once('exit',code=>process.exit(code??0));
