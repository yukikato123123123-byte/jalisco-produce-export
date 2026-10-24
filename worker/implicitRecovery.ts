import { Failure } from './provider.ts';
// Call ONLY after the configured Supabase /user endpoint has accepted this exact
// bearer token. Decoding a JWT by itself does not verify its signature.
export function verifiedRecoveryClaims(token: string, userId: string, providerURL: string, now = Date.now()) {
  const invalid = () => new Failure(400, 'This recovery session is invalid, expired or already used. Request a new recovery email.');
  try {
    const parts=token.split('.');
    if (parts.length!==3 || !parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p))) throw invalid();
    const encoded=parts[1].replace(/-/g,'+').replace(/_/g,'/');
    const claims=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length/4)*4,'=')),c=>c.charCodeAt(0))));
    const seconds=Math.floor(now/1000);
    if (!claims || claims.iss!==`${providerURL}/auth/v1` || claims.sub!==userId || typeof claims.exp!=='number' || !Number.isFinite(claims.exp) || claims.exp<=seconds || !Array.isArray(claims.amr)) throw invalid();
    // Current GoTrue issues both signup and recovery email verifications as OTP.
    // URL type is routing input; signed recent OTP proof is the authority.
    const proofTime=claims.amr.filter((a:unknown):a is {method:string;timestamp:number}=>!!a && typeof a==='object' && ['otp','recovery'].includes(String((a as {method?:unknown}).method)) && typeof (a as {timestamp?:unknown}).timestamp==='number' && Number.isFinite((a as {timestamp:number}).timestamp))
      .map((a:{timestamp:number})=>a.timestamp).filter((t:number)=>t<=seconds+30 && t>seconds-600).sort((a:number,b:number)=>b-a)[0];
    if (proofTime===undefined) throw invalid();
    const expiresIn=Math.floor(Math.min(claims.exp-seconds,proofTime+600-seconds,600));
    if (expiresIn<1) throw invalid();
    return { expiresIn, expiresAt: Math.ceil(claims.exp*1000) };
  } catch { throw invalid(); }
}
