import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['dist', 'ios', 'assets-src', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat['recommended-latest'], reactRefresh.configs.vite],
  },
  {
    // The simulation must run without rendering (tests, tools/sim).
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-*',
                'react/*',
                'three',
                'three/*',
                '@react-three/*',
                'zustand*',
              ],
              message: 'src/game is pure TypeScript: no React, three or zustand imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tools/**/*.ts', '*.config.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
)
