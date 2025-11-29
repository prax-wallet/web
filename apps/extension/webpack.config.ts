// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="web-ext.d.ts" />

// eslint-disable-next-line import/no-relative-packages
import rootPackageJson from '../../package.json' with { type: 'json' };

import CopyPlugin from 'copy-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { spawn } from 'node:child_process';
import path from 'node:path';
import url from 'node:url';
import { type WebExtRunner, cmd as WebExtCmd } from 'web-ext';
import webpack from 'webpack';
import WatchExternalFilesPlugin from 'webpack-watch-external-files-plugin';

export default ({
  WEBPACK_WATCH = false,
  PRAX_ID,
}: {
  ['WEBPACK_WATCH']?: boolean;
  PRAX_ID: string;
}): webpack.Configuration[] => {
  const keysPackage = path.dirname(url.fileURLToPath(import.meta.resolve('@penumbra-zone/keys')));
  // Resolve wasm package via a known export, then go up to package root
  const wasmPackage = path.dirname(
    path.dirname(url.fileURLToPath(import.meta.resolve('@penumbra-zone/wasm/build'))),
  );

  const localPackages = [
    ...Object.values(rootPackageJson.dependencies),
    ...Object.values(rootPackageJson.devDependencies),

    /* eslint-disable */
    // typescript and eslint will recognize the literal type of local json.
    // this is the simplest way to shut them both up.
    ...Object.values(((rootPackageJson as any).pnpm?.overrides ?? {}) as Record<string, string>),
    /* eslint-enable */
  ]
    .filter(specifier => specifier.endsWith('.tgz'))
    .map(tgzSpecifier =>
      tgzSpecifier.startsWith('file:') ? url.fileURLToPath(tgzSpecifier) : tgzSpecifier,
    );

  const __dirname = new URL('.', import.meta.url).pathname;
  const srcDir = path.join(__dirname, 'src');
  const entryDir = path.join(srcDir, 'entry');
  const injectDir = path.join(srcDir, 'content-scripts');
  const distDir = path.join(__dirname, 'dist');

  const CHROMIUM_PROFILE = process.env['CHROMIUM_PROFILE'];

  /*
   * The DefinePlugin replaces specified tokens with specified values.
   * - These should be declared in `prax.d.ts` for TypeScript awareness.
   * - `process.env.NODE_ENV` and other env vars are implicitly defined.
   * - Replacement is literal, so the values must be stringified.
   */
  const DefinePlugin = new webpack.DefinePlugin({
    PRAX: JSON.stringify(PRAX_ID),
    PRAX_ORIGIN: JSON.stringify(`chrome-extension://${PRAX_ID}`),
    'globalThis.__DEV__': JSON.stringify(process.env['NODE_ENV'] !== 'production'),
    'globalThis.__ASSERT_ROOT__': JSON.stringify(false),
  });

  const WebExtReloadPlugin = {
    webExtRun: undefined as WebExtRunner | undefined,
    apply({ hooks }: webpack.Compiler) {
      hooks.afterEmit.tapPromise(
        { name: 'WebExt Reloader' },
        async ({ options }: webpack.Compilation) => {
          await this.webExtRun?.reloadAllExtensions();
          this.webExtRun ??= await WebExtCmd.run({
            target: 'chromium',
            chromiumProfile: CHROMIUM_PROFILE,
            keepProfileChanges: Boolean(CHROMIUM_PROFILE),
            profileCreateIfMissing: Boolean(CHROMIUM_PROFILE),
            sourceDir: options.output.path,
            startUrl: 'http://localhost:5173/',
          });
          this.webExtRun.registerCleanup(() => (this.webExtRun = undefined));
        },
      );
    },
  };

  /**
   * This custom plugin will run `pnpm install` before each watch-mode build. This
   * combined with WatchExternalFilesPlugin will ensure that tarball dependencies
   * are updated when they change.
   */
  const PnpmInstallPlugin = {
    apply: ({ hooks }: webpack.Compiler) =>
      hooks.watchRun.tapPromise(
        { name: 'CustomPnpmInstallPlugin' },
        compiler =>
          new Promise<void>((resolve, reject) => {
            const pnpmInstall = spawn(
              'pnpm',
              // --ignore-scripts because syncpack doesn't like to run under
              // webpack for some reason. watch out for post-install scripts that
              // dependencies might need.
              ['-w', 'install', '--ignore-scripts', '--offline'],
              { stdio: 'inherit' },
            );
            pnpmInstall.on('exit', code => {
              if (code) {
                reject(new Error(`pnpm install failed ${code}`));
              } else {
                // clear webpack's cache to ensure new deps are used
                compiler.purgeInputFileSystem();
                resolve();
              }
            });
          }),
      ),
  };

  // Shared module rules for TypeScript and JS
  const sharedModuleRules: webpack.RuleSetRule[] = [
    {
      test: /\.tsx?$/,
      use: 'ts-loader',
      exclude: /node_modules/,
    },
    {
      test: /\.m?js/,
      resolve: {
        fullySpecified: false,
      },
    },
  ];

  // Shared plugins for both configs
  const sharedPlugins = [
    new webpack.ProvidePlugin({
      // Required by the `bip39` library
      Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.IgnorePlugin({
      // Not required by the `bip39` library, but very nice
      checkResource(resource) {
        return /.*\/wordlists\/(?!english).*\.json/.test(resource);
      },
    }),
    DefinePlugin,
  ];

  // Browser config for DOM-based entries (pages, popups, offscreen, injected scripts)
  const browserConfig: webpack.Configuration = {
    name: 'browser',
    entry: {
      'injected-session': path.join(injectDir, 'injected-session.ts'),
      'injected-penumbra-global': path.join(injectDir, 'injected-penumbra-global.ts'),
      'offscreen-handler': path.join(entryDir, 'offscreen-handler.ts'),
      'page-root': path.join(entryDir, 'page-root.tsx'),
      'popup-root': path.join(entryDir, 'popup-root.tsx'),
    },
    output: {
      path: distDir,
      filename: '[name].js',
    },
    optimization: {
      splitChunks: {
        chunks: chunk => {
          const filesNotToChunk = ['injected-session', 'injected-penumbra-global'];
          return chunk.name ? !filesNotToChunk.includes(chunk.name) : false;
        },
      },
    },
    module: {
      rules: [
        ...sharedModuleRules,
        {
          test: /\.css$/i,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  ident: 'postcss',
                  plugins: ['tailwindcss', 'autoprefixer'],
                },
              },
            },
          ],
        },
        {
          test: /\.mp4$/,
          type: 'asset/resource',
          generator: {
            filename: 'videos/[hash][ext][query]',
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      alias: {
        '@ui': path.resolve(__dirname, '../../packages/ui'),
      },
    },
    plugins: [
      new webpack.CleanPlugin(),
      ...sharedPlugins,
      new CopyPlugin({
        patterns: [
          'public',
          {
            from: path.join(keysPackage, 'keys', '*_pk.bin'),
            to: 'keys/[name][ext]',
          },
          {
            from: path.join(wasmPackage, 'wasm-parallel'),
            to: 'wasm-parallel',
          },
        ],
      }),
      // html entry points
      new HtmlWebpackPlugin({
        favicon: 'public/favicon/icon128.png',
        title: 'Prax Wallet',
        template: 'react-root.html',
        filename: 'page.html',
        chunks: ['page-root'],
      }),
      new HtmlWebpackPlugin({
        title: 'Prax Wallet',
        template: 'react-root.html',
        rootId: 'popup-root',
        filename: 'popup.html',
        chunks: ['popup-root'],
      }),
      new HtmlWebpackPlugin({
        title: 'Penumbra Offscreen',
        filename: 'offscreen.html',
        chunks: ['offscreen-handler'],
      }),
      // watch tarballs for changes
      WEBPACK_WATCH && new WatchExternalFilesPlugin({ files: localPackages }),
      WEBPACK_WATCH && PnpmInstallPlugin,
      WEBPACK_WATCH && CHROMIUM_PROFILE && WebExtReloadPlugin,
    ],
    experiments: {
      asyncWebAssembly: true,
    },
  };

  // Worker config for service worker and WASM build workers
  // Uses 'webworker' target to avoid DOM-based chunk loading
  // Depends on 'browser' to ensure it runs after browser config (which cleans the dist)
  const workerConfig: webpack.Configuration = {
    name: 'worker',
    dependencies: ['browser'],
    target: 'webworker',
    entry: {
      'service-worker': path.join(srcDir, 'service-worker.ts'),
      'wasm-build-action': path.join(srcDir, 'wasm-build-action.ts'),
      'wasm-build-parallel': path.join(srcDir, 'wasm-build-parallel.ts'),
    },
    output: {
      path: distDir,
      filename: '[name].js',
    },
    module: {
      rules: sharedModuleRules,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    plugins: [...sharedPlugins],
    experiments: {
      asyncWebAssembly: true,
    },
  };

  return [browserConfig, workerConfig];
};
