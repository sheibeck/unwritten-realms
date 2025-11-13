# Feature Specification: Player Onboarding & Character Creation Lifecycle

## 1. Purpose
Provide a deterministic, extensible onboarding funnel that moves an authenticated player from "no character" to an active presence in the world (spawned in a starter region + starter zone) using a hybrid AI-guided + rule‑driven flow.

## 2. High-Level Goals
- Minimize friction: first meaningful action within < 60 seconds of login.
- Deterministic persistence: AI suggestions are advisory until validated locally.
- Extensibility: add future phases (attributes allocation, tutorial quests) without rewriting core.
- Observability: structured events for each phase transition.

## 3. Lifecycle Phases
| Phase | Description | Trigger | Output |
|-------|-------------|---------|--------|
| Auth | Player session established (Cognito / future) | User opens app / re-validates token | `currentUserId` set |
| Character Check | Determine if user already has character | After auth & connection | existing character or null |
| Initiation | Prompt user to begin creation ("Awaken") | No character & user action | Start creation loop |
| Concept Generation | AI produces initial character concept (name, race, archetype, profession, brief description) | `character.create` assistant run | Draft concept JSON |
| Refinement (Iterative) | Player provides clarifications (appearance, background) until all required fields non-empty | Loop until completeness test passes | Expanded concept JSON |
| Confirmation | System validates concept; may echo summary for user implicit confirmation | Completeness check passes | Lock final AddCharacterInput payload |
| Persistence | Reducer `addCharacter` invoked; DB emits insert event; store sets `currentCharacter` | Valid payload assembled | Stored Character record |
| Spawn Region Selection | Select starter region (existing or auto-create) | After persistence | Region ID (existing or new) |
| Spawn Zone Placement | Choose initial zone inside starter region | After region selection | Zone ID (or default placeholder) |
| Environment Describe | AI `region.zone.describe` (optional) to narrate arrival | Post spawn | Narrative message |
| Handoff | Transition to general world loop (`world.general`) | Arrival narration displayed | Thread ID stored |

## 4. Data Contracts
### 4.1 AddCharacterInput (Generated)
Fields (from bindings):
```
name: string
description: string
race: string
archetype: string
profession: string
startingRegion: string
strength: number
dexterity: number
intelligence: number
constitution: number
wisdom: number
charisma: number
maxHealth: number
currentHealth: number
maxMana: number
currentMana: number
raceAbilities: string
professionAbilities: string
level: number
xp: number
equippedWeapon: string
```
Derived rules:
- Numeric stats must be >= 0.
- `level` starts at 1; `xp` starts at 0.
- Health/Mana current values must not exceed max.
- `startingRegion` must map to valid regionId (resolved after or during spawn step).

### 4.2 AI Concept JSON (intermediate)
Example structure produced by `character.create` assistant:
```json
{
  "narrative": "You awaken...",
  "actions": {
    "createCharacter": {
      "name": "Aria",
      "description": "Shard-born wanderer",
      "race": "Shardling",
      "archetype": "Skirmisher",
      "profession": "Relic Seeker",
      "strength": 5,
      "dexterity": 7,
      "intelligence": 6,
      "constitution": 5,
      "wisdom": 4,
      "charisma": 6,
      "maxHealth": 30,
      "currentHealth": 30,
      "maxMana": 10,
      "currentMana": 10,
      "raceAbilities": "Crystal Sense",
      "professionAbilities": "Relic Scan",
      "level": 1,
      "xp": 0,
      "equippedWeapon": "Rusty Dagger"
    }
  }
}
```
Validation adds `startingRegion` before persistence and may inject defaults for missing numeric/stat fields.

### 4.3 Region / Zone Selection
Starter region determined by:
1. If any region flagged starter exists -> pick least populated (future metric) else first created.
2. If none exist -> call `createStarterRegion` with seeded attributes & resources.
3. Zone selection: if region has zones -> pick default tag `"spawn"` else placeholder zone `"entry"` until zones implemented.

### 4.4 Event Hooks (proposed)
| Event | Payload | Notes |
|-------|---------|-------|
| `onboarding.phase.change` | `{ phase, userId, ts }` | Emitted at each transition |
| `character.created` | `{ characterId, userId }` | After DB insert |
| `character.spawned` | `{ characterId, regionId, zoneId }` | After zone placement |

## 5. Algorithms
### 5.1 Completeness Check
```
function isComplete(draft):
  required = [name, race, archetype, profession, description, strength, dexterity, intelligence, constitution, wisdom, charisma, maxHealth, currentHealth]
  return all(field != null/undefined/empty for field in required)
```
Numeric zero allowed only where semantically valid (e.g., xp = 0). Reject if `maxHealth <= 0`.

### 5.2 Starter Region Auto-Creation
```
if no regions exist:
  createStarterRegion({
    name: pickFrom(['First Light Expanse','Dawn Shard Vale']),
    description: 'Gentle cradle of new adventurers',
    fullDescription: 'Mist rises from low crystal grass... (AI enriched)',
    climate: 'temperate',
    culture: 'frontier enclave',
    resources: ['herbs','ore','fauna']
  })
wait for insert event
```

### 5.3 Spawn Zone Selection (Placeholder)
```
if zones(featureFlag) and region.hasZones():
  zone = region.zones.find(z => 'spawn' in z.tags) || region.zones[0]
else:
  zone = { zoneId: 'entry', name: 'Entry Point', description: region.description }
```

## 6. Validation & Error Modes
| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Duplicate name (same user) | Pre-insert query / map scan | Append numeric suffix or prompt user |
| Disconnect mid-creation | Missing completion within timeout window | Persist partial draft locally; resume later |
| AI returns invalid JSON | Parse failure | Fallback to static template; notify user |
| Missing required stat | Completeness check fails | Ask user or auto-fill default values |
| Region creation timeout | Promise timeout (15s) | Retry creation once then fail gracefully |
| Race condition multi-create | Two creation loops race | Server rejects second (character already exists) |

## 7. Security / Determinism
- All persisted values originate from validated, sanitized payloads.
- AI cannot directly mutate DB; must pass reducer validation.
- Avoid embedding secret user metadata in AI context.

## 8. Extensibility Hooks
- Add Phase: Attribute Allocation (point spend UI) before Confirmation.
- Insert Tutorial Quest after Spawn (quest.create + immediate quest offer).
- Zone Tutorial: first `region.zone.describe` auto-triggers guidance actions.
- Multi-Assistant: allow `character.describe` refinement step separate from `character.create`.

## 9. Metrics (Initial Set)
- `onboarding_duration_ms` (Auth -> Spawn)
- `creation_iteration_count` (refinement loops)
- `ai_parse_failures` count
- `starter_region_creation_time_ms`

## 10. Non-Functional Requirements (Focused)
- Reliability: onboarding success rate > 99% (no silent stalls).
- Performance: average region creation confirmation < 5s.
- Observability: each phase transitions logged (future instrumentation).

## 11. Assistant Action Usage
| Phase | Action |
|-------|--------|
| Concept / Refinement | `character.create` (looped) |
| Post Spawn Narration | `region.zone.describe` |
| General Continuation | `world.general` |

## 12. State Machine (Conceptual)
```
[AUTH] -> [CHECK_CHARACTER]
  -> hasCharacter? [SPAWN_EXISTING] -> [WORLD]
  -> noCharacter -> [INITIATION] -> [CONCEPT] <-> [REFINEMENT] -> [CONFIRMATION] -> [PERSISTENCE] -> [SPAWN_REGION] -> [SPAWN_ZONE] -> [ARRIVAL_DESCRIBE] -> [WORLD]
```
Error transitions return to prior stable phase with user messaging.

## 13. Open Questions
- Should we allow multiple characters per user (impact on phase logic)?
- Where to store partial drafts (localStorage vs server staging)?
- Introduce soft-lock on chosen name to prevent sniping during refinement?

## 14. Backlog (Prioritized)
1. Implement structured phase event emitter.
2. Add attribute point allocation (configurable pool size).
3. Introduce zone data model & reducers; replace placeholder spawn zone.
4. Tutorial quest injection (`quest.generate` or manual template).
5. Confidence scoring for AI-generated concept fields.
6. Resume logic for partial creations (draft persistence).
7. Name uniqueness policy options (per-user, global, soft-lock).

## 15. Instrumentation Implementation
The structured phase event emitter is implemented in `src/engine/onboardingEvents.ts`.

Emissions now occur at:
- `AUTH` / `CHECK_CHARACTER` on interface mount.
- `INITIATION` when prompting user to Awaken.
- `CONCEPT` / `REFINEMENT` per creation loop iteration.
- `CONFIRMATION` just before persistence.
- `PERSISTENCE` immediately after `addCharacter` succeeds.
- `SPAWN_REGION` / `SPAWN_ZONE` when character location is set (placeholder zone).
- `ARRIVAL_DESCRIBE` on arrival narration events.
- `ERROR` on creation fetch failure.

Buffer keeps last 100 events; tests in `tests/onboardingEvents.spec.ts` assert ordering and truncation behavior.

## 16. Acceptance Criteria (MVP)
- New user can reach world loop with a valid character in <= 60s under normal latency.
- All persisted character fields pass validation rules and deterministic constraints.
- Starter region always exists after onboarding (auto-created if missing).
- No unhandled promise rejection or silent failure in creation loop.

Status: Draft v0.2 – instrumentation added; zone implementation pending.
