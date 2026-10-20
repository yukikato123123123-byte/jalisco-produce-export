import { Localized } from '../localization';
import { verificationStates } from '../sampleData';
import type { VerificationState } from '../sampleData';

export function StatusBadge({ state, label }: { state: VerificationState; label?: string }) {
  const status = verificationStates[state];
  return <Localized><span className={`verification-badge state-${state}`} title={`${status.label}: ${status.description}`} data-state={state}>{label ?? status.label}</span></Localized>;
}
