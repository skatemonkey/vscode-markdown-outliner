const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  {
    files: ['media/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', localStorage: 'readonly',
        console: 'readonly', Node: 'readonly', getComputedStyle: 'readonly',
        MutationObserver: 'readonly', setTimeout: 'readonly',
        requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      'no-unreachable': 'error',
      'eqeqeq': 'warn',
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
      ],
      'curly': 'warn',
      'eqeqeq': 'warn',
      'no-throw-literal': 'warn',
    },
  },
  {
    ignores: ['out/**', 'dist/**', '**/*.d.ts', 'node_modules/**'],
  },
];
