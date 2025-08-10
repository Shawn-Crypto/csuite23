/**
 * Environment Validation Script - Guide 1,6,8 Implementation
 * Validates required environment variables for production deployment
 * Provides startup validation and detailed error reporting
 */

// Load environment variables from .env file
require('dotenv').config();

const requiredEnvVars = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET', 
  'RAZORPAY_WEBHOOK_SECRET'
];

const optionalEnvVars = [
  'META_PIXEL_ID',
  'META_ACCESS_TOKEN',
  'ZAPIER_WEBHOOK_URL',
  'ZAPIER_LEAD_WEBHOOK_URL',
  'KAJABI_API_KEY',
  'KAJABI_OFFER_ID',
  'CALCOM_API_KEY',
  'CALCOM_EVENT_TYPE_ID',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'SENTRY_DSN'
];

const testModeOnlyVars = [
  'META_TEST_EVENT_CODE'
];

/**
 * Validates required environment variables existence and format
 * @param {string[]} varList - List of variable names to validate
 * @returns {object} Validation results
 */
function validateRequiredVars(varList = requiredEnvVars) {
  const results = {
    valid: [],
    missing: [],
    invalid: []
  };

  varList.forEach(varName => {
    const value = process.env[varName];
    
    if (!value) {
      results.missing.push(varName);
      return;
    }

    // Format validation based on variable type
    const validation = validateVarFormat(varName, value);
    if (validation.isValid) {
      results.valid.push({ name: varName, masked: maskValue(varName, value) });
    } else {
      results.invalid.push({ 
        name: varName, 
        error: validation.error,
        hint: validation.hint 
      });
    }
  });

  return results;
}

/**
 * Validates format of specific environment variables
 * @param {string} varName - Variable name
 * @param {string} value - Variable value
 * @returns {object} Validation result with error details
 */
function validateVarFormat(varName, value) {
  const trimmed = value.trim();
  
  if (!trimmed) {
    return { isValid: false, error: 'Empty value', hint: 'Provide a non-empty value' };
  }

  switch (varName) {
    case 'RAZORPAY_KEY_ID':
      if (!trimmed.startsWith('rzp_')) {
        return { 
          isValid: false, 
          error: 'Invalid format', 
          hint: 'Should start with "rzp_" (e.g., rzp_test_xxx or rzp_live_xxx)' 
        };
      }
      if (trimmed.length < 20) {
        return { 
          isValid: false, 
          error: 'Too short', 
          hint: 'Razorpay Key ID should be at least 20 characters' 
        };
      }
      break;

    case 'RAZORPAY_KEY_SECRET':
      if (trimmed.length < 24) {
        return { 
          isValid: false, 
          error: 'Too short', 
          hint: 'Razorpay Key Secret should be at least 24 characters' 
        };
      }
      break;

    case 'RAZORPAY_WEBHOOK_SECRET':
      if (trimmed.length < 12) {
        return { 
          isValid: false, 
          error: 'Too short', 
          hint: 'Webhook secret should be at least 12 characters for security' 
        };
      }
      break;

    case 'META_PIXEL_ID':
      if (!/^\d{15,16}$/.test(trimmed)) {
        return { 
          isValid: false, 
          error: 'Invalid format', 
          hint: 'Should be 15-16 digits (e.g., 123456789012345)' 
        };
      }
      break;

    case 'ZAPIER_WEBHOOK_URL':
    case 'ZAPIER_LEAD_WEBHOOK_URL':
      if (!trimmed.startsWith('https://hooks.zapier.com/')) {
        return { 
          isValid: false, 
          error: 'Invalid URL', 
          hint: 'Should start with "https://hooks.zapier.com/"' 
        };
      }
      break;

    case 'SUPABASE_URL':
      if (!trimmed.match(/^https:\/\/[a-z0-9]+\.supabase\.co$/)) {
        return { 
          isValid: false, 
          error: 'Invalid format', 
          hint: 'Should match pattern "https://xxxxx.supabase.co"' 
        };
      }
      break;

    case 'SENTRY_DSN':
      if (!trimmed.startsWith('https://') || !trimmed.includes('@sentry.io/')) {
        return { 
          isValid: false, 
          error: 'Invalid format', 
          hint: 'Should be a valid Sentry DSN URL' 
        };
      }
      break;
  }

  return { isValid: true };
}

/**
 * Validates Razorpay configuration and connectivity
 * @returns {Promise<object>} Validation result
 */
async function validateRazorpayConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  if (!keyId || !keySecret) {
    return {
      status: 'error',
      message: 'Missing Razorpay credentials',
      details: 'Both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required'
    };
  }

  // Check if we're in test or live mode
  const mode = keyId.includes('_test_') ? 'test' : 'live';
  const secretMode = keySecret.includes('test') ? 'test' : 'live';
  
  if (mode !== secretMode) {
    return {
      status: 'warning',
      message: 'Razorpay key/secret mode mismatch',
      details: `Key ID suggests ${mode} mode, but secret suggests ${secretMode} mode`,
      hint: 'Ensure both key and secret are for the same environment'
    };
  }

  // In production, warn if still using test keys
  if (process.env.NODE_ENV === 'production' && mode === 'test') {
    return {
      status: 'warning',
      message: 'Using test keys in production environment',
      details: 'NODE_ENV is production but Razorpay keys are for test mode',
      hint: 'Switch to live Razorpay keys for production'
    };
  }

  // Basic connectivity test (if Razorpay module is available)
  try {
    const Razorpay = require('razorpay');
    const instance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    
    // Simple API test
    await instance.orders.all({ count: 1 });
    
    return {
      status: 'success',
      message: `Razorpay ${mode} mode configured correctly`,
      details: 'API connectivity test passed'
    };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return {
        status: 'warning',
        message: 'Razorpay module not available for connectivity test',
        details: 'Install razorpay package to enable full validation'
      };
    }
    
    return {
      status: 'error',
      message: 'Razorpay connectivity test failed',
      details: error.message,
      hint: 'Check credentials and network connectivity'
    };
  }
}

/**
 * Generates comprehensive validation report
 * @returns {Promise<object>} Complete validation report
 */
async function generateValidationReport() {
  console.log('🔍 Validating environment configuration...\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    status: 'pending',
    sections: {}
  };

  // 1. Required variables validation
  console.log('📋 Checking required environment variables...');
  const requiredCheck = validateRequiredVars();
  report.sections.required = requiredCheck;
  
  if (requiredCheck.missing.length > 0) {
    console.error(`❌ Missing ${requiredCheck.missing.length} required variables:`);
    requiredCheck.missing.forEach(name => {
      console.error(`   - ${name}`);
    });
  }
  
  if (requiredCheck.invalid.length > 0) {
    console.error(`⚠️  Invalid format for ${requiredCheck.invalid.length} variables:`);
    requiredCheck.invalid.forEach(({ name, error, hint }) => {
      console.error(`   - ${name}: ${error} (${hint})`);
    });
  }
  
  console.log(`✅ Valid: ${requiredCheck.valid.length} variables`);
  requiredCheck.valid.forEach(({ name, masked }) => {
    console.log(`   - ${name}: ${masked}`);
  });
  console.log('');

  // 2. Optional variables check
  console.log('📋 Checking optional environment variables...');
  const optionalCheck = validateRequiredVars(optionalEnvVars);
  report.sections.optional = optionalCheck;
  
  const availableOptional = optionalCheck.valid.length;
  const totalOptional = optionalEnvVars.length;
  console.log(`📊 Available: ${availableOptional}/${totalOptional} optional variables`);
  
  if (availableOptional > 0) {
    optionalCheck.valid.forEach(({ name, masked }) => {
      console.log(`   ✅ ${name}: ${masked}`);
    });
  }
  
  if (optionalCheck.missing.length > 0) {
    console.log('   ⚪ Missing (optional):');
    optionalCheck.missing.slice(0, 3).forEach(name => {
      console.log(`      - ${name}`);
    });
    if (optionalCheck.missing.length > 3) {
      console.log(`      ... and ${optionalCheck.missing.length - 3} more`);
    }
  }
  console.log('');

  // 3. Razorpay configuration validation
  console.log('🏦 Validating Razorpay configuration...');
  const razorpayCheck = await validateRazorpayConfig();
  report.sections.razorpay = razorpayCheck;
  
  const statusIcon = {
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  }[razorpayCheck.status];
  
  console.log(`${statusIcon} ${razorpayCheck.message}`);
  if (razorpayCheck.details) {
    console.log(`   ${razorpayCheck.details}`);
  }
  if (razorpayCheck.hint) {
    console.log(`   💡 ${razorpayCheck.hint}`);
  }
  console.log('');

  // 4. Environment-specific checks
  console.log('🌍 Environment-specific validation...');
  const envChecks = performEnvironmentChecks();
  report.sections.environment = envChecks;
  
  envChecks.forEach(check => {
    const icon = check.status === 'pass' ? '✅' : (check.status === 'warn' ? '⚠️' : '❌');
    console.log(`${icon} ${check.message}`);
    if (check.details) {
      console.log(`   ${check.details}`);
    }
  });
  console.log('');

  // 5. Overall status determination
  const hasErrors = requiredCheck.missing.length > 0 || 
                   requiredCheck.invalid.length > 0 ||
                   razorpayCheck.status === 'error' ||
                   envChecks.some(c => c.status === 'fail');
                   
  const hasWarnings = razorpayCheck.status === 'warning' ||
                     envChecks.some(c => c.status === 'warn');

  if (hasErrors) {
    report.status = 'error';
    console.log('💥 VALIDATION FAILED');
    console.log('   Fix the errors above before deploying to production.\n');
    return report;
  }
  
  if (hasWarnings) {
    report.status = 'warning';
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS');
    console.log('   Review warnings above before deploying to production.\n');
  } else {
    report.status = 'success';
    console.log('🎉 VALIDATION PASSED');
    console.log('   Environment is properly configured for deployment.\n');
  }

  return report;
}

/**
 * Performs environment-specific validation checks
 * @returns {Array} Array of check results
 */
function performEnvironmentChecks() {
  const checks = [];
  const nodeEnv = process.env.NODE_ENV;
  
  // Check NODE_ENV setting
  if (!nodeEnv) {
    checks.push({
      status: 'warn',
      message: 'NODE_ENV not set',
      details: 'Defaulting to development mode'
    });
  } else if (nodeEnv === 'production') {
    checks.push({
      status: 'pass',
      message: 'Production environment detected',
      details: 'Enhanced security and performance settings will be applied'
    });
  } else {
    checks.push({
      status: 'pass', 
      message: `Development environment: ${nodeEnv}`,
      details: 'Debug features enabled'
    });
  }

  // Check for test-mode variables in production
  if (nodeEnv === 'production') {
    testModeOnlyVars.forEach(varName => {
      if (process.env[varName]) {
        checks.push({
          status: 'warn',
          message: `Test variable ${varName} set in production`,
          details: 'Remove test-only variables from production environment'
        });
      }
    });
  }

  // Check critical integrations
  const integrations = [
    { name: 'Meta Pixel', vars: ['META_PIXEL_ID'] },
    { name: 'Zapier Automation', vars: ['ZAPIER_WEBHOOK_URL'] },
    { name: 'Database', vars: ['SUPABASE_URL', 'SUPABASE_KEY'] },
    { name: 'Error Tracking', vars: ['SENTRY_DSN'] }
  ];

  integrations.forEach(({ name, vars }) => {
    const configured = vars.every(v => process.env[v]);
    if (configured) {
      checks.push({
        status: 'pass',
        message: `${name} integration configured`
      });
    } else {
      checks.push({
        status: 'warn',
        message: `${name} integration not configured`,
        details: `Missing: ${vars.filter(v => !process.env[v]).join(', ')}`
      });
    }
  });

  return checks;
}

/**
 * Masks sensitive values for display
 * @param {string} varName - Variable name
 * @param {string} value - Variable value
 * @returns {string} Masked value
 */
function maskValue(varName, value) {
  if (!value) return '[empty]';
  
  const sensitive = [
    'SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'DSN'
  ];
  
  const isSensitive = sensitive.some(keyword => 
    varName.toUpperCase().includes(keyword)
  );
  
  if (isSensitive) {
    if (value.length <= 8) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4);
  }
  
  // For non-sensitive values, show first/last few characters
  if (value.length <= 12) {
    return value;
  }
  return value.substring(0, 8) + '...' + value.substring(value.length - 4);
}

// Export functions for testing
module.exports = {
  validateRequiredVars,
  validateRazorpayConfig,
  generateValidationReport,
  maskValue
};

// Run validation if called directly
if (require.main === module) {
  generateValidationReport()
    .then(report => {
      if (report.status === 'error') {
        process.exit(1);
      } else if (report.status === 'warning') {
        process.exit(2); // Exit with warning code
      } else {
        process.exit(0);
      }
    })
    .catch(error => {
      console.error('💥 Validation script failed:');
      console.error(error.message);
      process.exit(1);
    });
}