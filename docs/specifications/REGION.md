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

## 15. AI Resolver Prompts
Region-related generation utilizes OpenAI Assistant prompts:
- `region_creation_resolver_prompt.txt` – Suggests lore & attributes for new regions.
- `region_travel_resolver_prompt.txt` – Provides narrative context and potential travel event hooks.

Location & Structure:
- Stored under `ai/region/` with YAML front-matter (assistant metadata + checksum).
- Folder naming follows first token rule; filenames lowercase with underscores + `_prompt.txt` suffix.

Deterministic Guardrails:
- Generated descriptive/lore output is sanitized; structural fields (links, tier, costs) validated by reducers.

Version Traceability:
- Optional future enhancement: record prompt checksum alongside created region for historical attribution.

Status: Draft v0.1 + AI prompt integration note

## 16. Zones (Intra-Region Subareas)
Purpose: Provide lightweight granularity for movement and description within a single region ("forest clearing", "ruined watchtower", "riverbank"). Enables richer exploration without requiring new regions.

### 16.1 Scope (Initial)
In Scope:
- Textual description of current zone
- Moving between zones inside the same region (no energy cost initially)
Out of Scope (Initial):
- Zone-specific resource harvesting modifiers
- Combat encounter probability tuning
- Persistence of dynamic changes per zone

### 16.2 Zone Data Model (Minimal)
Fields (proposed):
- `zoneId: string`
- `regionId: string` (parent)
- `name: string`
- `description: string`
- `tags: string[]` (e.g., `['clearing','ruins','river']`)
- `linkedZoneIds: string[]` (adjacency inside region)

Open Questions:
- Do zones form a graph separate from region graph? (Yes, region-local graph)
- Max zones per region? (No hard cap initial)
- Should zone transitions influence travelEnergyCost? (Not initially)

### 16.3 Actions
Canonical engine actions introduced:
- `region.zone.describe` – Produce or update narrative of the current zone.
- `travel.zone.move` – Move player avatar to a different zone within the same region.

Classification Heuristics (assistantMap):
- Descriptive queries containing phrases like "describe the current area", "look around", "what's around here" map to `region.zone.describe`.
- Movement phrases with intra-region intent ("move within", "go deeper", "advance inside") map to `travel.zone.move`.

### 16.4 Flow (Conceptual)
Describe Zone:
1. Player requests description (explicit command or auto after movement).
2. Engine classifies to `region.zone.describe`.
3. Resolver returns narrative; store updates currentZone description.

Move Within Region:
1. Player issues movement intent referencing internal landmark.
2. Engine classifies to `travel.zone.move`.
3. Validates adjacency; updates currentZone; triggers automatic `region.zone.describe` for new zone.

### 16.5 Future Enhancements
- Zone encounter tables (combat / loot)
- Environmental modifiers (lighting, weather pocket)
- Zone-based quests / triggers
- Renown micro-interactions (gaining reputation by helping in a specific zone)

Version: Introduced in taxonomy v0.2 (Zones) – pending reducer implementation.
