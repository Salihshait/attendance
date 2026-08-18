// Mirrors the eligibility/state-transition logic enforced server-side by
// web_checkin_punch() (0057) -- used to drive the dashboard widget's button
// states instantly, without waiting on a round trip. The RPC re-validates
// everything itself and is the real gate; this only decides what the UI
// should show.

export type WebCheckinPunchType = 'in' | 'out';

export interface WebCheckinState {
  enabled: boolean;
  isWfhToday: boolean;
  lastPunchType: WebCheckinPunchType | null;
}

export interface WebCheckinAction {
  canCheckIn: boolean;
  canCheckOut: boolean;
  blockedReason: string | null;
}

export function deriveWebCheckinAction(state: WebCheckinState): WebCheckinAction {
  if (!state.enabled) {
    return { canCheckIn: false, canCheckOut: false, blockedReason: 'Web check-in is not enabled for your account. Contact HR.' };
  }
  if (!state.isWfhToday) {
    return { canCheckIn: false, canCheckOut: false, blockedReason: 'Available only on an approved Work From Home day.' };
  }
  const checkedIn = state.lastPunchType === 'in';
  return { canCheckIn: !checkedIn, canCheckOut: checkedIn, blockedReason: null };
}
