import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));

function collectSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function sourcePath(filePath: string): string {
  return relative(sourceRoot, filePath).split(sep).join('/');
}

describe('provider boundary', () => {
  it('keeps concrete Claude provider usage inside the provider layer', () => {
    const concreteProviderPatterns = [
      /from ['"].*provider\/ClaudeProvider\.js['"]/,
      /new ClaudeProvider\s*\(/,
    ];

    const violations = collectSourceFiles(sourceRoot)
      .filter((filePath) => {
        const path = sourcePath(filePath);
        return !path.startsWith('provider/') && path !== 'index.ts';
      })
      .filter((filePath) => {
        const contents = readFileSync(filePath, 'utf8');
        return concreteProviderPatterns.some((pattern) => pattern.test(contents));
      })
      .map(sourcePath);

    expect(violations).toEqual([]);
  });
});
