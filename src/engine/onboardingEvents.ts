// Lightweight instrumentation for onboarding phase transitions
// Non-persistent in MVP; can be wired to analytics later.

export type OnboardingPhase =
  | 'AUTH'
  | 'CHECK_CHARACTER'
  | 'INITIATION'
  | 'CONCEPT'
  | 'REFINEMENT'
  | 'CONFIRMATION'
  | 'PERSISTENCE'
  | 'SPAWN_REGION'
  | 'SPAWN_ZONE'
  | 'ARRIVAL_DESCRIBE'
  | 'WORLD'
  | 'ERROR';

export interface PhaseEvent {
  phase: OnboardingPhase;
  userId: string | null;
  ts: number;
  meta?: Record<string, any>;
}

const eventBuffer: PhaseEvent[] = [];
const listeners: ((evt: PhaseEvent) => void)[] = [];

export function emitPhase(phase: OnboardingPhase, userId: string | null, meta?: Record<string, any>) {
  const evt: PhaseEvent = { phase, userId, ts: Date.now(), meta };
  eventBuffer.push(evt);
  // keep last 100
  if (eventBuffer.length > 100) eventBuffer.shift();
  for (const l of listeners) l(evt);
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.debug(`[onboarding] phase=${phase}`, meta || '');
  }
}

export function getRecentPhases(): PhaseEvent[] {
  return [...eventBuffer];
}

export function onPhase(listener: (evt: PhaseEvent) => void) {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}
