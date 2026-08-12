/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // Dev containers are memory-tight; parallel workers OOM and can SIGKILL the api-server process.
  maxWorkers: 1,
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    // diagnostics.exclude: unifiedTemplateStorageService.ts carries 2 PRE-EXISTING
    // tsc errors at HEAD (TS2367/TS2322 — known, deliberately unfixed). ts-jest
    // reports them as suite failures, which would make any suite importing that
    // module unrunnable. Excluded here so its behavior can be tested; `tsc
    // --noEmit` still reports the errors as before.
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      diagnostics: { exclude: ['**/unifiedTemplateStorageService.ts'] },
    }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
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
};
