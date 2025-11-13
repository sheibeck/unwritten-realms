import 'dotenv/config';
import OpenAI from 'openai';

const PROJECT_TAG = 'Unwritten-Realms';
const apiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key;
if (!apiKey) {
  console.error('OPENAI_API_KEY missing');
  process.exit(1);
}

async function run() {
  const client = new OpenAI({ apiKey });
  const list = await client.beta.assistants.list({ limit: 100 });
  let updatedCount = 0;
  for (const a of list.data) {
    const current = a.metadata || {};
    if (current.project === PROJECT_TAG) continue; // already tagged
    await client.beta.assistants.update(a.id, {
      metadata: { ...current, project: PROJECT_TAG }
    });
    console.log(`Retagged ${a.id} (${a.name || 'unnamed'})`);
    updatedCount++;
  }
  console.log(`Retag complete. Updated ${updatedCount} assistants.`);
}

run().catch(err => {
  console.error('Retag failed:', err);
  process.exit(1);
});
