"use strict";

/** @type {import('@typescript-eslint/utils').TSESLint.Linter.Config} */
module.exports = {
  extends: [`@ryb73`, `plugin:storybook/recommended`],

  rules: {
    "@stylistic/lines-around-comment": `off`,
    "@stylistic/max-len": `off`,
    "@stylistic/padding-line-between-statements": `off`,
    "@stylistic/quotes": `off`,
    "unicorn/prefer-at": `off`, // Waiting for old Safari versions to die
  },
};
