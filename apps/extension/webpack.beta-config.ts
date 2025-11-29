import path from 'node:path';
import CopyPlugin from 'copy-webpack-plugin';

import config from './webpack.config.js';

const __dirname = new URL('.', import.meta.url).pathname;

// Copies the beta manifest file after the build to replace the default manifest
const BetaManifestReplacerPlugin = new CopyPlugin({
  patterns: [
    {
      from: path.resolve(__dirname, 'public/beta-manifest.json'),
      to: path.resolve(__dirname, 'beta-dist/manifest.json'),
      force: true,
    },
  ],
});

const PRAX_ID = 'ejpfkiblcablembkdhcofhokccbbppnc';

/**
 * This config defines the Prax Chrome ID, changes the output directory,
 * and modifies the `manifest.json` file to use the correct extension information
 */
export default ({ WEBPACK_WATCH = false }: { ['WEBPACK_WATCH']?: boolean }) => {
  const configs = config({ PRAX_ID, WEBPACK_WATCH });
  const distPath = path.join(__dirname, 'beta-dist');

  return configs.map((cfg, index) => ({
    ...cfg,
    output: { ...cfg.output, path: distPath },
    // Add the manifest replacer plugin only to the first (browser) config
    plugins: index === 0 ? [...(cfg.plugins ?? []), BetaManifestReplacerPlugin] : cfg.plugins,
  }));
};
