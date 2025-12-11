import { defineStore } from 'pinia';

type CharacterRow = {
    id: string;
    owner_id?: string;
    name: string;
    race?: string;
    archetype?: string;
    profession_json?: string;
    stats_json?: string;
};

export const useCharactersStore = defineStore('characters', {
    state: () => ({
        characters: [] as CharacterRow[],
        activeCharacter: null as CharacterRow | null
    }),
    actions: {
        setCharacters(list: CharacterRow[]) {
            this.characters = list;
        },
        upsertCharacter(row: CharacterRow) {
            const idx = this.characters.findIndex(c => c.id === row.id);
            if (idx >= 0) this.characters[idx] = row;
            else this.characters.unshift(row);
        },
        setActiveCharacter(row: CharacterRow | null) {
            this.activeCharacter = row;
        }
    }
});
