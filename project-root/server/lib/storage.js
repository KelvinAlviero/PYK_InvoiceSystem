import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

// Files live on disk under config.uploadDir; the documents table stores only the
// relative storage_key. Swapping this module for S3/R2 later would not touch the routes.

function resolveKey(storageKey) {
    const fullPath = path.resolve(config.uploadDir, storageKey);
    if (!fullPath.startsWith(config.uploadDir + path.sep)) {
        throw new Error('Invalid storage key.');
    }
    return fullPath;
}

export async function saveFile(storageKey, buffer) {
    const fullPath = resolveKey(storageKey);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
}

export async function removeFolder(folderKey) {
    await fs.rm(resolveKey(folderKey), { recursive: true, force: true });
}

export function filePath(storageKey) {
    return resolveKey(storageKey);
}
