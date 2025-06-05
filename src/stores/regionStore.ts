import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import type { CreateAndLinkNewRegion, Region } from '@/module_bindings/client';
import { useMainStore } from './mainStore';

export const useRegionStore = defineStore('regionStore', () => {
  const regions = ref<Map<string, Region>>(new Map());
  const currentRegion = shallowRef<Region | null>();
  const linkedRegions = shallowRef<Array<Region>>([]);
  const mainStore = useMainStore();
  const connection = computed(() => mainStore.connection);

  function initialize() {
    if (!connection.value) {
      console.warn('No connection provided to regionStore');
      return;
    }

    connection.value.db.region.onInsert((_ctx, region) => {
      const updated = new Map(regions.value);
      updated.set(region.regionId, region);
      regions.value = updated;
      console.log('🌍 New region inserted:', region);
    });

    connection.value.db.region.onUpdate((_ctx, oldRegion, newRegion) => {
      const updated = new Map(regions.value);
      updated.delete(oldRegion.regionId);
      updated.set(newRegion.regionId, newRegion);
      regions.value = updated;
      console.log('🌍 Region updated:', newRegion);
    });

    connection.value.db.region.onDelete((_ctx, region) => {
      const updated = new Map(regions.value);
      updated.delete(region.regionId);
      regions.value = updated;
      console.log('🌍 Region deleted:', region);
    });
  }

  function createAndLinkNewRegion(data: CreateAndLinkNewRegion) {
    if (!connection.value) {
      console.warn('No active SpaceTimeDB connection');
      return;
    }

    connection.value.reducers.createAndLinkNewRegion(
      data.fromRegionId,
      data.name,
      data.description,
      data.climate,
      data.culture,
      data.tier,
      data.travelEnergyCost
    );
  }

  function setCurrentRegion(region: Region | null) {
    currentRegion.value = region;
  }

  function setLinkedRegion(newRegions: Region[]) {
    linkedRegions.value.splice(0, linkedRegions.value.length, ...newRegions);
  }

  return {
    regions,
    initialize,
    createAndLinkNewRegion,
    setCurrentRegion,
    setLinkedRegion,
    currentRegion,
    linkedRegions,
  };
});
