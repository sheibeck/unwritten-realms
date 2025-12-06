import axios from 'axios';

export async function createSpacetimeIdentity(payload: { sub: string }) {
    const response = await axios.post(
        `${process.env.SPACETIMEDB_URL}/v1/identity`,
        {
            iss: 'https://accounts.google.com',
            sub: payload.sub,
        }
    );
    return response.data;
}
