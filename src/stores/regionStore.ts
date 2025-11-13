import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type { CreateAndLinkNewRegion, CreateStarterRegion, Region } from '@/module_bindings/client';
import { useMainStore } from './mainStore';
import type { DbConnection } from '../module_bindings/client';

export const useRegionStore = defineStore('regionStore', () => {
  const regions = ref<Map<string, Region>>(new Map());
  const currentRegion = shallowRef<Region | null>();
  const linkedRegions = shallowRef<Array<Region>>([]);
  const mainStore = useMainStore();
  interface ConnectionRef { value: DbConnection | null }
  const connection = mainStore.connection as unknown as ConnectionRef;

  function initialize() {
    if (!connection.value) {
      console.warn('No connection provided to regionStore');
      return;
    }

  connection.value.db.region.onInsert((_ctx: any, region: Region) => {
      const updated = new Map(regions.value);
      updated.set(region.regionId, region);
      regions.value = updated;
      console.debug('🌍 New region inserted:', region);
    });

  connection.value.db.region.onUpdate((_ctx: any, oldRegion: Region, newRegion: Region) => {
      const updated = new Map(regions.value);
      updated.delete(oldRegion.regionId);
      updated.set(newRegion.regionId, newRegion);
      regions.value = updated;
      console.debug('🌍 Region updated:', newRegion);
    });

  connection.value.db.region.onDelete((_ctx: any, region: Region) => {
      const updated = new Map(regions.value);
      updated.delete(region.regionId);
      regions.value = updated;
      console.debug('🌍 Region deleted:', region);
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

      const timeout = setTimeout(() => {
        qid.unsubscribe();
        reject('Timed out waiting for region creation');
      }, 15000);

  connection.value.db.region.onInsert((_ctx: any, region: Region) => {
        if (region.name === data.name && region.linkedRegionIds.includes(data.fromRegionId)) {
          clearTimeout(timeout); // ✅ cancel the timeout
          qid.unsubscribe();
          resolve(region);
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
