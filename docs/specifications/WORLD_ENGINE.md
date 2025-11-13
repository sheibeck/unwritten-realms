# Feature Specification: World Engine & Spacetime

## 1. Purpose
Provide deterministic time progression and event resolution for the persistent world. The world engine orchestrates periodic ticks, resolves travel (future), spawns events, and enables emergent state changes beyond direct player actions.

## 2. Scope (Initial)
In Scope:
- Establish conceptual tick model (no implementation yet)
- Identify resolvers needed (travel, resource regeneration, quest expiration)
- Define event schema placeholder
Out of Scope (initial):
- Real-time scheduling infrastructure
- Complex AI simulation
- Physics/movement interpolation

## 3. Actors
- System (automated scheduler)
- Player (indirect consumer of effects)

## 4. Concepts
Tick: atomic unit of world time (e.g., 1 second or configurable)
Resolver: function consuming current state & producing mutations/events
Event: structured record representing significant occurrence (spawn, expiration)

## 5. Data Model (Planned)
Tables (future):
- `world_state` { tick: number, lastUpdated: timestamp }
- `event` { eventId, type, payload(json), createdTick }
Open Questions:
- Persist tick vs derive from timestamp
- Event TTL / pruning strategy

## 6. Planned Resolvers
1. Travel Resolver (authoritative adjacency + cost)
2. Resource Regeneration (regions replenish resources per interval)
3. Quest Expiration (auto-fail after deadline)
4. NPC Behavior (movement or script triggers) [later]

## 7. Flow Example: Tick Cycle
1. Scheduler triggers tick increment
2. Fetch pending resolver queue
3. Execute resolvers in deterministic order
4. Apply mutations via reducers
5. Emit events & notify subscriptions

## 8. Determinism & Ordering
- Fixed resolver ordering list
- Avoid random without seeded RNG stored in `world_state`

## 9. Metrics
- Average tick duration processing time
- Number of events per tick
- Resolver failure rate

## 10. Telemetry Hooks
- Log tick start/end, duration
- Log each resolver invocation + affected entities count

## 11. Performance Targets (Initial)
- Tick processing < 200ms (light load)
- Event insertion latency < 100ms

## 12. Security / Integrity
- Restrict resolver invocation to system role
- Validate that mutations from resolvers respect domain constraints (no teleport bypass)

## 13. Open Issues
- Where scheduling runs (SpaceTimeDB module? external cron?)
- Back-pressure handling when tick processing > interval
- Replay / rollback strategy for catastrophic failure

## 14. Future Enhancements
- Dynamic tick interval scaling based on load
- Predictive pre-computation of events
- Event subscription filters per client

Status: Draft v0.1
