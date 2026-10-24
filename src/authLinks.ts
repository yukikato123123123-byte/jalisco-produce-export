// Treat URL values as untrusted. Never log this structure or persist its tokens.
export type AuthLink = { purpose: 'signup' | 'recovery'; error: string; hash?: string; accessToken?: string; hasParameters: boolean };
export function readAuthLink(search: string, fragment: string): AuthLink {
  const q=new URLSearchParams(search), h=new URLSearchParams(fragment.replace(/^#/,''));
  const get=(k:string)=>h.get(k) ?? q.get(k);
  const type=get('type'), purpose=type==='recovery'||q.get('purpose')==='recovery'?'recovery':'signup';
  const result:AuthLink={purpose,error:'',hasParameters:!!(search||fragment)};
  const fail=(error:string)=>({...result,error});
  if (q.getAll('token_hash').length>1 || q.getAll('type').length>1 || h.getAll('type').length>1 || (q.has('type')&&h.has('type')&&q.get('type')!==h.get('type')) || (q.has('purpose')&&type&&q.get('purpose')!== (type==='email'?'signup':type))) return fail('This link contains conflicting authentication parameters. Request a new link for the intended action.');
  if (get('error') || get('error_description') || get('error_code')) return fail(purpose==='recovery'?'The password recovery link is invalid, expired or already used. Request a new recovery email.':'The confirmation link is invalid, expired or already used. Request a new confirmation email.');
  if (get('code')) return fail('This is a PKCE callback, but this application has no matching code verifier. Use the email confirmation code or request a new link; an authorization code is not an email OTP.');
  if (type && !['signup','email','recovery'].includes(type)) return fail('This link is for a different authentication action. Use a signup confirmation or password recovery email.');
  const hash=get('token_hash'), accessToken=h.get('access_token');
  if (hash && accessToken) return fail('This link contains conflicting authentication parameters. Request a new link for the intended action.');
  if (hash) {
    if (!type || !/^[A-Za-z0-9_-]{16,256}$/.test(hash)) return fail('This authentication link is malformed. Request a new link.');
    return {...result,hash};
  }
  if (accessToken) {
    if (!type || accessToken.length<20 || accessToken.length>8192) return fail('This authentication link is malformed. Request a new email for the intended action.');
    return {...result,accessToken};
  }
  if (q.has('access_token') || get('token') || get('refresh_token') || type) return fail('This authentication link is incomplete or unsupported. Use the code in the email or request a new link.');
  return result;
}
