import { build } from 'esbuild';
await build({
  entryPoints: ['src/main.ts', 'src/bootstrap.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
  sourcemap: true,
  external: [
    'fastify',
    '@fastify/cookie',
    '@prisma/*',
    'bcrypt',
    'redis',
    'jose',
  ],
});
