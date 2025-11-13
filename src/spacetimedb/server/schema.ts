import { schema } from 'spacetimedb/server';
import { User, Character, Npc, Quest, Region } from './tables';

export const spacetimedb = schema(User, Character, Npc, Quest, Region);
