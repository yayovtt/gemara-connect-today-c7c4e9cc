# 🔧 Universal Migration Runner - Setup for Any Project

## מדריך התקנה מהירה למערכת הרצת מיגרציות מ-VS Code

העתק את הקבצים הבאים לכל פרויקט Supabase חדש!

---

## 📁 שלב 1: צור את קובץ הסקריפט

### צור קובץ: `scripts/direct-run.mjs`

```javascript
/**
 * 🔧 Universal Migration Runner
 * ==============================
 * Run database migrations directly from VS Code / Terminal
 * Works with Supabase + PostgreSQL
 * 
 * Usage:
 *   node scripts/direct-run.mjs file "path/to/migration.sql"
 *   node scripts/direct-run.mjs sql "SELECT * FROM table"
 *   node scripts/direct-run.mjs pending
 * 
 * Setup:
 *   1. Update SUPABASE_URL and SUPABASE_ANON_KEY below
 *   2. Update ADMIN_EMAIL and ADMIN_PASSWORD
 *   3. Run the SQL setup in your database (see UNIVERSAL_MIGRATION_SETUP.md)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION - UPDATE THESE VALUES FOR YOUR PROJECT
// ═══════════════════════════════════════════════════════════════════

const SUPABASE_URL = 'YOUR_SUPABASE_URL';           // e.g., 'https://xxxxx.supabase.co'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // From Supabase Dashboard > Settings > API

const ADMIN_EMAIL = 'YOUR_ADMIN_EMAIL';             // Admin user email
const ADMIN_PASSWORD = 'YOUR_ADMIN_PASSWORD';       // Admin user password

// ═══════════════════════════════════════════════════════════════════

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function login() {
  log('🔐 Logging in as admin...', 'cyan');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  
  if (error) {
    log(`❌ Login failed: ${error.message}`, 'red');
    return false;
  }
  
  log(`✅ Logged in as: ${data.user.email}`, 'green');
  return true;
}

async function runMigration(name, sql) {
  log(`\n🚀 Running migration: ${name}`, 'yellow');
  log('─'.repeat(50), 'cyan');
  
  const { data, error } = await supabase.rpc('execute_safe_migration', {
    p_migration_name: name,
    p_migration_sql: sql
  });
  
  if (error) {
    log(`❌ Migration failed: ${error.message}`, 'red');
    return { success: false, error: error.message };
  }
  
  if (data && data.success) {
    log('✅ Migration completed successfully!', 'green');
    if (data.message) log(`   ${data.message}`, 'cyan');
    return { success: true, data };
  } else {
    log(`❌ Migration failed: ${data?.error || 'Unknown error'}`, 'red');
    return { success: false, error: data?.error };
  }
}

async function runPendingMigrations() {
  const pendingPath = path.join(__dirname, '..', 'public', 'pending-migrations.json');
  
  if (!fs.existsSync(pendingPath)) {
    log('ℹ️  No pending-migrations.json found', 'yellow');
    return;
  }
  
  const content = fs.readFileSync(pendingPath, 'utf-8');
  const data = JSON.parse(content);
  
  const pending = data.migrations.filter(m => m.status === 'pending');
  
  if (pending.length === 0) {
    log('ℹ️  No pending migrations', 'yellow');
    return;
  }
  
  log(`\n📋 Found ${pending.length} pending migration(s)\n`, 'cyan');
  
  for (const migration of pending) {
    log(`📦 ${migration.name}`, 'blue');
    log(`   ${migration.description}`, 'reset');
    
    const result = await runMigration(migration.name, migration.sql);
    
    migration.status = result.success ? 'completed' : 'failed';
    migration.executedAt = new Date().toISOString();
    if (!result.success) {
      migration.errorMessage = result.error;
    }
  }
  
  fs.writeFileSync(pendingPath, JSON.stringify(data, null, 2));
  log('\n✅ Updated pending-migrations.json', 'green');
}

async function runSqlDirect(sql, name) {
  return await runMigration(name || `direct_${Date.now()}`, sql);
}

async function main() {
  console.log('');
  log('═'.repeat(50), 'cyan');
  log('   🔧 Universal Migration Runner', 'bold');
  log('═'.repeat(50), 'cyan');
  
  // Validate configuration
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    log('\n❌ Please configure SUPABASE_URL and SUPABASE_ANON_KEY', 'red');
    log('   Edit scripts/direct-run.mjs and update the configuration section', 'yellow');
    process.exit(1);
  }
  
  if (ADMIN_EMAIL === 'YOUR_ADMIN_EMAIL' || ADMIN_PASSWORD === 'YOUR_ADMIN_PASSWORD') {
    log('\n❌ Please configure ADMIN_EMAIL and ADMIN_PASSWORD', 'red');
    log('   Edit scripts/direct-run.mjs and update the configuration section', 'yellow');
    process.exit(1);
  }
  
  // Login
  const loggedIn = await login();
  if (!loggedIn) {
    process.exit(1);
  }
  
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'pending':
      await runPendingMigrations();
      break;
      
    case 'sql':
      const sql = args[1];
      const sqlName = args[2];
      if (!sql) {
        log('\n❌ Please provide SQL', 'red');
        log('Usage: node scripts/direct-run.mjs sql "SELECT 1" [migration_name]', 'yellow');
        process.exit(1);
      }
      await runSqlDirect(sql, sqlName);
      break;
      
    case 'file':
      const filePath = args[1];
      if (!filePath) {
        log('\n❌ Please provide file path', 'red');
        log('Usage: node scripts/direct-run.mjs file "path/to/file.sql"', 'yellow');
        process.exit(1);
      }
      const fullPath = path.resolve(filePath);
      if (!fs.existsSync(fullPath)) {
        log(`❌ File not found: ${fullPath}`, 'red');
        process.exit(1);
      }
      const fileSql = fs.readFileSync(fullPath, 'utf-8');
      const fileName = path.basename(filePath, '.sql');
      await runSqlDirect(fileSql, fileName);
      break;
      
    case 'help':
    default:
      console.log(`
📖 Available Commands:
─────────────────────────────────────────────────

  file <path>     Run SQL from a file
                  Example: node scripts/direct-run.mjs file "migrations/001.sql"

  sql <query>     Run SQL directly
                  Example: node scripts/direct-run.mjs sql "SELECT COUNT(*) FROM users"

  pending         Run all pending migrations from pending-migrations.json
                  Example: node scripts/direct-run.mjs pending

  help            Show this help message

─────────────────────────────────────────────────
      `);
      break;
  }
  
  log('\n🏁 Done!', 'green');
}

main().catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, 'red');
  console.error(err);
  process.exit(1);
});
```

---

## 🗄️ שלב 2: הרץ את ה-SQL הבא בדאטהבייס

### הרץ ב-Supabase SQL Editor:

```sql
-- ═══════════════════════════════════════════════════════════════════
-- 🔧 UNIVERSAL MIGRATION SYSTEM SETUP
-- ═══════════════════════════════════════════════════════════════════
-- Run this SQL in your Supabase SQL Editor to enable migration running
-- from VS Code / Terminal
-- ═══════════════════════════════════════════════════════════════════

-- 1. Create is_admin function (if not exists)
-- Customize this based on your admin logic!
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Option 1: Check if user has role = 'admin' in profiles table
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = user_id AND role = 'admin'
  );
  
  -- Option 2: Check against a list of admin emails
  -- RETURN EXISTS (
  --   SELECT 1 FROM auth.users 
  --   WHERE id = user_id 
  --   AND email IN ('admin@example.com', 'dev@example.com')
  -- );
  
  -- Option 3: First user is always admin
  -- RETURN user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1);
END;
$$;

-- 2. Create migration_logs table
CREATE TABLE IF NOT EXISTS public.migration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sql_content TEXT,
  executed_at TIMESTAMPTZ DEFAULT now(),
  success BOOLEAN DEFAULT false,
  error TEXT,
  executed_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.migration_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view
CREATE POLICY "Admins can view migration logs"
ON public.migration_logs FOR SELECT
USING (public.is_admin(auth.uid()));

-- Policy: Only admins can insert
CREATE POLICY "Admins can insert migration logs"
ON public.migration_logs FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

-- 3. Create the main migration execution function
CREATE OR REPLACE FUNCTION public.execute_safe_migration(
  p_migration_name TEXT, 
  p_migration_sql TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
  v_user_id UUID;
  v_clean_sql TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check admin permissions
  IF NOT public.is_admin(v_user_id) THEN
    RAISE EXCEPTION 'Only admins can run migrations';
  END IF;
  
  -- Clean transaction commands (cause errors in Supabase RPC)
  v_clean_sql := p_migration_sql;
  v_clean_sql := regexp_replace(v_clean_sql, '\mBEGIN\s*;', '', 'gi');
  v_clean_sql := regexp_replace(v_clean_sql, '\mCOMMIT\s*;', '', 'gi');
  v_clean_sql := regexp_replace(v_clean_sql, '\mROLLBACK\s*;', '', 'gi');
  v_clean_sql := regexp_replace(v_clean_sql, '\mSTART\s+TRANSACTION\s*;', '', 'gi');
  v_clean_sql := regexp_replace(v_clean_sql, '\mEND\s*;', '', 'gi');
  
  -- Execute the SQL
  EXECUTE v_clean_sql;
  
  -- Log success
  INSERT INTO public.migration_logs (name, sql_content, executed_at, success, executed_by)
  VALUES (p_migration_name, p_migration_sql, now(), true, v_user_id);
  
  RETURN jsonb_build_object(
    'success', true, 
    'name', p_migration_name,
    'message', 'Migration executed successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Log failure
  INSERT INTO public.migration_logs (name, sql_content, executed_at, success, error, executed_by)
  VALUES (p_migration_name, p_migration_sql, now(), false, SQLERRM, v_user_id);
  
  RETURN jsonb_build_object(
    'success', false, 
    'name', p_migration_name,
    'error', SQLERRM
  );
END;
$$;

-- 4. Create helper function to view migration history
CREATE OR REPLACE FUNCTION public.get_migration_history(p_limit INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  name TEXT,
  executed_at TIMESTAMPTZ,
  success BOOLEAN,
  error TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id, name, executed_at, success, error
  FROM public.migration_logs
  ORDER BY executed_at DESC
  LIMIT p_limit;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.execute_safe_migration(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_migration_history(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- ✅ SETUP COMPLETE!
-- ═══════════════════════════════════════════════════════════════════
```

---

## 📦 שלב 3: עדכן package.json

הוסף את התלויות הנדרשות:

```json
{
  "type": "module",
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0"
  }
}
```

התקן עם:
```bash
npm install @supabase/supabase-js
```

---

## 📁 שלב 4: צור את תיקיית המיגרציות

```
your-project/
├── scripts/
│   └── direct-run.mjs          # הסקריפט להרצה
├── supabase/
│   └── migrations/             # קבצי SQL
│       └── 001_example.sql
├── public/
│   └── pending-migrations.json # מיגרציות ממתינות (אופציונלי)
└── package.json
```

---

## 🚀 שימוש

### הרצת קובץ SQL:
```bash
node scripts/direct-run.mjs file "supabase/migrations/001_create_users.sql"
```

### הרצת SQL ישיר:
```bash
node scripts/direct-run.mjs sql "SELECT COUNT(*) FROM users"
```

### הרצת מיגרציות ממתינות:
```bash
node scripts/direct-run.mjs pending
```

---

## 📝 תבנית pending-migrations.json

```json
{
  "version": "1.0",
  "lastUpdated": "2026-01-30T00:00:00Z",
  "description": "Pending migrations - auto-generated by Copilot",
  "migrations": [
    {
      "id": "unique_id_001",
      "name": "add_user_preferences",
      "description": "Add preferences column to users table",
      "sql": "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'",
      "createdAt": "2026-01-30T00:00:00Z",
      "priority": "high",
      "status": "pending"
    }
  ]
}
```

---

## ✅ צ'קליסט התקנה

- [ ] צור `scripts/direct-run.mjs` עם הקוד למעלה
- [ ] עדכן `SUPABASE_URL` ו-`SUPABASE_ANON_KEY`
- [ ] עדכן `ADMIN_EMAIL` ו-`ADMIN_PASSWORD`
- [ ] הרץ את ה-SQL ב-Supabase SQL Editor
- [ ] עדכן את פונקציית `is_admin()` לפי הלוגיקה שלך
- [ ] התקן `@supabase/supabase-js`
- [ ] צור תיקיית `supabase/migrations/`
- [ ] בדוק עם: `node scripts/direct-run.mjs sql "SELECT 1"`

---

## 🔐 אבטחה חשובה!

⚠️ **לעולם אל תעלה את הקרדנשיאלס ל-Git!**

הוסף ל-.gitignore:
```
# Keep credentials safe
scripts/direct-run.mjs
```

או השתמש ב-environment variables:
```javascript
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
```

---

## 🎯 מוכן לשימוש!

עכשיו אתה (ו-Copilot) יכולים להריץ מיגרציות ישירות מ-VS Code! 🚀
