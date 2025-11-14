import { describe, it, expect } from 'vitest';
import { classifyAction, assistantMap, resolveAssistant } from '../src/engine/assistantMap.ts';

// normalizeAction removed; callers must use canonical action strings.

describe('classifyAction', () => {
  it('detects character creation', () => {
    expect(classifyAction('Please create character named Aria')).toBe('character.create');
  });
  it('detects travel', () => {
    expect(classifyAction('I want to travel to the northern pass')).toBe('travel.move');
  });
  it('detects zone movement', () => {
    expect(classifyAction('Move within the region toward the mossy clearing')).toBe('travel.zone.move');
  });
  it('detects zone description', () => {
    expect(classifyAction('Describe the current area around us')).toBe('region.zone.describe');
  });
  it('falls back to world.general', () => {
    expect(classifyAction('Tell me about the history of this place')).toBe('world.general');
  });
});

describe('resolveAssistant', () => {
  it('resolves world.general correctly', () => {
    const a = resolveAssistant('world.general');
    expect(a.name).toMatch(/World Engine Resolver/);
  });
  it('resolves unknown to world engine fallback', () => {
    const a = resolveAssistant('not-real-action');
    expect(a.name).toMatch(/World Engine Resolver/);
  });
});

// Basic coverage of mapping presence
it('has mapping entries for all canonical actions except unknown handled separately', () => {
  const keys = Object.keys(assistantMap);
  expect(keys).toContain('character.create');
  expect(keys).toContain('travel.move');
  expect(keys).toContain('world.general');
});
