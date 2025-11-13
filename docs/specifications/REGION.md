# Feature Specification: Region Management

## 1. Purpose
Define, create, and connect regions forming the traversable world graph. Regions encapsulate descriptive lore and gameplay metadata (climate, resources, tier, travel energy cost).

## 2. Scope
In Scope:
- Starter region creation (bootstrap world for new players)
- Creation + linking of new regions to existing ones
- Setting current region and retrieving connected regions
- Regions graph queries (find by id, name, adjacency)
Out of Scope (initial):
- Region deletion (admin only, not implemented)
- Dynamic climate/resource changes (future events system)
- Pathfinding beyond 1-hop adjacency

## 3. Actors & Preconditions
Actors: Player, System (future auto-generation)
Preconditions:
- Authenticated user (for creation)
- World has at least one starter region (or create via first player)

## 4. Data Model
Fields:
- `regionId: string`
- `name: string`
- `description: string` (short)
- `fullDescription: string` (lore)
- `climate: string`
- `culture: string`
- `tier: number` (difficulty / advancement gating)
- `travelEnergyCost: number`
- `resources: string[]`
- `linkedRegionIds: string[]`
Open Questions:
- Are links stored bidirectionally automatically? (Assumption: reducer enforces symmetrical link)
- Max links per region? (No limit initial)

## 5. Flows
Flow: Create Starter Region
1. Player triggers starter creation if no character/region exists
2. Reducer `createStarterRegion` called
3. Region inserted; store updates; may become current region for initial character

Flow: Create and Link New Region
1. Player selects existing region as origin
2. Fills form (name, climate, etc.)
3. `createAndLinkNewRegion` reducer called with fromRegionId + new region data
4. Wait for subscription insert where new region includes `fromRegionId` in `linkedRegionIds`

Flow: Set Current Region / Discover Links
1. After travel or creation, `setCurrentRegion(region)`
2. `findConnectedRegions(region.regionId)` populates adjacency list for UI

## 6. Reducer Contracts (Assumed)
`createStarterRegion(name, description, fullDescription, climate, culture, resources)`
Validation:
- Name unique? (Assumption: allow duplicates globally, uniqueness optional)
- At least one resource
Errors:
- Invalid empty name

`createAndLinkNewRegion(fromRegionId, name, description, fullDescription, climate, culture, tier, travelEnergyCost, resources)`
Validation:
- `fromRegionId` exists
- `travelEnergyCost >= 0`
- `tier >= 0`
- Non-empty name
Errors:
- Origin region missing -> fail
- Negative tier or cost -> fail

## 7. UI & Store Integration
Pinia: `regionStore`
Components:
- `TravelPanel.vue`: displays linked regions for travel target selection
- World-building UI (future) for new region creation

## 8. Edge Cases
- Linking to the same region (self-loop) -> disallow
- Duplicate linking (id already present) -> ignore or error
- Large graph growth causing performance issues in scanning adjacency (optimize with indexing later)

## 9. Validation Rules (Client Hints)
- Prevent self-link attempts
- Validate numeric fields >= 0 prior to reducer call
- Present user feedback for creation timeout (currently 15s)

## 10. Metrics
- Average region creation confirmation time
- Total number of regions & average links per region
- Timeout rate for region creation

## 11. Telemetry Hooks (Future)
- Log region creation (userId, timestamp, fromRegionId)
- Track travelEnergyCost distribution

## 12. Graph Considerations
Initial graph: sparse; players manually expand
Future: procedural generation modules may auto-link new regions (WORLD_ENGINE spec dependency)

## 13. Open Issues
- Directionality of links ambiguity
- Need batch creation API for world seeding
- Tier meaning definition (difficulty, resource richness?)

## 14. Future Enhancements
- Region categories / biome taxonomy
- Dynamic events altering resources
- Region ownership / faction control

Status: Draft v0.1
