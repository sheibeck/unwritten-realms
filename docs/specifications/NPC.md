# Feature Specification: NPC Management

## 1. Purpose
Provide non-player characters (NPCs) that inhabit regions, serve as quest givers, lore sources, or interaction points. NPCs enrich the world with narrative and functional roles.

## 2. Scope
In Scope:
- NPC creation via `createNpc` reducer
- Retrieval and indexing in `npcStore`
- Query by id and name
Out of Scope (initial):
- Dialogue system
- NPC movement between regions
- NPC behavior scripting / AI

## 3. Actors & Preconditions
Actors: Player (indirectly, via world building), System (future procedural generation)
Preconditions:
- Authenticated user for manual creation
- Target region exists

## 4. Data Model
Fields (from binding):
- `npcId: string`
- `name: string`
- `regionId: string`
- Additional traits TBD
Open Questions:
- Should NPC uniqueness be enforced per region? (No initial enforcement)

## 5. Flows
Flow: Create NPC
1. User completes form (name + region assignment)
2. Invoke `createNpc(CreateNpcInput)`
3. Subscription `onInsert` event updates store map
4. UI refreshes list of NPCs in current region

Flow: Query NPC
- Find by id or name using provided store functions

## 6. Reducer Contract (Assumed)
`createNpc(input: CreateNpcInput)`
Validation:
- Non-empty name
- `regionId` exists
Errors:
- Invalid regionId
- Empty name

## 7. UI & Store Integration
Pinia: `npcStore`
Components:
- Region detail panel (future) listing NPCs by region
- NPC creation modal (future)

## 8. Edge Cases
- Creation in region not yet synchronized to client
- Duplicate name spam (acceptable initially)
- Large NPC counts slowing region panel rendering (pagination future)

## 9. Validation Rules (Client)
- Require name length 3-40
- Ensure region selected

## 10. Metrics
- NPC creation count per session
- NPC density per region

## 11. Telemetry Hooks (Future)
- Log NPC creation with regionId
- Track player interactions (once dialogue implemented)

## 12. Open Issues
- Dialogue / interaction schema unspecified
- NPC movement & lifecycle events
- Ownership / permission model for NPC editing

## 13. Future Enhancements
- Dialogue trees & quest assignment triggers
- Travel / roaming behavior
- NPC factions & alignment

Status: Draft v0.1
