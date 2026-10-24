// Only the authenticated server response supplies is_admin. API authorization
// remains mandatory even if a browser tampers with this navigation hint.
export function accountDestination(session: {recovery:boolean;is_admin?:boolean;profile:{role:'producer'|'buyer'}|null}):string {
 if(session.recovery)return '/reset-password';
 if(session.is_admin===true)return '/admin';
 return session.profile?`/${session.profile.role}/dashboard`:'/onboarding';
}
