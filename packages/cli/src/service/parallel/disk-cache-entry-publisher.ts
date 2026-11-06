/** Publishes a cache payload and its integrity sidecar as one readable entry. */

import { rename, rm, writeFile } from 'node:fs/promises';

/** Writes payload data first and the metadata sidecar last, cleaning temporary files. */
export async function publishDiskCacheEntry(
  dataPath: string,
  dataTemporaryPath: string,
  metadataPath: string,
  metadataTemporaryPath: string,
  prepare: () => Promise<string>,
): Promise<void> {
  try {
    const metadataText = await prepare();
    await rm(dataPath, { force: true });
    await rename(dataTemporaryPath, dataPath);
    await writeFile(metadataTemporaryPath, metadataText, 'utf8');
    await rm(metadataPath, { force: true });
    await rename(metadataTemporaryPath, metadataPath);
  } finally {
    await Promise.all([
      rm(dataTemporaryPath, { force: true }),
      rm(metadataTemporaryPath, { force: true }),
    ]);
  }
}
