import { stripTypeScriptTypes } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function resolveFile(abs) {
  const candidates = [abs, `${abs}.ts`, `${abs}.tsx`, join(abs, 'index.ts')];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return pathToFileURL(candidate).href;
  }
  return pathToFileURL(abs.endsWith('.ts') ? abs : `${abs}.ts`).href;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('node:') || specifier.startsWith('data:')) {
    return nextResolve(specifier, context);
  }
  if (specifier.startsWith('@/')) {
    return { url: resolveFile(join(ROOT, specifier.slice(2))), shortCircuit: true };
  }
  if (specifier.startsWith('.')) {
    if (/\.(?:mjs|cjs|js|json)$/.test(specifier)) return nextResolve(specifier, context);
    const parent = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : ROOT;
    return { url: resolveFile(join(parent, specifier)), shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith('.ts') || url.endsWith('.tsx')) {
    const source = stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), { mode: 'strip' });
    return { format: 'module', source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
