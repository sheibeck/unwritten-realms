import { t, SenderError } from 'spacetimedb/server';
import { spacetimedb } from './schema';

export function registerCharacterReducers() {
    spacetimedb.reducer('add_character', {
        name: t.string(),
        description: t.string(),
        race: t.string(),
        archetype: t.string(),
        profession: t.string(),
        startingRegion: t.string(),
        strength: t.i32(),
        dexterity: t.i32(),
        intelligence: t.i32(),
        constitution: t.i32(),
        wisdom: t.i32(),
        charisma: t.i32(),
        maxHealth: t.i32(),
        currentHealth: t.i32(),
        maxMana: t.i32(),
        currentMana: t.i32(),
        raceAbilities: t.string(),
        professionAbilities: t.string(),
        level: t.i32(),
        xp: t.i32(),
        equippedWeapon: t.string(),
    }, (ctx, input) => {
        const existing = ctx.db.character.userId.find(ctx.sender);
        if (existing) throw new SenderError('User already has a character.');
        ctx.db.character.insert({
            characterId: crypto.randomUUID(),
            userId: ctx.sender,
            name: input.name,
            description: input.description,
            race: input.race,
            archetype: input.archetype,
            profession: input.profession,
            startingRegion: input.startingRegion,
            createdAt: new Date().toISOString(),
            currentLocation: input.startingRegion,
            strength: input.strength,
            dexterity: input.dexterity,
            intelligence: input.intelligence,
            constitution: input.constitution,
            wisdom: input.wisdom,
            charisma: input.charisma,
            maxHealth: input.maxHealth,
            currentHealth: input.currentHealth,
            maxMana: input.maxMana,
            currentMana: input.currentMana,
            raceAbilities: input.raceAbilities ?? undefined,
            professionAbilities: input.professionAbilities ?? undefined,
            armorType: undefined,
            level: 1,
            xp: 0,
            inventoryItems: undefined,
            head: undefined,
            shoulders: undefined,
            back: undefined,
            chest: undefined,
            arms: undefined,
            hands: undefined,
            legs: undefined,
            feet: undefined,
            rings: undefined,
            necklace: undefined,
            earrings: undefined,
            relic: undefined,
            equippedWeapon: input.equippedWeapon ?? undefined,
            quests: JSON.stringify([]),
        });
    });

    spacetimedb.reducer('update_character', {
        characterId: t.string(),
        name: t.option(t.string()),
        description: t.option(t.string()),
        currentLocation: t.option(t.string()),
        strength: t.option(t.i32()),
        dexterity: t.option(t.i32()),
        intelligence: t.option(t.i32()),
        constitution: t.option(t.i32()),
        wisdom: t.option(t.i32()),
        charisma: t.option(t.i32()),
        maxHealth: t.option(t.i32()),
        currentHealth: t.option(t.i32()),
        maxMana: t.option(t.i32()),
        currentMana: t.option(t.i32()),
        raceAbilities: t.option(t.string()),
        professionAbilities: t.option(t.string()),
        armorType: t.option(t.string()),
        inventoryItems: t.option(t.string()),
        head: t.option(t.string()),
        shoulders: t.option(t.string()),
        back: t.option(t.string()),
        chest: t.option(t.string()),
        arms: t.option(t.string()),
        hands: t.option(t.string()),
        legs: t.option(t.string()),
        feet: t.option(t.string()),
        rings: t.option(t.string()),
        necklace: t.option(t.string()),
        earrings: t.option(t.string()),
        relic: t.option(t.string()),
        equippedWeapon: t.option(t.string()),
    }, (ctx, input) => {
        const character = ctx.db.character.characterId.find(input.characterId);
        if (!character) throw new SenderError('Character not found');
        ctx.db.character.characterId.update({
            ...character,
            ...Object.fromEntries(Object.entries(input).filter(([_, v]) => v !== undefined)),
        });
    });

    spacetimedb.reducer('clear_characters', ctx => {
        for (const character of ctx.db.character.iter()) {
            ctx.db.character.characterId.delete(character.characterId);
        }
    });
}
