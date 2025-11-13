# Feature Specification: Travel & Exploration

## 1. Purpose
Enable characters to move between regions, unlocking exploration, quest discovery, and resource interaction. Travel modifies character location and updates contextual UI (current + linked regions).

## 2. Scope
In Scope:
- Client-side initiation of travel (select target region)
- Validation that target is linked to current region
- Updating character's `currentLocation`
- Refreshing linked regions list post-travel
Out of Scope (initial):
- Movement costs (energy, time delay)
- Encounter events during travel
- Pathfinding across multiple hops
- Travel cooldowns

## 3. Actors & Preconditions
Actors: Player
Preconditions:
- Character exists with valid `currentLocation`
- Target region exists and is linked (adjacent)

## 4. Data Elements
- `currentCharacter.currentLocation`
- Region graph adjacency (`linkedRegionIds`)

## 5. Flow
1. User selects a destination region from `linkedRegions` list
2. Travel action triggers `setCurrentCharacterLocation(region)`
3. Internally calls `updateCharacter` with new location
4. Region store updates `currentRegion` and recomputes adjacency via `findConnectedRegions`
5. UI panels (e.g., `TravelPanel.vue`) reflect new state

## 6. Validation Rules (Client)
- Target region must be in `linkedRegions`
- Character must be non-null
- Prevent re-travel to same region (no-op)

## 7. Future Server-Side Resolver (Planned)
`resolveTravel(characterId, targetRegionId)` will:
- Verify adjacency on authoritative side
- Deduct energy/travel cost
- Potentially enqueue world events (encounters, resource discovery)
Errors:
- Not linked -> reject
- Insufficient energy -> reject

## 8. Edge Cases
- Linked regions array empty (dead-end region) → UI should display message
- Race condition: region graph changes after selection but before update
- Character removed mid-travel (unlikely; handle with error feedback)

## 9. Metrics
- Number of travel actions per session
- Distribution of region hops (for graph design)
- Travel rejection rate (invalid adjacency)

## 10. Telemetry Hooks (Future)
- Log each travel with timestamp, origin, destination
- Track average hops until quest acquisition

## 11. Open Issues
- Need formal definition of energy and travel cost integration (CHARACTER / REGION specs)
- Travel cooldown to prevent spam?
- Server authoritative check vs current client-only update

## 12. Future Enhancements
- Multi-hop route suggestions
- Fog-of-war / discovery gating
- Random encounter system & resource collection
- Vehicle / mount modifiers reducing travel cost

Status: Draft v0.1
