export interface AssistantDescriptor { id: string; name: string; purpose: string; }

// Canonical engine actions (dot-notation groups for extensibility)
export type EngineAction =
  | 'character.create'
  | 'character.describe'
  | 'character.level_up'
  | 'character.xp.award'
  | 'character.stats.allocate'
  | 'character.inventory.add_item'
  | 'character.inventory.remove_item'
  | 'character.inventory.manage'
  | 'character.quest.accept'
  | 'character.quest.turn_in'
  | 'character.quest.fail'
  | 'character.quest.complete'
  | 'character.state.inspect'
  | 'quest.generate'
  | 'quest.create'
  | 'quest.describe'
  | 'quest.update'
  | 'quest.expire'
  | 'region.create'
  | 'region.link'
  | 'region.describe'
  | 'region.resource.harvest'
  | 'region.resource.regenerate'
  | 'region.environment.change'
  | 'region.zone.describe'
  | 'travel.move'
  | 'travel.zone.move'
  | 'travel.path.find'
  | 'travel.encounter.check'
  | 'travel.encounter.resolve'
  | 'world.event'
  | 'world.general'
  | 'world.tick.advance'
  | 'world.time.query'
  | 'world.state.snapshot'
  | 'combat.encounter.start'
  | 'combat.encounter.resolve'
  | 'combat.damage.calculate'
  | 'combat.status.apply'
  | 'loot.generate'
  | 'loot.table.build'
  | 'loot.distribute'
  | 'npc.create'
  | 'npc.describe'
  | 'npc.dialogue.open'
  | 'npc.dialogue.respond'
  | 'npc.behavior.schedule'
  | 'npc.trade.offer'
  | 'renown.manage'
  | 'renown.gain'
  | 'renown.lose'
  | 'renown.adjust'
  | 'renown.relationship.update'
  | 'renown.conflict.resolve'
  | 'renown.query'
  | 'renown.leaderboard'
  | 'economy.market.listing.create'
  | 'economy.market.listing.buy'
  | 'economy.trade.execute'
  | 'economy.crafting.recipe.discover'
  | 'economy.crafting.item.craft'
  | 'social.chat.message'
  | 'social.emote.perform'
  | 'social.session.summary'
  | 'system.classify_action'
  | 'system.help'
  | 'system.session.start'
  | 'system.session.end'
  | 'system.error.report'
  | 'admin.moderation.flag'
  | 'admin.user.ban'
  | 'admin.world.lock'
  | 'unknown';

// Mapping assistants to canonical actions (existing prompts only)
// Mapping only for implemented assistants; others fallback to world.general.
export const assistantMap: Partial<Record<EngineAction, AssistantDescriptor>> = {
  'character.create': {
    id: 'asst_fm4HRzMm9JU3stu21Dzcadec',
    name: 'Character Creation Resolver',
    purpose: 'Generate initial character concept and attributes.'
  },
  'character.level_up': {
    id: 'asst_Z6HLWJn9PPQdpTI5KJ2ECAzZ',
    name: 'Character Level Resolver',
    purpose: 'Character progression and level suggestions.'
  },
  'region.create': {
    id: 'asst_jwoJenG7ssI2dgCaOsB8HbuS',
    name: 'Region Creation Resolver',
    purpose: 'Suggest new region lore and properties.'
  },
  'travel.move': {
    id: 'asst_ZSp3stCYlwlGVbFSHlcXPR15',
    name: 'Region Travel Resolver',
    purpose: 'Narrate travel events and transitions.'
  },
  'world.event': {
    id: 'asst_vyGMl2hTeSFX8kksln57k4eb',
    name: 'World Event Resolver',
    purpose: 'Generate or describe a discrete world event.'
  },
  'world.general': {
    id: 'asst_s57DhFcd6f5rIIS00Hw3J51P',
    name: 'World Engine Resolver',
    purpose: 'General world engine reasoning / main loop.'
  },
  'combat.encounter.resolve': {
    id: 'asst_bCpzV9ou6CVe2TTrSR9jtPqh',
    name: 'Combat Resolver',
    purpose: 'Resolve combat encounters and outcomes.'
  },
  'loot.generate': {
    id: 'asst_RD6VkvOItCk0ojlwfBq3FynB',
    name: 'Loot Resolver',
    purpose: 'Generate loot tables / rewards.'
  },
  'renown.manage': {
    id: 'asst_sg0xsBuaGIyPPCPmmNkObpHU',
    name: 'Renown Resolver',
    purpose: 'Handle renown (faction reputation) relations and management suggestions.'
  },
  unknown: {
    id: 'asst_s57DhFcd6f5rIIS00Hw3J51P',
    name: 'World Engine Resolver',
    purpose: 'Fallback for unclassified actions.'
  }
};

// Legacy action normalization removed. All callers must now use canonical EngineAction strings.

// Simple heuristic classification from freeform message when action='auto'
export function classifyAction(message: string): EngineAction {
  const lower = message.toLowerCase();
  // Zone-level description (intra-region look/examine)
  if (/(describe|what(?:'s)?|look|inspect) (the )?(current )?(area|zone|surroundings)/.test(lower)) return 'region.zone.describe';
  // Intra-region movement (within same region / positional shift)
  if (/(move|go|head|step|walk|advance|proceed) (deeper|within|inside|further|across|toward|into)\b/.test(lower)) return 'travel.zone.move';
  if (/\b(create|new) character\b/.test(lower)) return 'character.create';
  if (/\b(level|level up|gain xp|advance)\b/.test(lower)) return 'character.level_up';
  if (/\baward xp|gain experience|xp gain\b/.test(lower)) return 'character.xp.award';
  if (/\baccept quest\b/.test(lower)) return 'character.quest.accept';
  if (/\b(create|new) region\b/.test(lower)) return 'region.create';
  if (/\btravel|move to|journey|go to\b/.test(lower)) return 'travel.move';
  if (/\b(event|world event|cataclysm|festival)\b/.test(lower)) return 'world.event';
  if (/\bcombat|fight|battle|attack\b/.test(lower)) return 'combat.encounter.resolve';
  if (/\bloot|treasure|reward|drop\b/.test(lower)) return 'loot.generate';
  if (/\brenown|faction|reputation|alliance|guild|fame\b/.test(lower)) return 'renown.manage';
  return 'world.general';
}

export function resolveAssistant(action: string): AssistantDescriptor {
  return assistantMap[action as EngineAction] || assistantMap['world.general']!; // fallback
}

// Indicates whether the action is specialized (after handling, flow returns to world.general)
export function isSpecialized(action: EngineAction): boolean {
  return !['world.general', 'unknown'].includes(action);
}
