using SpacetimeDB;

public static partial class Module
{
    [Table(Name = "region", Public = true)]
    public partial struct Region
    {
        [Unique, PrimaryKey]
        public string RegionId;                 // e.g., "crimson-wastes"
        public string Name;                     // e.g., "Crimson Wastes"
        public string Climate;                 // e.g., "Arid, red sands"
        public string Culture;                 // e.g., "Nomadic raiders"
        public int TravelEnergyCost;           // cost to enter (SpaceTimeDB energy)
        public int Tier;                       // 1-5
        public bool IsStarterRegion;           // entry zone or not
        public List<string> LinkedRegionIds;   // list of linked region IDs (max 5)
    }

    [Reducer]
    public static void CreateStarterRegion(ReducerContext ctx, string name, string climate, string culture)
    {
        var region = ctx.Db.region.Insert(new Region
        {
            RegionId = Guid.NewGuid().ToString("N"),
            Name = name,
            Climate = climate,
            Culture = culture,
            TravelEnergyCost = 0,
            Tier = 1,
            IsStarterRegion = true,
            LinkedRegionIds = new List<string>()
        });

        Log.Info($"[CreateStarterRegion] Created new starter region: {region.Name} ({region.RegionId})");
    }

    [Reducer]
    public static void LinkRegions(ReducerContext ctx, string regionAId, string regionBId)
    {
        var regionAOpt = ctx.Db.region.RegionId.Find(regionAId);
        var regionBOpt = ctx.Db.region.RegionId.Find(regionBId);

        if (regionAOpt is not { } regionA || regionBOpt is not { } regionB)
            throw new Exception("One or both regions not found.");

        if (regionA.IsStarterRegion && regionB.IsStarterRegion)
            throw new Exception("Cannot link two StarterRegions.");

        if (!regionA.LinkedRegionIds.Contains(regionBId))
        {
            if (regionA.LinkedRegionIds.Count >= 5)
                throw new Exception($"{regionA.Name} cannot link to more than 5 regions.");
            regionA.LinkedRegionIds.Add(regionBId);
        }

        if (!regionB.LinkedRegionIds.Contains(regionAId))
        {
            if (regionB.LinkedRegionIds.Count >= 5)
                throw new Exception($"{regionB.Name} cannot link to more than 5 regions.");
            regionB.LinkedRegionIds.Add(regionAId);
        }

        ctx.Db.region.RegionId.Update(regionA);
        ctx.Db.region.RegionId.Update(regionB);

        Log.Info($"[LinkRegions] Linked {regionA.Name} ({regionAId}) <--> {regionB.Name} ({regionBId})");
    }

    [Reducer]
    public static void CreateAndLinkNewRegion(
        ReducerContext ctx,
        string fromRegionId,
        string name,
        string climate,
        string culture,
        int tier,
        int travelEnergyCost)
    {
        var fromRegionOpt = ctx.Db.region.RegionId.Find(fromRegionId);
        if (fromRegionOpt is not { } fromRegion)
            throw new Exception("From-region not found.");

        if (fromRegion.LinkedRegionIds.Count >= 5)
            throw new Exception($"{fromRegion.Name} cannot link to more than 5 regions.");

        var newRegion = ctx.Db.region.Insert(new Region
        {
            RegionId = Guid.NewGuid().ToString("N"),
            Name = name,
            Climate = climate,
            Culture = culture,
            TravelEnergyCost = travelEnergyCost,
            Tier = tier,
            IsStarterRegion = false,
            LinkedRegionIds = new List<string> { fromRegion.RegionId }
        });

        fromRegion.LinkedRegionIds.Add(newRegion.RegionId);
        ctx.Db.region.RegionId.Update(fromRegion);

        Log.Info($"[CreateAndLinkNewRegion] Created and linked new region {newRegion.Name} ({newRegion.RegionId}) to {fromRegion.Name} ({fromRegion.RegionId})");
    }
}
