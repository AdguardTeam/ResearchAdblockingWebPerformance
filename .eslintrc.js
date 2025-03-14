module.exports = {
    root: true,
    extends: [
        'airbnb-base',
        'airbnb-typescript/base',
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: './tsconfig.eslint.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    ignorePatterns: [
        'node_modules',
        'tmp',
        'src/extension',
        'src/adguard-dns',
        'src/metrics',
    ],
    settings: {
        'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
        'import/resolver': {
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
            },
        },
    },
    rules: {
        indent: 'off',
        '@typescript-eslint/indent': ['error', 4],
        'import/prefer-default-export': 'off',
        'max-len': ['error', {
            code: 120,
            comments: 120,
            tabWidth: 4,
            ignoreUrls: true,
            ignoreTrailingComments: false,
            ignoreComments: false,
            ignoreStrings: true,
        }],
        'no-await-in-loop': 'off',
        'class-methods-use-this': 'off',
        'no-async-promise-executor': 'off',
        'no-restricted-syntax': 'off',
        'arrow-body-style': 'off',
        'array-callback-return': 'off',
        'prefer-destructuring': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        'import/extensions': [
            'error',
            'ignorePackages',
            {
                js: 'never',
                jsx: 'never',
                ts: 'never',
                tsx: 'never',
            },
        ],
    },
};
