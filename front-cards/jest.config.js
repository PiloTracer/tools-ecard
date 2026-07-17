/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  // Dev containers are memory-tight; parallel workers can SIGKILL the Next dev server.
  maxWorkers: 1,
  roots: ['<rootDir>/'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest-setup.js'],
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    // Interim floor while raising toward 40% (see M5 quality gate iteration).
    global: {
      branches: 29,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
};
