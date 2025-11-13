import 'dotenv/config';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key;
if (!apiKey) {
  console.error('OpenAI API key not found (OPENAI_API_KEY). Create a .env file or export the variable.');
  process.exit(1);
}

async function main() {
  const client = new OpenAI({ apiKey });
  const list = await client.beta.assistants.list({ limit: 100 });
  for (const a of list.data) {
    console.log(`${a.id}\t${a.name}`);
  }
  console.log(`Total: ${list.data.length}`);
}

main().catch(err => {
  console.error('Error listing assistants:', err);
  process.exit(1);
});
