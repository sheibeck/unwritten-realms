import { defineStore } from 'pinia';
import type { DbConnection } from '../module_bindings';

export type CharacterRow = {
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
        activeCharacter: null as CharacterRow | null,
        _charactersSubscriptionActive: false,
        _characterHandlersBound: false
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
        removeCharacter(id: string) {
            const idx = this.characters.findIndex(c => c.id === id);
            if (idx === -1) return;
            this.characters.splice(idx, 1);
            if (this.activeCharacter?.id === id) {
                this.activeCharacter = this.characters[0] ?? null;
            }
        },
        setActiveCharacter(row: CharacterRow | null) {
            this.activeCharacter = row;
        },
        subscribeToCharacters(conn: DbConnection, ownerIdentityHex: string) {
            if (this._charactersSubscriptionActive) {
                return;
            }
            if (!conn?.db?.characters) {
                console.warn('characters table bindings missing; cannot sync store');
                return;
            }

            const charactersTable = conn.db.characters;
            const seedFromCache = () => {
                const iterator = charactersTable.iter?.();
                if (!iterator) return;
                const list: CharacterRow[] = [];
                for (const row of iterator) {
                    list.push(row as CharacterRow);
                }
                this.setCharacters(list);
                if (!this.activeCharacter && list.length) {
                    this.setActiveCharacter(list[0]);
                }
            };

            const handleInsert = (_ctx: unknown, row: CharacterRow) => {
                this.upsertCharacter(row);
                if (!this.activeCharacter) {
                    this.setActiveCharacter(row);
                }
            };
            const handleUpdate = (_ctx: unknown, row: CharacterRow) => {
                this.upsertCharacter(row);
            };
            const handleDelete = (_ctx: unknown, row: CharacterRow) => {
                this.removeCharacter(row.id);
            };

            conn.subscriptionBuilder()
                .onApplied(() => {
                    seedFromCache();
                    if (this._characterHandlersBound) {
                        return;
                    }
                    charactersTable.onInsert(handleInsert);
                    charactersTable.onUpdate(handleUpdate);
                    charactersTable.onDelete(handleDelete);
                    this._characterHandlersBound = true;
                })
                .subscribe([
                    `SELECT * FROM characters WHERE owner_id = '${ownerIdentityHex}'`
                ]);

            this._charactersSubscriptionActive = true;
        }
    }
});
