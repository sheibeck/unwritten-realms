import { defineStore } from 'pinia';
import { ref, shallowRef, computed, watch } from 'vue';
import type {
  Character,
  AddCharacter,
  UpdateCharacter,
  Region
} from '@/spacetimedb/client';
import { useMainStore } from './mainStore';
import { useRegionStore } from './regionStore';
import { emitPhase } from '@/engine/onboardingEvents';

export const useCharacterStore = defineStore('characterStore', () => {
  const characters = ref<Map<string, Character>>(new Map());
  const currentCharacter = shallowRef<Character | null>();
  const mainStore = useMainStore();
  const regionStore = useRegionStore();
  // Direct reference to mainStore SpaceTime connection ref (force ref shape)
  const connection = computed(() => mainStore.connection);
  // Watch for connection becoming available and initialize automatically
  watch(
    () => connection.value,
    (conn) => {
      if (conn) initialize();
    },
    { immediate: true }
  );

  function initialize() {
    const conn = connection.value;
    if (!conn) {
      console.warn('No connection provided to characterStore');
      return;
    }

    // Setup event listeners
    conn.db.character.onInsert((_ctx: any, character: Character) => {
      const updated = new Map(characters.value);
      updated.set(character.characterId, character);
      characters.value = updated;
      console.debug('🧙‍♂️ New character inserted:', updated);

      if (character.userId.toHexString() === mainStore.currentUser?.identity.toHexString()) {
        currentCharacter.value = character;
      }
    });

    conn.db.character.onUpdate((_ctx: any, oldCharacter: Character, newCharacter: Character) => {
      const updated = new Map(characters.value);
      updated.delete(oldCharacter.characterId);
      updated.set(newCharacter.characterId, newCharacter);
      characters.value = updated;
      console.debug('🧙‍♂️ Updated character:', updated);
    });

    conn.db.character.onDelete((_ctx: any, character: Character) => {
      const updated = new Map(characters.value);
      updated.delete(character.characterId);
      characters.value = updated;
      console.debug('🧙‍♂️ Deleted character:', updated);

      if (character.userId.toHexString() === mainStore.currentUser?.identity.toHexString()) {
        currentCharacter.value = null;
      }
    });

    conn.reducers.onAddCharacter((e: any) => {
      if (e.event.status.tag === 'Failed') {
        console.error('AddCharacter failed:', e.event.status.value);
      } else {
        console.debug('AddCharacter succeeded');
      }
    });

    conn.reducers.onUpdateCharacter((e: any) => {
      if (e.event.status.tag === 'Failed') {
        console.error('UpdateCharacter failed:', e.event.status.value);
      } else {
        console.log('UpdateCharacter succeeded');
      }
    });
  }

  function addCharacter(character: AddCharacter) {
    if (!connection.value) {
      console.warn('No active SpaceTimeDB connection');
      return;
    }
    // Sanitize & validate before reducer call to avoid fatal errors
    try {
      const numericKeys = ['strength', 'dexterity', 'intelligence', 'constitution', 'wisdom', 'charisma', 'maxHealth', 'currentHealth', 'maxMana', 'currentMana', 'level', 'xp'] as const;
      for (const k of numericKeys) {
        const v: any = (character as any)[k];
        if (v === '' || v === null || v === undefined || isNaN(Number(v))) {
          throw new Error(`Numeric field '${k}' invalid: ${v}`);
        }
        (character as any)[k] = Number(v);
      }
      const stringKeys = ['name', 'description', 'race', 'archetype', 'profession', 'startingRegion', 'raceAbilities', 'professionAbilities', 'equippedWeapon'] as const;
      for (const k of stringKeys) {
        let v: any = (character as any)[k];
        if (v === null || v === undefined) v = '';
        if (typeof v !== 'string') v = String(v);
        (character as any)[k] = v.trim();
        if ((character as any)[k].length === 0) {
          // Provide minimal placeholder to satisfy non-null string requirement without leaking internals
          (character as any)[k] = 'unknown';
        }
      }
      // Ensure startingRegion references an existing region if possible
      if (!(character as any).startingRegion || (character as any).startingRegion === 'unknown') {
        const currentRegion = regionStore.currentRegion;
        if (currentRegion?.regionId) (character as any).startingRegion = currentRegion.regionId; else (character as any).startingRegion = 'origin';
      }
    } catch (e) {
      console.error('[characterStore] validation failed, aborting addCharacter:', e);
      return;
    }
    console.debug('[characterStore] invoking addCharacter reducer with payload:', character);
    // Pass all required arguments explicitly
    connection.value.reducers.addCharacter(
      character.name,
      character.description,
      character.race,
      character.archetype,
      character.profession,
      character.startingRegion,
      character.strength,
      character.dexterity,
      character.intelligence,
      character.constitution,
      character.wisdom,
      character.charisma,
      character.maxHealth,
      character.currentHealth,
      character.maxMana,
      character.currentMana,
      character.raceAbilities,
      character.professionAbilities,
      character.level,
      character.xp,
      character.equippedWeapon
    );
  }

  function updateCharacter(character: UpdateCharacter) {
    if (!connection.value) {
      console.warn('No active SpaceTimeDB connection');
      return;
    }
    // Pass all required arguments explicitly
    connection.value.reducers.updateCharacter(
      character.characterId,
      character.name,
      character.description,
      character.currentLocation,
      character.strength,
      character.dexterity,
      character.intelligence,
      character.constitution,
      character.wisdom,
      character.charisma,
      character.maxHealth,
      character.currentHealth,
      character.maxMana,
      character.currentMana,
      character.raceAbilities,
      character.professionAbilities,
      character.armorType,
      character.inventoryItems,
      character.head,
      character.shoulders,
      character.back,
      character.chest,
      character.arms,
      character.hands,
      character.legs,
      character.feet,
      character.rings,
      character.necklace,
      character.earrings,
      character.relic,
      character.equippedWeapon
    );
  }

  function setCurrentCharacter(character: Character | null) {
    currentCharacter.value = character;
  }

  function setCurrentCharacterLocation(region: Region) {
    if (currentCharacter.value) {
      const updatedCharacter = { characterId: currentCharacter.value.characterId, currentLocation: region.regionId };
      updateCharacter(updatedCharacter as UpdateCharacter);

      //update current region
      regionStore.setCurrentRegion(region);
      const connectedRegions = regionStore.findConnectedRegions(region.regionId);
      regionStore.setLinkedRegion(connectedRegions);
      emitPhase('SPAWN_REGION', mainStore.currentUserId || null, { regionId: region.regionId });
      // Placeholder zone emission until zones implemented
      emitPhase('SPAWN_ZONE', mainStore.currentUserId || null, { regionId: region.regionId, zoneId: 'entry' });
      // Emit ARRIVAL_DESCRIBE phase for narrative handoff
      emitPhase('ARRIVAL_DESCRIBE', mainStore.currentUserId || null, { regionId: region.regionId, zoneId: 'entry' });
    } else {
      console.error("No current character!");
    }
  }

  // Stub quest logging helper used by interaction engine
  function logQuest(data: { characterId?: string; quests: { questId: string; step: number; status: string }[] }) {
    // This function needs to be refactored to match the new UpdateCharacter signature or removed if not needed
    if (!data.characterId) return;
    // updateCharacter({ characterId: data.characterId, quests: data.quests } as UpdateCharacter); // REMOVE or REFACTOR
  }

  return {
    characters,
    initialize,
    addCharacter,
    updateCharacter,
    setCurrentCharacter,
    currentCharacter,
    setCurrentCharacterLocation,
    logQuest,
  };
});
