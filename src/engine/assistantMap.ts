export interface AssistantDescriptor {
  id: string;
  name: string;
  purpose: string;
}

// Action keys used by incoming webhook/game loop requests
export type EngineAction =
  | 'create-character'
  | 'explore'
  | 'travel'
  | 'general-action'
  | 'level-up'
  | 'unknown';

// Central mapping: easy to extend as more assistants are added.
export const assistantMap: Record<EngineAction, AssistantDescriptor> = {
  'create-character': {
    id: 'asst_fm4HRzMm9JU3stu21Dzcadec',
    name: 'Character Creation Resolver',
    purpose: 'Generate initial character concept and attributes.'
  },
  explore: {
    id: 'asst_jwoJenG7ssI2dgCaOsB8HbuS',
    name: 'Region Creation Resolver',
    purpose: 'Suggest new region lore and properties.'
  },
  travel: {
    id: 'asst_ZSp3stCYlwlGVbFSHlcXPR15',
    name: 'Region Travel Resolver',
    purpose: 'Narrate travel events and transitions.'
  },
  'general-action': {
    id: 'asst_s57DhFcd6f5rIIS00Hw3J51P',
    name: 'World Engine Resolver',
    purpose: 'General world engine reasoning / event synthesis.'
  },
  'level-up': {
    id: 'asst_Z6HLWJn9PPQdpTI5KJ2ECAzZ',
    name: 'Character Level Resolver',
    purpose: 'Character progression and level suggestions.'
  },
  unknown: {
    id: 'asst_s57DhFcd6f5rIIS00Hw3J51P',
    name: 'World Engine Resolver',
    purpose: 'Fallback for unclassified actions.'
  }
};

export function resolveAssistant(action: string): AssistantDescriptor {
  if (action in assistantMap) {
    return assistantMap[action as EngineAction];
  }
  return assistantMap.unknown;
}
