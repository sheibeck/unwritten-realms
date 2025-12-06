import { createHmac, timingSafeEqual } from 'crypto';
import { GoogleIdTokenPayloadSchema, SessionTokenSchema } from '../../shared/types';

const SESSION_SECRET = process.env.SERVER_SESSION_SECRET || 'dev-secret-change-me';

export async function verifyGoogleIdToken(idToken: string) {
    // TODO: Replace with real Google token verification (fetch JWKS and verify RS256)
    // For now, accept any non-empty token and fabricate a payload
    if (!idToken || idToken.length < 10) throw new Error('Invalid Google ID token');
    const payload = {
        aud: process.env.GOOGLE_CLIENT_ID || 'TODO',
        sub: `stub-${idToken.slice(0, 8)}`,
        email: 'stub@example.com',
        email_verified: true
    };
    return GoogleIdTokenPayloadSchema.parse(payload);
}

export function signSession(userId: string) {
    const now = Date.now();
    const token = {
        session_id: `sess_${now}_${Math.random().toString(36).slice(2)}`,
        user_id: userId,
        issued_at: now,
        expires_at: now + 1000 * 60 * 60 * 12 // 12h
    };
    const json = JSON.stringify(token);
    const sig = createHmac('sha256', SESSION_SECRET).update(json).digest('hex');
    return `${Buffer.from(json).toString('base64')}.${sig}`;
}

export function verifySession(sessionToken: string) {
    const [b64, sig] = sessionToken.split('.');
    if (!b64 || !sig) throw new Error('Malformed session');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const expect = createHmac('sha256', SESSION_SECRET).update(json).digest('hex');
    const ok = timingSafeEqual(Buffer.from(sig), Buffer.from(expect));
    if (!ok) throw new Error('Invalid signature');
    const token = SessionTokenSchema.parse(JSON.parse(json));
    if (Date.now() > token.expires_at) throw new Error('Session expired');
    return token;
}