import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const assistantId = process.argv[2];
  const newName = process.argv.slice(3).join(' ');
  if (!assistantId || !newName) {
    console.error('Usage: tsx scripts/update-openai-assistant.ts <assistant_id> <new name>');
    process.exit(1);
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const updated = await client.beta.assistants.update(assistantId, { name: newName });
    console.log('Updated assistant:', updated.id, '->', updated.name);
  } catch (err: any) {
    console.error('Failed to update assistant name:', err.message);
    process.exit(1);
  }
}

main();
