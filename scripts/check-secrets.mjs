import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const git=(...args)=>execFileSync('git',args,{maxBuffer:30*1024*1024});
const files=git('diff','--cached','--name-only','--diff-filter=ACMR','-z').toString().split('\0').filter(Boolean);
let values=[];try{values=readFileSync('.env','utf8').split(/\r?\n/).filter(l=>/^(TOUR_API_KEY|PARKING_API_KEY)=/.test(l)).map(l=>l.slice(l.indexOf('=')+1).trim().replace(/^"|"$/g,''));}catch{}
const secrets=values.filter(v=>v.length>=16).flatMap(v=>{let decoded=v;try{decoded=decodeURIComponent(v);}catch{}return [v,decoded,encodeURIComponent(decoded)];});
const failed=[];
for(const file of files){if((/(^|\/)\.env($|\.)/.test(file)&&file.split('/').pop()!=='.env.example')||/(^|\/)(\.cache|reference|node_modules)\//.test(file)){failed.push(file);continue;}
 let raw=git('show',':'+file);if(file.endsWith('.gz'))raw=gunzipSync(raw);const text=raw.toString('utf8');if(secrets.some(s=>text.includes(s)))failed.push(file);
}
if(failed.length){console.error('Upload blocked: sensitive files or registered key values detected:',failed.join(', '));process.exit(1);}
console.log(`PASS: ${files.length} staged files checked; .env/cache excluded; ${values.filter(v=>v.length>=16).length} locally registered key values absent (including encoded variants).`);
