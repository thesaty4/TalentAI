import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Writes structured debug entries to logs/search-debug.log (one entry per search)
export function writeSearchLog(entry: object): void {
  const dir = join(process.cwd(), 'logs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  appendFileSync(join(dir, 'search-debug.log'), line + '\n');
}
