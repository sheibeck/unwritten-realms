import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyGoogleIdToken } from './google-auth.js';

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
        // Do not call SpacetimeDB from this service. The client will
        // connect to SpacetimeDB using the Google JWT (idToken) as the bearer,
        // and the server-side reducer on client connection will upsert the user
        // using ctx.sender.
        // Return the Google-issued JWT and basic profile hints for the client.
        return res.send({
            provider: 'google',
            id_token: idToken,
            sub: googleUser.sub,
            email: googleUser.email,
        });
    } catch (err) {
        req.log.error(err);
        return res.code(500).send('Google login failed');
    }
}
