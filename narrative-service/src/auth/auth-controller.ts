import type { FastifyRequest, FastifyReply } from 'fastify';
import axios from 'axios';
import { verifyGoogleIdToken } from './google-auth.js';
import { createSpacetimeIdentity } from './spacetimedb-auth.js';

export async function loginWithGoogle(req: FastifyRequest, res: FastifyReply) {
    try {
        const { idToken } = (req.body as any) ?? {};
        if (!idToken) return res.code(400).send('Missing token');

        const googleUser = await verifyGoogleIdToken(idToken);

        const stIdentity = await createSpacetimeIdentity({ sub: googleUser.sub! });

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
    } catch (err) {
        req.log.error(err);
        return res.code(500).send('Google login failed');
    }
}
