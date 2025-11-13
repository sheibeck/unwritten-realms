import { table, t } from 'spacetimedb/server';

export const User = table(
    { name: 'user', public: true },
    {
        identity: t.identity().primaryKey(),
        name: t.option(t.string()),
        online: t.bool(),
    }
);

export const Character = table(
    { name: 'character', public: true },
    {
        userId: t.identity().unique(),
        characterId: t.string().primaryKey(),
        name: t.string(),
        description: t.string(),
        race: t.string(),
        archetype: t.string(),
        profession: t.string(),
        startingRegion: t.string(),
        createdAt: t.string(),
        currentLocation: t.string(),
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
        level: t.option(t.i32()),
        xp: t.option(t.i32()),
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
        quests: t.option(t.string()),
    });

export const Npc = table(
    { name: 'npc', public: true },
    {
        npcId: t.string().primaryKey(),
        name: t.string(),
        description: t.string(),
        race: t.string(),
        profession: t.string(),
        maxHealth: t.i32(),
        currentHealth: t.i32(),
        maxMana: t.i32(),
        currentMana: t.i32(),
        abilities: t.string(),
        regionId: t.string(),
    });

export const Quest = table(
    { name: 'quest', public: true },
    {
        questId: t.string().primaryKey(),
        npcId: t.string(),
        name: t.string(),
        description: t.string(),
        steps: t.i32(),
        reward: t.string(),
        penalty: t.string(),
        type: t.string(),
        repeatable: t.bool(),
    });

export const Region = table(
    { name: 'region', public: true },
    {
        regionId: t.string().primaryKey(),
        description: t.string(),
        fullDescription: t.string(),
        name: t.string(),
        climate: t.string(),
        culture: t.string(),
        travelEnergyCost: t.i32(),
        tier: t.i32(),
        isStarterRegion: t.bool(),
        linkedRegionIds: t.array(t.string()),
        resources: t.array(t.string()),
    });
