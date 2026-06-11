/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.js', '**/*.test.ts'],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 40,
      lines: 40,
      statements: 40,
    },
  },
  transform: {
    '^.+\\.ts$': '<rootDir>/jest-transformer.js',
  },
  // Exclude native-dependency modules from coverage (require canvas deps)
  modulePathIgnorePatterns: ['<rootDir>/src/services/renderer'],
};
