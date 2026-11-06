import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionDiskCacheBudget } from '../../../src/service/parallel/session-disk-cache-budget.js';

let directory: string | undefined;

afterEach(async () => {
  if (!directory) return;
  await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

describe('SessionDiskCacheBudget', () => {
  it('evicts automatic entries before manually selected breakpoints', async () => {
    directory = await mkdtemp(join(tmpdir(), 'bushscad-cache-budget-'));
    const budget = new SessionDiskCacheBudget(directory, 22);
    await storeEntry(budget, 'automatic', 'automatic');
    await storeEntry(budget, 'manual-old', 'manual');
    await budget.touch(entryIdentity('automatic', 'automatic'));
    await storeEntry(budget, 'manual-new', 'manual');

    await expect(access(join(directory, 'automatic.brep'))).rejects.toThrow();
    await expect(
      access(join(directory, 'manual-old.brep')),
    ).resolves.toBeUndefined();
    await expect(
      access(join(directory, 'manual-new.brep')),
    ).resolves.toBeUndefined();
  });

  it('evicts the least recently used entry within a priority tier', async () => {
    directory = await mkdtemp(join(tmpdir(), 'bushscad-cache-budget-'));
    const budget = new SessionDiskCacheBudget(directory, 22);
    await storeEntry(budget, 'old', 'automatic');
    await storeEntry(budget, 'recent', 'automatic');
    await budget.touch(entryIdentity('recent', 'automatic'));
    await storeEntry(budget, 'new', 'automatic');

    await expect(access(join(directory, 'old.brep'))).rejects.toThrow();
    await expect(
      access(join(directory, 'recent.brep')),
    ).resolves.toBeUndefined();
    await expect(access(join(directory, 'new.brep'))).resolves.toBeUndefined();
  });

  it('skips an entry whose estimated size exceeds the full budget', async () => {
    directory = await mkdtemp(join(tmpdir(), 'bushscad-cache-budget-'));
    const budget = new SessionDiskCacheBudget(directory, 10);
    const write = async () => 11;

    await expect(
      budget.store(entryIdentity('oversize', 'manual'), write, 11),
    ).resolves.toBe(false);
  });
});

async function storeEntry(
  budget: SessionDiskCacheBudget,
  key: string,
  priority: 'automatic' | 'manual',
): Promise<void> {
  const entry = entryIdentity(key, priority);
  await expect(
    budget.store(
      entry,
      async () => {
        await writeFile(
          join(directory as string, entry.dataFileName),
          '0123456789',
        );
        await writeFile(join(directory as string, entry.metadataFileName), 'x');
        return 11;
      },
      11,
    ),
  ).resolves.toBe(true);
}

function entryIdentity(key: string, priority: 'automatic' | 'manual') {
  return {
    key,
    dataFileName: `${key}.brep`,
    metadataFileName: `${key}.json`,
    priority,
  } as const;
}
