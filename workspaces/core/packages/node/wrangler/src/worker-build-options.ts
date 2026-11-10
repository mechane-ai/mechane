import type { BuildOptions } from 'esbuild';
import { builtinModules } from 'node:module';

const COMMONJS_BUILTIN_BRIDGE = `var require = (id) => {
  const name = String(id);
  const builtin = process.getBuiltinModule(name);
  if (builtin === undefined) {
    const error = new Error(\`Cannot find module '\${name}'\`);
    error.code = "MODULE_NOT_FOUND";
    throw error;
  }
  return builtin;
};`;

/** Keeps source development and candidate artifacts on the same Worker import boundary. */
export function workerBuildOptions(): BuildOptions {
  return {
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2024',
    conditions: ['workerd', 'worker', 'browser'],
    external: ['node:*', 'cloudflare:*', ...builtinModules],
    banner: { js: COMMONJS_BUILTIN_BRIDGE },
  };
}
