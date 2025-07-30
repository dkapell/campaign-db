// @ts-check

import { globalIgnores } from "eslint/config";
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
    globalIgnores([
        "public/javascripts/vendor/*.js",
        "public/javascripts/templates/*.js",
        "public/javascripts/templates/*/*.js",
        "public/javascripts/templates/*/*/*.js",
        "**/dist",
    ]),
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // Configuration for JavaScript files
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jquery,
      },
    },
    rules: {
        "no-unused-vars": "off",
        "no-console": "off",
        "no-empty-pattern": 2,
        "no-empty": "off",

        indent: ["error", 4, {
            SwitchCase: 1,
        }],

        "linebreak-style": ["error", "unix"],
        quotes: ["error", "single"],
        semi: ["error", "always"],
    },
  },

  // Configuration for TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      ...tseslint.configs.strict,
    ],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2022,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Add or override specific rules for TypeScript
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },

  // Optional: Global ignores
  {
    ignores: ['node_modules/', 'dist/', 'build/'],
  }
);
