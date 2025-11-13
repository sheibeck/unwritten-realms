# Unwritten Realms System Specification

## 1. Vision & Goals
Unwritten Realms is a dynamic, persistent world-building and role-playing platform. Players and systems collaboratively create regions, characters, NPCs, quests, and emergent narrative through a SpaceTimeDB-backed simulation. The platform emphasizes:
- Player agency in shaping the world
- Specification-driven iteration and testability
- Extensibility for new content modules (regions, quest types, interactions)
- Deterministic world state evolution via resolvers & reducers

## 2. Scope (Initial Release)
Core interactive loop: Authenticated user creates a starter region and a character, explores via travel between linked regions, encounters NPCs, acquires quests. Time & world state advance through server-side modules.

## 3. Actors
- Player (authenticated user)
- System (world engine / spacetime simulation)
- Admin / Content Curator (future)

## 4. High-Level Architecture
Frontend: Vue 3 + Pinia + Vite
Backend Runtime: SpaceTimeDB modules (C#) + AWS Amplify (Auth)
Data Flow:
1. User authenticates via Cognito (Amplify)
2. Frontend establishes SpaceTimeDB connection
3. Reducers invoked to mutate tables (character, region, npc, quest, user)
4. Subscriptions push updates to stores; components reactively render
5. Travel & world events resolved through world engine resolvers (future extension)

## 5. Domain Model Overview
Core Entities:
- User: identity, linkage to characters
- Character: stats TBD, currentLocation(regionId), quests[], name
- Region: name, description, linkedRegionIds[], climate, culture, tier, travelEnergyCost, resources
- NPC: name, regionId (location), traits TBD
- Quest: name, description, status, assignedCharacters
- Spacetime / World State: tick, time, events (abstracted for now)
Relationships:
- Character located in Region
- Region links (graph edges) define travel adjacency
- NPC belongs to Region
- Quest associated to Character(s)

## 6. Feature Index
| Code / Store | Spec File | Feature Name |
|--------------|-----------|--------------|
| `mainStore.ts` | AUTH.md | User Auth & Session |
| `characterStore.ts` | CHARACTER.md | Character Management |
| `regionStore.ts` | REGION.md | Region Management |
| `npcStore.ts` | NPC.md | NPC Management |
| `questStore.ts` | QUEST.md | Quest Management |
| Travel (UI + region/character interplay) | TRAVEL.md | Travel & Exploration |
| World Engine (server modules) | WORLD_ENGINE.md | Time & Simulation |
| Non-functional | NFR.md | Quality Attributes |

## 7. Lifecycle & State Changes
State changes occur only via SpaceTimeDB reducers:
- Create / Update / Delete per entity
- Travel: character location update (Region link validation) + energy cost deduction (future stat)
- Linking Regions: creates bidirectional or unidirectional edges (clarify in REGION spec)

## 8. Non-Functional Placeholder
See `NFR.md`.

## 9. Open Questions / TBD
- Character stats & progression system
- Quest status lifecycle & failure conditions
- NPC interaction schema (dialogue, trade?)
- Region resource abstraction & economy
- World time granularity & tick rate
- Travel costs & constraints (energy, items?)
- Access control for admin/world-editing features

## 10. Specification Conventions
Each feature spec will include sections:
1. Purpose & Narrative
2. Scope (In / Out)
3. Actors & Preconditions
4. Data Model (tables & fields) with change control
5. User Flows / Sequence Diagrams (described textually initially)
6. Reducers / Resolvers Contract (inputs, validation, errors)
7. UI Components & Store Interactions
8. Edge Cases & Validation Rules
9. Metrics & Telemetry
10. Open Issues / Future Enhancements

## 11. Testing Strategy (High-Level)
- Unit: Pinia stores (mock connection) & pure functions
- Integration: Reducer invocation + subscription assertions (requires test harness)
- E2E: Auth -> Create Character -> Create Region -> Travel -> Acquire Quest
- Contract: Schema alignment between frontend TS types & backend C# module definitions

## 12. Versioning & Change Control
Specifications versioned in Git. Changes require:
- Update to associated spec file
- Mapping of affected reducers/stores/components
- Test impact note

## 13. Risks (Initial)
- Schema drift between C# modules and TS bindings
- Race conditions in subscription-based promise resolutions
- Lack of robust error handling in reducers
- Travel & region creation may enable graph inconsistencies without validation

## 14. Metrics (Initial Targets)
- Auth success < 2s
- Region creation confirmation < 5s (current timeout 15s; optimize)
- NPC/Quest creation < 5s
- Subscription propagation latency < 500ms average

## 15. Glossary (Seed)
- Reducer: SpaceTimeDB mutation function
- Resolver: Computation that may generate events/world changes
- Region Graph: Directed or undirected set of region link edges
- Tick: Atomic world time progression unit
- Energy: Hypothetical travel resource (TBD)

---
Status: Draft v0.1
