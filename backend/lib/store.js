import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

export async function readJSON(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  const raw = await readFile(file, 'utf-8');
  return JSON.parse(raw);
}

export async function writeJSON(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`);
  await writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
}
