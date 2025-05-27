import { ref } from 'vue';
import type { DbConnection, Region } from '../module_bindings/client';

export function useRegions(conn: DbConnection | null) {
  const regions = ref<Map<string, Region>>(new Map());

  if (!conn) {
    console.warn('No connection provided to useRegions');
    return { regions };
  }

  conn.db.region.onInsert((_ctx, region) => {
    const updated = new Map(regions.value);
    updated.set(region.regionId, region);
    regions.value = updated;

    console.log('🌍 New region inserted:', region);
  });

  conn.db.region.onUpdate((_ctx, oldRegion, newRegion) => {
    const updated = new Map(regions.value);
    updated.delete(oldRegion.regionId);
    updated.set(newRegion.regionId, newRegion);
    regions.value = updated;

    console.log('🌍 Region updated:', newRegion);
  });

  conn.db.region.onDelete((_ctx, region) => {
    const updated = new Map(regions.value);
    updated.delete(region.regionId);
    regions.value = updated;

    console.log('🌍 Region deleted:', region);
  });

  return {
    regions,
  };
}
