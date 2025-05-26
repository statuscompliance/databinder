import globals from 'globals';
import pluginJs from '@eslint/js';
import stylisticJs from '@stylistic/eslint-plugin';

export default [
  {
    plugins: {
      '@stylistic/js': stylisticJs,
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@stylistic/js/quotes': ['error', 'single', { avoidEscape: true }],
      '@stylistic/js/linebreak-style': ['error', 'unix'],
      '@stylistic/js/eol-last': ['error', 'always'],
      '@stylistic/js/indent': ['error', 2],
      'unicode-bom': ['error', 'never'],
    },
    languageOptions: {
      sourceType: 'module', // Change this to 'module'
      globals: {
        ...globals.browser,
        ...globals.node,
        process: 'readonly',
      },
    },
  },
  pluginJs.configs.recommended,
];
