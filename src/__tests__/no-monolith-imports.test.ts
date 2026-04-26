import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

function getFilesRecursively(dir: string, ext: string[]): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      files.push(...getFilesRecursively(fullPath, ext));
    } else if (entry.isFile() && ext.some(e => entry.name.endsWith(e))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('No monolith imports', () => {
  it('no page, layout, or component file imports from SophiaV2.tsx', () => {
    const srcDir = resolve(__dirname, '..');
    const files = getFilesRecursively(srcDir, ['.tsx', '.ts']);

    // Exclude SophiaV2.tsx itself and test files
    const appFiles = files.filter(f =>
      !f.includes('SophiaV2.tsx') &&
      !f.includes('__tests__') &&
      !f.includes('.test.') &&
      !f.includes('setupTests')
    );

    const violators: string[] = [];
    for (const file of appFiles) {
      const content = readFileSync(file, 'utf8');
      // Check for imports from SophiaV2 (the monolith)
      if (/from\s+['"].*SophiaV2['"]/.test(content) || /import\s+.*['"].*SophiaV2['"]/.test(content)) {
        violators.push(file);
      }
    }

    // App.tsx is allowed to have a lazy route to SophiaV2 as a reference route
    const filteredViolators = violators.filter(f => !f.endsWith('App.tsx'));

    expect(filteredViolators).toEqual([]);
  });
});
