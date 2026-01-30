// Direct Migration Runner - No browser needed!
// Logs in via Supabase Auth and runs migrations directly

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = 'https://eadeymehidcndudeycnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZGV5bWVoaWRjbmR1ZGV5Y25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4Mzg2ODQsImV4cCI6MjA4NDQxNDY4NH0.8t74NyPPHaWXHGyllAvdjPZ6DfAWM9fsAKopVEVogpM';

// Admin credentials
const ADMIN_EMAIL = 'jj1212t@gmail.com';
const ADMIN_PASSWORD = '543211';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function login() {
  console.log('🔐 Logging in as admin...');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  
  if (error) {
    console.error('❌ Login failed:', error.message);
    return false;
  }
  
  console.log('✅ Logged in as:', data.user.email);
  return true;
}

async function runMigration(name, sql) {
  console.log(`\n🚀 Running migration: ${name}`);
  console.log('─'.repeat(50));
  
  const { data, error } = await supabase.rpc('execute_safe_migration', {
    p_migration_name: name,
    p_migration_sql: sql
  });
  
  if (error) {
    console.error('❌ Migration failed:', error.message);
    return { success: false, error: error.message };
  }
  
  if (data && data.success) {
    console.log('✅ Migration completed successfully!');
    return { success: true, data };
  } else {
    console.error('❌ Migration failed:', data?.error || 'Unknown error');
    return { success: false, error: data?.error };
  }
}

async function runPendingMigrations() {
  // Read pending migrations file
  const pendingPath = path.join(__dirname, '..', 'public', 'pending-migrations.json');
  
  if (!fs.existsSync(pendingPath)) {
    console.log('ℹ️  No pending-migrations.json found');
    return;
  }
  
  const content = fs.readFileSync(pendingPath, 'utf-8');
  const data = JSON.parse(content);
  
  const pending = data.migrations.filter(m => m.status === 'pending');
  
  if (pending.length === 0) {
    console.log('ℹ️  No pending migrations');
    return;
  }
  
  console.log(`\n📋 Found ${pending.length} pending migration(s)\n`);
  
  for (const migration of pending) {
    console.log(`📦 ${migration.name}`);
    console.log(`   ${migration.description}`);
    
    const result = await runMigration(migration.name, migration.sql);
    
    // Update status in file
    migration.status = result.success ? 'completed' : 'failed';
    migration.executedAt = new Date().toISOString();
    if (!result.success) {
      migration.errorMessage = result.error;
    }
  }
  
  // Save updated file
  fs.writeFileSync(pendingPath, JSON.stringify(data, null, 2));
  console.log('\n✅ Updated pending-migrations.json');
}

async function runSqlDirect(sql, name) {
  return await runMigration(name || `direct_${Date.now()}`, sql);
}

async function main() {
  console.log('═'.repeat(50));
  console.log('   🔧 Direct Migration Runner');
  console.log('═'.repeat(50));
  
  // Login first
  const loggedIn = await login();
  if (!loggedIn) {
    process.exit(1);
  }
  
  const args = process.argv.slice(2);
  const command = args[0] || 'pending';
  
  switch (command) {
    case 'pending':
      await runPendingMigrations();
      break;
      
    case 'sql':
      const sql = args[1];
      const name = args[2];
      if (!sql) {
        console.error('❌ Please provide SQL');
        console.log('Usage: node scripts/direct-run.mjs sql "SELECT 1" my_migration');
        process.exit(1);
      }
      await runSqlDirect(sql, name);
      break;
      
    case 'file':
      const filePath = args[1];
      if (!filePath) {
        console.error('❌ Please provide file path');
        process.exit(1);
      }
      const fullPath = path.resolve(filePath);
      if (!fs.existsSync(fullPath)) {
        console.error('❌ File not found:', fullPath);
        process.exit(1);
      }
      const fileSql = fs.readFileSync(fullPath, 'utf-8');
      const fileName = path.basename(filePath, '.sql');
      await runSqlDirect(fileSql, fileName);
      break;
      
    default:
      console.log('Commands:');
      console.log('  pending       - Run all pending migrations');
      console.log('  sql "..." [name] - Run direct SQL');
      console.log('  file <path>   - Run SQL from file');
  }
  
  // Logout
  await supabase.auth.signOut();
  console.log('\n🏁 Done!');
}

main().catch(console.error);
