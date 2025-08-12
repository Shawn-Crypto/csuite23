#!/usr/bin/env node

const { readFileSync } = require('fs');
const { join } = require('path');

// Load environment variables
require('dotenv').config();

async function setupDatabase() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
  }
  
  console.log('🚀 Setting up database schema...');
  console.log(`📍 Target: ${SUPABASE_URL}`);
  
  try {
    // Read the schema file
    const schemaSQL = readFileSync(join(__dirname, '../database/schema.sql'), 'utf8');
    
    // Split into individual statements (simple approach)
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement via Supabase REST API
    let successCount = 0;
    let errorCount = 0;
    
    for (const [index, statement] of statements.entries()) {
      if (statement.trim().length === 0) continue;
      
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sql: statement + ';'
          })
        });
        
        if (response.ok) {
          successCount++;
          console.log(`✅ Statement ${index + 1}: Success`);
        } else {
          const error = await response.text();
          console.log(`⚠️  Statement ${index + 1}: ${error}`);
          errorCount++;
        }
      } catch (error) {
        console.log(`❌ Statement ${index + 1}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📊 Database Setup Summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);
    
    if (errorCount === 0) {
      console.log('🎉 Database schema setup completed successfully!');
    } else {
      console.log('⚠️  Database setup completed with some errors (likely expected for existing objects)');
    }
    
  } catch (error) {
    console.error('❌ Fatal error during database setup:', error.message);
    process.exit(1);
  }
}

setupDatabase();