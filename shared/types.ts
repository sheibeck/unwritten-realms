import { z } from 'zod';

export const CharacterContextSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    class: z.string().optional(),
    stats: z.record(z.any()).optional()
});

export const WorldContextSchema = z.object({
    zone: z.string().optional(),
    time: z.string().optional(),
    weather: z.string().optional()
});

export type CharacterContext = z.infer<typeof CharacterContextSchema>;
export type WorldContext = z.infer<typeof WorldContextSchema>;

// Auth-related shared types
export const GoogleIdTokenPayloadSchema = z.object({
    iss: z.string().optional(),
    aud: z.string(),
    sub: z.string(),
    email: z.string().email().optional(),
    email_verified: z.boolean().optional(),
    name: z.string().optional(),
    picture: z.string().url().optional(),
    exp: z.number().optional(),
    iat: z.number().optional()
});

export const SessionTokenSchema = z.object({
    session_id: z.string(),
    user_id: z.string(),
    issued_at: z.number(),
    expires_at: z.number()
});

export type GoogleIdTokenPayload = z.infer<typeof GoogleIdTokenPayloadSchema>;
export type SessionToken = z.infer<typeof SessionTokenSchema>;
