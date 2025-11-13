# Feature Specification: Character Management

## 1. Purpose
Enable players to create, view, update, and progress their characters. Characters are the primary agents for exploration, questing, and interaction.

## 2. Scope
In Scope:
- Character creation via `addCharacter` reducer
- Character update via `updateCharacter` (including quest association logic)
- Setting current character in client state
- Tracking location (regionId) and quests
Out of Scope (initial):
- Combat stats, inventory systems
- Skill trees / progression mechanics
- Character deletion by user (admin tool later)

## 3. Actors & Preconditions
Actors: Player
Preconditions:
- User authenticated
- SpaceTimeDB connection established

## 4. Data Model
Fields (from TS binding):
- `characterId: string`
- `userId: string`
- `name: string`
- `currentLocation: string (regionId)`
- `quests: Quest[]` (optional)
Open Questions:
- Additional stats (energy, health) for travel cost? (deferred)

## 5. Flows
Flow: Create Character
1. Player submits form (name + starter region selection optional)
2. Client invokes `connection.reducers.addCharacter(AddCharacterInput)`
3. Subscription receives `onInsert` -> store updates map -> if belongs to current user, set `currentCharacter`

Flow: Update Character (Quest association)
1. Player accepts quest
2. `updateCharacter` invoked with partial payload including new `quests`
3. Store filters out already existing questIds to avoid duplicates before sending

Flow: Change Location (Travel)
1. Travel action triggers `setCurrentCharacterLocation(region)`
2. Under the hood updates character location via `updateCharacter`
3. Region store updates current & linked regions

## 6. Reducer Contracts (Assumed)
`addCharacter(input: AddCharacterInput)`
Validation:
- Name length 3-40 chars
- UserId present
Errors:
- Duplicate name for same user? (decision: allow duplicates globally for now)

`updateCharacter(input: UpdateCharacterInput)`
Validation:
- characterId exists
- If location change: regionId must exist
- Quests array: only new questIds added
Errors:
- Invalid regionId -> error
- Invalid questId -> error

## 7. UI & Store Integration
Pinia: `characterStore`
Components:
- `CharacterPanel.vue`: shows current character details & quest list
- `GameInterface.vue`: may trigger creation flow
- Travel components call `setCurrentCharacterLocation`

## 8. Edge Cases
- Character creation without authenticated user → reject action
- Rapid sequential updates causing race conditions in quest list filtering
- Location update to non-linked region (travel spec will enforce adjacency)
- Quest removal not yet supported (future capability)

## 9. Validation Rules (Client Hints)
- Prevent empty names
- Disallow update if `characterId` missing
- Filter duplicate quests before send (already implemented)

## 10. Metrics
- Time from creation submit to onInsert (< 5s target)
- Number of duplicate quest filtering events (indicates UI issues)
- Frequency of location changes per session

## 11. Telemetry Hooks (Future)
- Track character creation count per user
- Log location transitions with timestamp

## 12. Open Issues
- Stat system for travel energy cost integration
- Quest removal / completion flow spec dependency (QUEST spec)
- Handling of concurrent quest additions

## 13. Future Enhancements
- Add attributes: energy, inventory, level
- Character deletion & archival
- Multi-character switching UI

Status: Draft v0.1
