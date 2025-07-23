module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/tests/api/unit-tests/**/*.(spec|test).ts',
    '<rootDir>/src/test/unit-tests/**/*.(spec|test).ts'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
};