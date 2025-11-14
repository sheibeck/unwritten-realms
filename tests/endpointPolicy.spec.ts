import { describe, it, expect } from 'vitest';
import { shouldStream } from '../src/engine/endpointPolicy';

describe('endpointPolicy.shouldStream', () => {
    it('streams known narrative-rich actions', () => {
        expect(shouldStream('world.general')).toBe(true);
        expect(shouldStream('character.create')).toBe(true);
        expect(shouldStream('region.create')).toBe(true);
    });

    it('does not stream non-listed actions', () => {
        expect(shouldStream('system.health')).toBe(false);
        expect(shouldStream('inventory.list')).toBe(false);
    });
});
