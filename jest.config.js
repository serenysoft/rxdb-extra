// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createDefaultPreset } = require('ts-jest');

const tsJestPreset = createDefaultPreset({
  tsconfig: 'tsconfig.json',
});

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    ...tsJestPreset.transform,
  },
  clearMocks: true,
  testPathIgnorePatterns: ['<rootDir>/dist/'],
  coveragePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],
};
