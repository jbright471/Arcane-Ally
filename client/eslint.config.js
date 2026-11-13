import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// Expand this list deliberately as existing TypeScript modules are reviewed.
// See docs/CLIENT_LINT_SCOPE.md for the current boundary and legacy exceptions.
const typescriptFiles = [
  'src/components/CharacterCard{,.test}.tsx',
  'src/components/CombatStateInspectorModal{,.test}.tsx',
  'src/pages/BattleMap{,.test}.tsx',
  'src/lib/battleMapState{,.test}.ts',
  'src/lib/dmFetch{,.test}.ts',
]

export default defineConfig([
  globalIgnores(['dist', 'src_old']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    name: 'incremental-typescript',
    files: typescriptFiles,
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Existing payload/test doubles are not a type-hardening migration.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^[A-Z_]',
      }],
      // Keep deliberate JSON fallback catches without a broad rule disable.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    name: 'incremental-react-hooks',
    files: ['src/components/CharacterCard.tsx', 'src/pages/BattleMap.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
])
