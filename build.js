const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: {
      app: 'src/server.ts',
      worker: 'src/worker.ts',
    },
    outdir: 'dist',
    bundle: true,
    platform: 'node',
    target: 'node18',
    external: ['pdf-parse'],
    minify: true,
    logLevel: 'info',
  })
  .catch(() => process.exit(1));
