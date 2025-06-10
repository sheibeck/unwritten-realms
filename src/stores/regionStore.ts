import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import type { CreateAndLinkNewRegion, CreateStarterRegion, Region } from '@/module_bindings/client';
import { useMainStore } from './mainStore';
import { useCharacterStore } from './characterStore';

export const useRegionStore = defineStore('regionStore', () => {
  const regions = ref<Map<string, Region>>(new Map());
  const currentRegion = shallowRef<Region | null>();
  const linkedRegions = shallowRef<Array<Region>>([]);
  const mainStore = useMainStore();
  const characterStore = useCharacterStore();
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

  function createAndLinkNewRegion(data: CreateAndLinkNewRegion): Promise<Region> {
    return new Promise((resolve, reject) => { 
      if (!connection.value) {
        console.warn('No active SpaceTimeDB connection');
        return;
      }

      const builder = connection.value.subscriptionBuilder();
      const qid = builder.subscribe([`SELECT * FROM region WHERE name = '${data.name}'`]);

      connection.value.db.region.onInsert((_ctx, region) => {
        if (region.name === data.name && region.linkedRegionIds.includes(data.fromRegionId)) {
          resolve(region);
          qid.unsubscribe();
        }
      });

      connection.value.reducers.createAndLinkNewRegion(
        data.fromRegionId,
        data.name,
        data.description,
        data.fullDescription,
        data.climate,
        data.culture,
        data.tier,
        data.travelEnergyCost,
        data.resources
      );

      setTimeout(() => reject('Timed out waiting for region creation'), 15000);
    });
  }

  function createStarterRegion(data: CreateStarterRegion) {
    if (!connection.value) {
      console.warn('No active SpaceTimeDB connection');
      return;
    }

    connection.value.reducers.createStarterRegion(
      data.name,
      data.description,
      data.fullDescription,
      data.climate,
      data.culture,
      data.resources,
    );
  }
  

  function setCurrentRegion(region: Region | null) {
    currentRegion.value = region;
  }

  function setLinkedRegion(newRegions: Region[]) {
    linkedRegions.value.splice(0, linkedRegions.value.length, ...newRegions);
  }

  const findRegionById = (id: string): Region | undefined => {
    return regions.value.get(id);
  };

  const findRegionByName = (name: string): Region | undefined => {
    return Array.from(regions.value.values()).find((region: Region) => {
      return region.name === name;
    });
  };

  const findConnectedRegions = (targetRegionId: string): Region[] => {
    return Array.from(regions.value.values()).filter(region =>
      region.linkedRegionIds.includes(targetRegionId)
    );
  };

  return {
    regions,
    initialize,
    createAndLinkNewRegion,
    setCurrentRegion,
    setLinkedRegion,
    currentRegion,
    linkedRegions,
    createStarterRegion,
    findRegionById,
    findRegionByName,
    findConnectedRegions,
  };
});
