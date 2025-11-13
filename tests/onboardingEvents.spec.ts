import { describe, it, expect } from 'vitest';
import { emitPhase, getRecentPhases, onPhase, type OnboardingPhase } from '../src/engine/onboardingEvents.ts';

describe('onboardingEvents instrumentation', () => {
  it('emits phases in order', () => {
    const received: OnboardingPhase[] = [];
    const off = onPhase(evt => received.push(evt.phase));
    emitPhase('AUTH', 'user1');
    emitPhase('CHECK_CHARACTER', 'user1');
    emitPhase('INITIATION', 'user1');
    off();
    expect(received).toEqual(['AUTH','CHECK_CHARACTER','INITIATION']);
  });

  it('buffers last 100 events only', () => {
    for (let i=0;i<120;i++) {
      emitPhase('REFINEMENT', 'u', { iteration: i });
    }
    const events = getRecentPhases();
    expect(events.length).toBeLessThanOrEqual(100);
    // first retained should correspond to iteration 20
    const first = events[0];
    expect(first.meta?.iteration).toBe(20);
  });
});
