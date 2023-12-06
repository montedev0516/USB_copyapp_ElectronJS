module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: 'airbnb-base',
  overrides: [
    {
      env: {
        node: true,
      },
      files: [
        '.eslintrc.{js,cjs}',
      ],
      parserOptions: {
        sourceType: 'script',
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
        "operator-linebreak": 0,
        "no-unused-vars": 1,
        "prefer-template": 0,
        "no-alert": 0,
        "one-var": 0,
        "one-var-declaration-per-line": 0,
        "no-plusplus": 0,
        "indent": 0,
        "import/extensions": 0,
        "import/no-extraneous-dependencies": 0,
        "import/no-unresolved": [2, { "ignore": ["electron"] }],
        "linebreak-style": 0,
        "brace-style": 0
  },
};
