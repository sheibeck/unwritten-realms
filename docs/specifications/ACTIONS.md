# Action Taxonomy (Canonical Engine Actions)

Version: Draft v0.1
Last Updated: 2025-11-13

This document codifies the canonical action strings the game engine can understand. Actions align with existing or planned AI resolver prompts and world simulation processes. They are namespaced with `domain.subdomain.action` (or `domain.action`) for clarity and future extensibility.

## Naming Principles
- Consistent dot-notation: `domain.[subdomain.]verb_or_noun`.
- Singular domain root (e.g., `character`, `quest`, `region`).
- Verbs for transitions (`create`, `move`, `resolve`, `award`). Nouns allowed for state queries (`world.time.query`).
- Avoid tense; use present imperative (`create`, not `creating`).
- Subdomain layering used when a domain grows (e.g., `character.inventory.add_item`).
- Specific > generic. Prefer `quest.accept` over `quest.update_status`.

## Domains & Actions

### Character
- `character.create`
- `character.describe`
- `character.level_up`
- `character.xp.award` (generic XP source aggregation)
- `character.stats.allocate`
- `character.inventory.add_item`
- `character.inventory.remove_item`
- `character.inventory.manage`
- `character.quest.accept`
- `character.quest.turn_in`
- `character.quest.fail`
- `character.quest.complete`
- `character.state.inspect` (query summary)

### Quest
- `quest.generate` (procedural quest idea)
- `quest.create` (materialize quest entry)
- `quest.describe`
- `quest.update` (generic changes)
- `quest.expire`

### Region
- `region.create`
- `region.link`
- `region.describe`
- `region.resource.harvest`
- `region.resource.regenerate`
- `region.environment.change` (dynamic climate/lore change events)
 - `region.zone.describe` (retrieve or narrate a zone/area within a region)

### Travel
- `travel.move` (single hop)
- `travel.path.find` (multi-hop route)
- `travel.encounter.check` (roll for events)
- `travel.encounter.resolve`
 - `travel.zone.move` (intra-region movement between zones that does not incur major travel cost)

### World
- `world.general` (main loop reasoning)
- `world.event` (discrete event generation)
- `world.tick.advance`
- `world.time.query`
- `world.state.snapshot`

### Combat
- `combat.encounter.start`
- `combat.encounter.resolve`
- `combat.damage.calculate`
- `combat.status.apply` (buff/debuff)

### Loot
- `loot.generate`
- `loot.table.build`
- `loot.distribute`

### NPC
- `npc.create`
- `npc.describe`
- `npc.dialogue.open`
- `npc.dialogue.respond`
- `npc.behavior.schedule`
- `npc.trade.offer`

### Renown (Faction Reputation System)
- `renown.manage`
- `renown.gain`
- `renown.lose`
- `renown.adjust` (generic delta; gain/lose prefered when source known)
- `renown.relationship.update`
- `renown.conflict.resolve`
- `renown.query`
- `renown.leaderboard`

### Economy / Crafting
- `economy.market.listing.create`
- `economy.market.listing.buy`
- `economy.trade.execute`
- `economy.crafting.recipe.discover`
- `economy.crafting.item.craft`

### Social / Interaction
- `social.chat.message`
- `social.emote.perform`
- `social.session.summary`

### System / Meta
- `system.classify_action`
- `system.help`
- `system.session.start`
- `system.session.end`
- `system.error.report`

### Admin / Moderation
- `admin.moderation.flag`
- `admin.user.ban`
- `admin.world.lock`

## Action Life Cycle Categories
| Category | Examples | Notes |
|----------|----------|-------|
| Creation | character.create, region.create, quest.create | Usually triggers resolver + reducer validation. |
| Progression | character.level_up, character.xp.award | May chain multiple resolvers (combat -> xp.award -> level_up). |
| Movement | travel.move, travel.encounter.check | Travel events may branch into combat or loot. |
| Generation | loot.generate, world.event, quest.generate | Often purely AI-driven content suggestions validated before persistence. |
| Interaction | npc.dialogue.open, social.chat.message | High volume; may need rate limiting. |
| Resolution | combat.encounter.resolve, renown.conflict.resolve | Determine outcome + rewards. |
| Management | renown.manage, character.inventory.manage | Composite operations grouping multiple atomic changes. |
| Meta | system.classify_action, system.help | Internal engine operations. |

## Fallback Policy
- Any unrecognized action routes to `world.general` assistant.
- After a specialized action completes the engine appends a handoff marker indicating return to `world.general` flow.

## XP Award Model
`character.xp.award` is source-agnostic. Sources are enumerated in payload (`{ source: 'combat' | 'quest' | 'exploration' | 'event' | 'crafting', amount: number }`). Level logic uses accumulator thresholds and may trigger follow-up `character.level_up`.

## Future Prompt Coverage
| Action | Prompt Status |
|--------|---------------|
| character.create | Implemented |
| character.level_up | Implemented |
| region.create | Implemented |
| travel.move | Implemented |
| world.event | Implemented |
| world.general | Implemented |
| combat.encounter.resolve | Implemented |
| loot.generate | Implemented |
| renown.manage | Implemented |
| Others (xp.award, quest.*, npc.*, etc.) | Pending |

## Classification Strategy (Initial)
Regex heuristics match high-signal keywords. For ambiguity or compound requests, engine can:
1. Attempt regex classification.
2. If low confidence (multiple matches), defer to `system.classify_action` assistant (future) or world.general with explanatory note.

Confidence scoring (future): Each pattern yields weight; close ties -> escalate.

## Extension Workflow
1. Add new action to union in `assistantMap.ts`.
2. Provide mapping descriptor (assistant or fallback) if prompt exists.
3. Extend classification regex (or ML classifier) with keywords.
4. Update ACTIONS.md with status.
5. Add tests in `engineActions.spec.ts` for classification + mapping presence.

## Open Questions
- Should we track previous action context and allow multi-step ephemeral sessions (e.g., chain travel then encounter then loot)?
- Persist action + prompt checksum alongside generated artifacts for audit? (Recommended.)
- Rate limiting strategy for high-frequency social actions.

---
Status: Draft v0.1 (taxonomy established; prompts partially implemented)
