module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/tests/api/integration-tests/**/*.(spec|test).ts',
    '<rootDir>/src/tests/api/unit-tests/**/*.(spec|test|unit-test).ts',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
};