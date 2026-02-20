import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const commonOptions = {
  bundle: true,
  sourcemap: true,
  target: 'es2022',
  format: 'esm',
  logLevel: 'info',
};

const entries = [
  {
    entryPoints: ['src/background/index.ts'],
    outfile: 'dist/background.js',
  },
  {
    entryPoints: ['src/content/index.ts'],
    outfile: 'dist/content.js',
    // Content scripts can't use ESM in Chrome, must be IIFE
    format: 'iife',
  },
  {
    entryPoints: ['src/popup/index.ts'],
    outfile: 'dist/popup.js',
  },
  {
    entryPoints: ['src/options/index.ts'],
    outfile: 'dist/options.js',
  },
];

async function build() {
  for (const entry of entries) {
    const options = {
      ...commonOptions,
      ...entry,
      format: entry.format || commonOptions.format,
    };

    if (isWatch) {
      const ctx = await esbuild.context(options);
      await ctx.watch();
    } else {
      await esbuild.build(options);
    }
  }

  if (!isWatch) {
    console.log('Build complete.');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
