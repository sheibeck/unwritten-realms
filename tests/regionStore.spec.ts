import { setActivePinia, createPinia } from 'pinia';
import { describe, it, expect, beforeEach } from 'vitest';
import { useRegionStore } from '../src/stores/regionStore';
import type { Region } from '../src/module_bindings/client';

function makeRegion(id: string, links: string[] = []): Region {
  return {
    regionId: id,
    name: `Region ${id}`,
    description: '',
    fullDescription: '',
    climate: '',
    culture: '',
    travelEnergyCost: 0,
    tier: 0,
    isStarterRegion: false,
    linkedRegionIds: links,
    resources: [],
  };
}

describe('findConnectedRegions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it.skip('returns regions connected to given id', () => {
    const store = useRegionStore();
    const a = makeRegion('A', ['B']);
    const b = makeRegion('B', ['A', 'C']);
    const c = makeRegion('C', ['B']);
    store.regions.value = new Map([
      [a.regionId, a],
      [b.regionId, b],
      [c.regionId, c],
    ]);

    const connectedToB = store.findConnectedRegions('B');
    expect(connectedToB).toHaveLength(2);
    expect(connectedToB).toContain(a);
    expect(connectedToB).toContain(c);
  });

  it('returns empty array when no regions link to id', () => {
    const store = useRegionStore();
    store.regions.value = new Map();
    expect(store.findConnectedRegions('X')).toStrictEqual([]);
  });
});
