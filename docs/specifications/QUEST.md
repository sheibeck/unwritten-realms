# Feature Specification: Quest Management

## 1. Purpose
Provide structured objectives that drive player progression and narrative. Quests can be assigned to characters, tracked, and eventually completed.

## 2. Scope
In Scope:
- Quest creation via `addQuest` reducer
- Subscription-driven store updates
- Association of quests to characters during character update
Out of Scope (initial):
- Quest completion & reward logic
- Multi-step quest phases
- Automatic quest assignment triggers

## 3. Actors & Preconditions
Actors: Player (quest creation may be builder action), System (future auto-generation), Character
Preconditions:
- Authenticated user for manual creation
- Quest data (name, description) provided

## 4. Data Model
Fields:
- `questId: string`
- `name: string`
- `description: string`
- `status: string` (open questions: states?)
- `assignedCharacters: string[]` (if exists in schema; TBD)
Open Questions:
- Status lifecycle (Planned: Draft -> Active -> Completed -> Failed)
- Reward structure & XP

## 5. Flows
Flow: Create Quest
1. User enters quest details
2. Invoke `addQuest(AddQuestInput)`
3. Store listens for insert; adds to map

Flow: Assign Quest to Character
1. Player chooses quest
2. `updateCharacter` invoked with quests array including new quest
3. Store filters duplicates before send

## 6. Reducer Contracts (Assumed)
`addQuest(input: AddQuestInput)`
Validation:
- Non-empty name, description optional
Errors:
- Empty name

Quest assignment handled via `updateCharacter` (see CHARACTER spec)

## 7. UI & Store Integration
Pinia: `questStore`
Components:
- `CharacterPanel.vue` (quest list display)
- Quest creation panel (future)

## 8. Edge Cases
- Duplicate quest names (allowed initially)
- Rapid assignment causing lost updates due to filtering logic
- Quest removed/failed not currently represented

## 9. Validation Rules (Client)
- Require name length >= 3
- Disallow blank description if mandatory (TBD)

## 10. Metrics
- Quests created per session
- Average quests per character

## 11. Telemetry Hooks (Future)
- Log quest creation with creator userId
- Track assignment times relative to character creation

## 12. Open Issues
- Status transitions missing
- Rewards design unimplemented
- Quest dependencies (prerequisites) not modeled

## 13. Future Enhancements
- Multi-stage quest phases
- Dynamic failure conditions (time, events)
- Shared / group quests

Status: Draft v0.1
