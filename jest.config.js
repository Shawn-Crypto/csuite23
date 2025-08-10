module.exports = {
  testMatch: [
    '**/tests/webhook-*.spec.js',
    '**/tests/*-unit.spec.js',
    '**/tests/unit/*.spec.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js']
};