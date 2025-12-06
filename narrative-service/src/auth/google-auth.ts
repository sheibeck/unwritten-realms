import { OAuth2Client, TokenPayload } from 'google-auth-library';
import axios from 'axios';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken: string): Promise<TokenPayload> {
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) throw new Error('Invalid Google token');
    console.info('[google-auth] verified payload', {
        iss: payload.iss,
        aud: payload.aud,
        sub: payload.sub,
        email: (payload as any)?.email,
        email_verified: (payload as any)?.email_verified,
    });
    // Ensure email claim is present; if missing, fetch from tokeninfo
    if (!payload.email) {
        try {
            const resp = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
                params: { id_token: idToken },
                timeout: 5000,
            });
            const email = resp.data?.email as string | undefined;
            console.info('[google-auth] tokeninfo response', {
                iss: resp.data?.iss,
                aud: resp.data?.aud,
                email,
            });
            if (email) {
                // Mutate payload to include email for downstream usage
                // TokenPayload defines email as optional
                (payload as any).email = email;
            }
        } catch (e) {
            console.warn('[google-auth] tokeninfo fetch failed', e);
            // Swallow and continue; controller will enforce email requirement
        }
    }
    return payload;
}
