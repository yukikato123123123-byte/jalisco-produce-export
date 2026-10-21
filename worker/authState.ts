import { Failure } from './provider.ts';
export interface Statement { bind(...values: unknown[]): Statement; first<T>(): Promise<T | null>; run(): Promise<unknown> }
export interface Database { prepare(sql: string): Statement }
export type StoredSession = { id: string; user_id: string; token: string; expires: number; purpose: string; generation: number; recovery_claimed: number };
// Use the direct D1 binding: queries execute on the primary (no Sessions/replica API).
// The clock handles first-ever login, where the provider user ID is not yet known.
export async function authenticationRevision(db: Database) {
  const row = await db.prepare('SELECT revision FROM auth_clock WHERE id = 1').first<{ revision: number }>();
  if (!row) throw new Failure(503, 'Authentication storage is not configured.');
  return row.revision;
}
export async function prepareUser(db: Database, userId: string) {
  await db.prepare('INSERT INTO auth_users (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING').bind(userId).run();
  const row = await db.prepare('SELECT generation FROM auth_users WHERE user_id = ?').bind(userId).first<{ generation: number }>();
  if (!row) throw new Failure(503, 'Authentication is temporarily unavailable.');
  return row.generation;
}
export async function insertSession(db: Database, session: StoredSession, revision: number) {
  const inserted = await db.prepare(`INSERT INTO sessions (id, user_id, token, expires, purpose, generation)
    SELECT ?, user_id, ?, ?, ?, generation FROM auth_users
    WHERE user_id = ? AND generation = ? AND reset_revision <= ?
      AND (reset_blocked = 0 OR ? = 'recovery') RETURNING id`)
    .bind(session.id, session.token, session.expires, session.purpose, session.user_id, session.generation, revision, session.purpose).first<{ id: string }>();
  if (!inserted) throw new Failure(409, 'Authentication changed while this request was in progress. Sign in again or request a new code.');
}
export async function currentSession(db: Database, id: string) {
  return db.prepare(`SELECT s.* FROM sessions s JOIN auth_users u ON u.user_id = s.user_id
    WHERE s.id = ? AND s.expires > ? AND s.recovery_claimed = 0
      AND s.generation = u.generation AND (u.reset_blocked = 0 OR s.purpose = 'recovery')`)
    .bind(id, Date.now()).first<StoredSession>();
}
export async function claimRecovery(db: Database, session: StoredSession) {
  // UPDATE + trigger form one conditional, atomic statement. A loser never calls Supabase PUT.
  const claimed = await db.prepare(`UPDATE sessions SET recovery_claimed = 1, claim_deadline = ?
    WHERE id = ? AND purpose = 'recovery' AND recovery_claimed = 0 AND expires > ?
      AND generation = ? AND EXISTS (SELECT 1 FROM auth_users u
        WHERE u.user_id = sessions.user_id AND u.generation = sessions.generation
          AND (u.reset_blocked = 0 OR u.reset_deadline <= ?)) RETURNING id`)
    .bind(Date.now() + 120000, session.id, Date.now(), session.generation, Date.now()).first<{ id: string }>();
  if (!claimed) throw new Failure(409, 'This recovery session cannot be used. Request a new code; an earlier reset may still be pending.');
}
export async function finishRecovery(db: Database, session: StoredSession) {
  const finished = await db.prepare(`UPDATE auth_users SET reset_blocked = 0
    WHERE user_id = ? AND generation = ? AND reset_blocked = 1 RETURNING user_id`)
    .bind(session.user_id, session.generation + 1).first<{ user_id: string }>();
  if (!finished) throw new Failure(409, 'Recovery state changed. Request a new code before continuing.');
  // Garbage collection only: generation checks already revoke these rows.
  try { await db.prepare('DELETE FROM sessions WHERE user_id = ? AND generation < ?').bind(session.user_id, session.generation + 2).run(); } catch { /* Expiry cleanup can remove these revoked rows later. */ }
}
