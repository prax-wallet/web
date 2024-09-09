import penumbraEslintConfig from 'prax-configs/eslint';
import { config, parser } from 'typescript-eslint';

export default config(
  {
    languageOptions: {
      parser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...penumbraEslintConfig,
);
