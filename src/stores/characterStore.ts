import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type {
  Character,
  AddCharacter,
  UpdateCharacter,
  Region
} from '../spacetimedb';
import { useMainStore } from './mainStore';
import { useRegionStore } from './regionStore';
import { emitPhase } from '@/engine/onboardingEvents';
import type { DbConnection } from '../spacetimedb';

export const useCharacterStore = defineStore('characterStore', () => {
  const characters = ref<Map<string, Character>>(new Map());
  const currentCharacter = shallowRef<Character | null>();
  const mainStore = useMainStore();
  const regionStore = useRegionStore();
  // Direct reference to mainStore SpaceTime connection ref (force ref shape)
  interface ConnectionRef { value: DbConnection | null }
  const connection = mainStore.connection as unknown as ConnectionRef;

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

      if (character.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
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

      if (character.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
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
