import { t, SenderError } from 'spacetimedb/server';
import { spacetimedb } from './schema';
import { uuidv4 } from './uuid';

export function registerRegionReducers() {
    // uuidv4 imported from ./uuid

    spacetimedb.reducer('create_starter_region', {
        name: t.string(),
        description: t.string(),
        fullDescription: t.string(),
        climate: t.string(),
        culture: t.string(),
        resources: t.array(t.string()),
    }, (ctx, input) => {
        ctx.db.region.insert({
            regionId: uuidv4(),
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
        const regionId = uuidv4();
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
}
