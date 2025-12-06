import type { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { verifyGoogleIdToken } from './google-auth.js';
import { createSpacetimeIdentity } from './spacetimedb-auth.js';

export async function loginWithGoogle(req: FastifyRequest, res: FastifyReply) {
    try {
        const { idToken } = (req.body as any) ?? {};
        if (!idToken) return res.code(400).send('Missing token');
        let googleUser: { sub: string; email?: string };
        if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'DEV') {
            // Dev fallback: treat idToken as the Google sub directly
            googleUser = { sub: String(idToken), email: `${String(idToken)}@dev.local` };
        } else {
            const verified = await verifyGoogleIdToken(idToken);
            googleUser = { sub: verified.sub!, email: verified.email };
        }
        if (!process.env.SPACETIMEDB_URL) {
            req.log.error('SPACETIMEDB_URL env not set');
            return res.code(500).send('Server misconfigured: SPACETIMEDB_URL');
        }

        let stIdentity: any;
        try {
            stIdentity = await createSpacetimeIdentity({ sub: googleUser.sub });
        } catch (e: any) {
            req.log.error({ err: e }, 'Failed to create Spacetime identity');
            const msg = e?.response?.data ?? e?.message ?? 'Identity error';
            return res.code(500).send(String(msg));
        }

        try {
            const reducerRes = await axios.post(
                `${process.env.SPACETIMEDB_URL}/call/ensure_user`,
                {
                    provider: 'google',
                    provider_sub: googleUser.sub,
                    email: googleUser.email,
                },
                {
                    headers: { Authorization: `Bearer ${stIdentity.token}` },
                }
            );
            return res.send({ spacetimedb_token: stIdentity.token, user: reducerRes.data });
        } catch (e: any) {
            req.log.error({ err: e }, 'Reducer call failed');
            const msg = e?.response?.data ?? e?.message ?? 'Reducer error';
            return res.code(500).send(String(msg));
        }
    } catch (err) {
        req.log.error(err);
        return res.code(500).send('Google login failed');
    }
}
