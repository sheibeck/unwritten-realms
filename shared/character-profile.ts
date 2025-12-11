import { z } from 'zod';

const StatValueSchema = z.number().int().min(0).max(30);

export const StatBlockSchema = z.object({
    strength: StatValueSchema,
    agility: StatValueSchema,
    intellect: StatValueSchema,
    spirit: StatValueSchema,
    vitality: StatValueSchema
}).strict();

export const AbilitySchema = z.object({
    name: z.string().min(2),
    description: z.string().min(4)
}).strict();

export const MechanicsSchema = z.object({
    role: z.string().min(2),
    focus: z.string().optional(),
    starter_weapon: z.string().min(2),
    abilities: z.array(AbilitySchema).min(1).max(4),
    stats: StatBlockSchema,
    tags: z.array(z.string().min(2)).max(5).optional()
}).strict();

export const ProfessionSchema = z.object({
    name: z.string().min(2),
    lore: z.string().min(10),
    summary: z.string().min(4).optional(),
    mechanics: MechanicsSchema
}).strict();

export const CharacterProfileSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(2),
    race: z.string().min(2),
    archetype: z.string().min(2),
    profession: ProfessionSchema,
    starting_region: z.string().min(2),
    visual_description: z.string().min(10),
    stats: StatBlockSchema
}).strict();

export const CharacterProfilePartialSchema = CharacterProfileSchema.partial();

export type Ability = z.infer<typeof AbilitySchema>;
export type StatBlock = z.infer<typeof StatBlockSchema>;
export type Mechanics = z.infer<typeof MechanicsSchema>;
export type Profession = z.infer<typeof ProfessionSchema>;
export type CharacterProfile = z.infer<typeof CharacterProfileSchema>;
