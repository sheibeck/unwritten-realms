import { ref } from 'vue';
import type { DbConnection, Character } from '../module_bindings';

export function useCharacters(conn: DbConnection | null) {
  const characters = ref<Map<string, Character>>(new Map());
  
  if (!conn) {
    console.warn('No connection provided');
    return { characters };
  }

  conn.db.character.onInsert((_ctx, character) => {
    const updated = new Map(characters.value);
    updated.set(character.characterId, character);
    characters.value = updated;

    console.log('🧙‍♂️ New character inserted:', updated);
  });

  conn.db.character.onUpdate((_ctx, oldCharacter, newCharacter) => {
    const updated = new Map(characters.value);
    updated.delete(oldCharacter.characterId);
    updated.set(newCharacter.characterId, newCharacter);
    characters.value = updated;

    console.log('🧙‍♂️ Updated character:', updated);
  });

  conn.db.character.onDelete((_ctx, character) => {
    const updated = new Map(characters.value);
    updated.delete(character.characterId);
    characters.value = updated;

    console.log('🧙‍♂️ Deleted character:', updated);
  });

    // ✅ Moved reducer event listener here
  conn.reducers.onAddCharacter((e) => {
    if (e.event.status.tag === "Failed") {
      console.error("AddCharacter failed:", e.event.status.value);
    } else {
      console.log("AddCharacter succeeded");
    }
  });

  // ✅ Provide reducer call as part of the composable's return
  function addCharacter(name: string, race: string, profession: string, specialization: string, startingRegion: string) {
    if (!conn) {
      console.warn('No active SpaceTimeDB connection');
      return;
    }

    conn.reducers.addCharacter(name, race, profession, specialization, startingRegion);
  }

  return {
    characters,
    addCharacter,  // ✅ expose reducer function
  };
}
