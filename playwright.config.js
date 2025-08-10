// Playwright Configuration for E2E Testing
// Configures test environments, browsers, and test settings

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Test directory
  testDir: './tests',
  
  // Global test timeout
  timeout: 30 * 1000, // 30 seconds per test
  
  // Test runner timeout
  expect: {
    timeout: 5000 // 5 seconds for assertions
  },
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Parallel workers
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list']
  ],
  
  // Global test setup
  use: {
    // Base URL for tests
    baseURL: 'http://localhost:3000',
    
    // Collect trace on failure
    trace: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Global timeout for actions
    actionTimeout: 10 * 1000,
    
    // Global timeout for navigation
    navigationTimeout: 15 * 1000
  },
  
  // Test projects for different test types
  projects: [
    // E2E Tests - Chrome Desktop
    {
      name: 'e2e-chrome',
      testMatch: '**/e2e/**/*.spec.js',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },
    
    // E2E Tests - Chrome Mobile
    {
      name: 'e2e-mobile',
      testMatch: '**/e2e/**/*.spec.js',
      use: { 
        ...devices['Pixel 5'],
      },
    },
    
    // API Integration Tests
    {
      name: 'api-integration',
      testMatch: '**/integration/**/*.spec.js',
      use: {
        // API tests don't need browser
        baseURL: 'http://localhost:3000'
      }
    },
    
    // Performance Tests
    {
      name: 'performance',
      testMatch: '**/performance/**/*.spec.js',
      use: {
        baseURL: 'http://localhost:3000'
      },
      timeout: 60 * 1000, // Longer timeout for performance tests
    },
    
    // Cross-browser E2E (optional, for CI)
    {
      name: 'e2e-firefox',
      testMatch: '**/e2e/**/*.spec.js',
      use: { ...devices['Desktop Firefox'] },
      // Only run in CI or when explicitly requested
      testIgnore: process.env.CI ? undefined : '**/*'
    },
    
    {
      name: 'e2e-safari',
      testMatch: '**/e2e/**/*.spec.js',
      use: { ...devices['Desktop Safari'] },
      // Only run in CI or when explicitly requested
      testIgnore: process.env.CI ? undefined : '**/*'
    }
  ],
  
  // Web server for tests (if not running externally)
  webServer: process.env.CI ? {
    command: 'npm run dev',
    port: 3000,
    timeout: 120 * 1000, // 2 minutes to start server
    reuseExistingServer: !process.env.CI,
  } : undefined,
  
  // Test output directory
  outputDir: 'test-results/artifacts/',
  
  // Test metadata
  metadata: {
    testType: 'e2e-integration',
    environment: process.env.NODE_ENV || 'test',
    version: '1.0.0'
  }
});