import {Failure} from './provider.ts';
export function text(b: Record<string, unknown>, k: string, max: number, required = false) {
  const v = b[k] ?? '';
  if (typeof v !== 'string' || v.length > max || (required && !v.trim())) throw new Failure(400, `Enter a valid ${k} (maximum ${max} characters).`);
  return v.trim();
}
