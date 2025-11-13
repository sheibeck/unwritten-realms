import { schema, table, t, SenderError } from 'spacetimedb/server';

// User Table
const User = table(
    { name: 'user', public: true },
    {
        identity: t.identity().primaryKey(),
        name: t.option(t.string()),
        online: t.bool(),
    }
);

// Character Table
const Character = table(
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
        quests: t.option(t.string()), // Store as JSON string for simplicity
    });

// NPC Table
const Npc = table(
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

// Quest Table
const Quest = table(
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

// Region Table
const Region = table(
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

export const spacetimedb = schema(User, Character, Npc, Quest, Region);

// --- Reducers ---

// User Reducers
function validateName(name: string) {
    if (!name) throw new SenderError('Names must not be empty');
}
spacetimedb.reducer('set_name', { name: t.string() }, (ctx, { name }) => {
    validateName(name);
    const user = ctx.db.user.identity.find(ctx.sender);
    if (!user) throw new SenderError('Cannot set name for unknown user');
    ctx.db.user.identity.update({ ...user, name });
});

// Character Reducers
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
    // Only update provided fields, always include required fields
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

// NPC Reducers
spacetimedb.reducer('create_npc', {
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
}, (ctx, input) => {
    ctx.db.npc.insert({
        npcId: crypto.randomUUID(),
        ...input,
    });
});

// Quest Reducers
spacetimedb.reducer('add_quest', {
    npcId: t.string(),
    name: t.string(),
    description: t.string(),
    steps: t.i32(),
    reward: t.string(),
    penalty: t.string(),
    type: t.string(),
    repeatable: t.bool(),
}, (ctx, input) => {
    ctx.db.quest.insert({
        questId: crypto.randomUUID(),
        ...input,
    });
});

// Region Reducers
spacetimedb.reducer('create_starter_region', {
    name: t.string(),
    description: t.string(),
    fullDescription: t.string(),
    climate: t.string(),
    culture: t.string(),
    resources: t.array(t.string()),
}, (ctx, input) => {
    ctx.db.region.insert({
        regionId: crypto.randomUUID(),
        name: input.name,
        description: input.description,
        fullDescription: input.fullDescription,
        climate: input.climate,
        culture: input.culture,
        travelEnergyCost: 0,
        tier: 1,
        isStarterRegion: true,
        resources: input.resources,
        linkedRegionIds: [],
    });
});

spacetimedb.reducer('link_regions', {
    regionAId: t.string(),
    regionBId: t.string(),
}, (ctx, { regionAId, regionBId }) => {
    const regionA = ctx.db.region.regionId.find(regionAId);
    const regionB = ctx.db.region.regionId.find(regionBId);
    if (!regionA || !regionB) throw new SenderError('One or both regions not found.');
    if (regionA.isStarterRegion && regionB.isStarterRegion) throw new SenderError('Cannot link two StarterRegions.');
    if (!regionA.linkedRegionIds.includes(regionBId)) {
        if (regionA.linkedRegionIds.length >= 5) throw new SenderError(`${regionA.name} cannot link to more than 5 regions.`);
        regionA.linkedRegionIds.push(regionBId);
    }
    if (!regionB.linkedRegionIds.includes(regionAId)) {
        if (regionB.linkedRegionIds.length >= 5) throw new SenderError(`${regionB.name} cannot link to more than 5 regions.`);
        regionB.linkedRegionIds.push(regionAId);
    }
    ctx.db.region.regionId.update(regionA);
    ctx.db.region.regionId.update(regionB);
});

spacetimedb.reducer('create_and_link_new_region', {
    fromRegionId: t.string(),
    name: t.string(),
    description: t.string(),
    fullDescription: t.string(),
    climate: t.string(),
    culture: t.string(),
    tier: t.i32(),
    travelEnergyCost: t.i32(),
    resources: t.array(t.string()),
}, (ctx, input) => {
    const fromRegion = ctx.db.region.regionId.find(input.fromRegionId);
    if (!fromRegion) throw new SenderError('From-region not found.');
    if (fromRegion.linkedRegionIds.length >= 5) throw new SenderError(`${fromRegion.name} cannot link to more than 5 regions.`);
    const regionId = crypto.randomUUID();
    const newRegion = ctx.db.region.insert({
        regionId,
        name: input.name,
        description: input.description,
        fullDescription: input.fullDescription,
        climate: input.climate,
        culture: input.culture,
        travelEnergyCost: input.travelEnergyCost,
        tier: input.tier,
        isStarterRegion: false,
        resources: input.resources,
        linkedRegionIds: [fromRegion.regionId],
    });
    fromRegion.linkedRegionIds.push(newRegion.regionId);
    ctx.db.region.regionId.update(fromRegion);
});

// Lifecycle hooks
spacetimedb.init(_ctx => { });
spacetimedb.clientConnected(ctx => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (user) {
        ctx.db.user.identity.update({ ...user, online: true });
    } else {
        ctx.db.user.insert({ identity: ctx.sender, name: undefined, online: true });
    }
});
spacetimedb.clientDisconnected(ctx => {
    const user = ctx.db.user.identity.find(ctx.sender);
    if (user) {
        ctx.db.user.identity.update({ ...user, online: false });
    } else {
        // Shouldn't happen (disconnect without prior connect)
        console.warn(`Disconnect event for unknown user with identity ${ctx.sender}`);
    }
});
spacetimedb.reducer('clear_users', ctx => {
    for (const user of ctx.db.user.iter()) {
        ctx.db.user.identity.delete(user.identity);
    }
});
