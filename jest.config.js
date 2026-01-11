module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    // '<rootDir>/src/tests/api/integration-tests/**/*.(spec|test).ts',
    '<rootDir>/src/tests/api/unit-tests/**/*.(test).ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 10000,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  forceExit: true,
  detectOpenHandles: true,
};
