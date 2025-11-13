import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const aiRoot = path.resolve('ai');

function gatherPromptFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...gatherPromptFiles(full));
    else if (entry.isFile() && entry.name.endsWith('_prompt.txt')) out.push(full);
  }
  return out;
}

function parseFrontMatter(raw: string) {
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const fm = raw.slice(3, end).trim();
      const body = raw.slice(end + 4).replace(/^\s+/, '');
      const meta: Record<string,string> = {};
      for (const line of fm.split(/\r?\n/)) {
        const m = line.match(/^(\w[\w_-]*):\s*(.*)$/);
        if (m) meta[m[1]] = m[2];
      }
      return { meta, body };
    }
  }
  return { meta: {}, body: raw };
}

function checksum(content: string) {
  return 'sha256:' + crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function validate() {
  const files = gatherPromptFiles(aiRoot);
  if (!files.length) {
    console.log('No prompt files found.');
    return;
  }
  let ok = 0, fail = 0, missing = 0;
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const { meta, body } = parseFrontMatter(raw);
    const stored = meta.checksum;
    const actual = checksum(body.trim());
    if (!stored) {
      console.log(`${path.basename(file)}: MISSING checksum`);
      missing++;
    } else if (stored !== actual) {
      console.log(`${path.basename(file)}: FAIL (stored ${stored} != actual ${actual})`);
      fail++;
    } else {
      console.log(`${path.basename(file)}: OK`);
      ok++;
    }
  }
  console.log(`Summary: OK=${ok} FAIL=${fail} MISSING=${missing} TOTAL=${files.length}`);
  if (fail > 0 || missing > 0) process.exitCode = 1;
}

validate();
