#!/usr/bin/env node
/**
 * 🚀 סקריפט להרצת מיגרציות ישירות מה-Terminal
 * 
 * שימוש:
 *   node scripts/direct-run.mjs file "supabase/migrations/my_migration.sql"
 *   node scripts/direct-run.mjs sql "SELECT * FROM psakim LIMIT 5"
 *   node scripts/direct-run.mjs setup   (יוצר את הפונקציות הנדרשות)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ════════════════════════════════════════════════════════════════
// הגדרות Supabase
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://hrnmggrhgcuxqfumayxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhybm1nZ3JoZ2N1eHFmdW1heXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMDg4OTksImV4cCI6MjA4MDY4NDg5OX0.0WzSIdU02X31Fmw9zoWStVCJMkxwVjAViFGmz7ReAwM';

// ════════════════════════════════════════════════════════════════
// Admin Credentials - עדכן את הפרטים שלך!
// ════════════════════════════════════════════════════════════════
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'YOUR_ADMIN_EMAIL';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'YOUR_ADMIN_PASSWORD';

// ════════════════════════════════════════════════════════════════

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// צבעים לקונסול
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(emoji, message, color = '') {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

function printHeader() {
  console.log('');
  console.log(colors.cyan + '══════════════════════════════════════════════════════════════' + colors.reset);
  console.log(colors.cyan + '   🔧 Direct Migration Runner for Gemara Connect' + colors.reset);
  console.log(colors.cyan + '══════════════════════════════════════════════════════════════' + colors.reset);
}

function printHelp() {
  console.log(`
${colors.yellow}שימוש:${colors.reset}
  node scripts/direct-run.mjs <command> [arguments]

${colors.yellow}פקודות:${colors.reset}
  ${colors.green}file${colors.reset} <path>    הרץ קובץ SQL מהפרויקט
  ${colors.green}sql${colors.reset} <query>    הרץ SQL ישיר
  ${colors.green}setup${colors.reset}          צור את פונקציות ה-RPC הנדרשות
  ${colors.green}test${colors.reset}           בדוק חיבור לדאטהבייס
  ${colors.green}help${colors.reset}           הצג עזרה

${colors.yellow}דוגמאות:${colors.reset}
  node scripts/direct-run.mjs file "supabase/migrations/20260129_add_fulltext_search.sql"
  node scripts/direct-run.mjs sql "SELECT COUNT(*) FROM psakim"
  node scripts/direct-run.mjs setup
  node scripts/direct-run.mjs test

${colors.yellow}הגדרות Admin:${colors.reset}
  הגדר משתני סביבה:
  $env:ADMIN_EMAIL="your-email@example.com"
  $env:ADMIN_PASSWORD="your-password"
`);
}

// התחברות כ-Admin
async function loginAsAdmin() {
  if (ADMIN_EMAIL === 'YOUR_ADMIN_EMAIL' || ADMIN_PASSWORD === 'YOUR_ADMIN_PASSWORD') {
    log('❌', 'חסרים פרטי Admin!', colors.red);
    console.log('');
    console.log('הגדר משתני סביבה:');
    console.log('  $env:ADMIN_EMAIL="your-email@example.com"');
    console.log('  $env:ADMIN_PASSWORD="your-password"');
    console.log('');
    console.log('או ערוך את הקובץ scripts/direct-run.mjs והזן את הפרטים ישירות');
    return false;
  }

  log('🔐', 'מתחבר כ-Admin...', colors.cyan);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (error) {
    log('❌', `התחברות נכשלה: ${error.message}`, colors.red);
    return false;
  }

  log('✅', `מחובר כ: ${data.user.email}`, colors.green);
  return true;
}

// בדיקת חיבור
async function testConnection() {
  log('🔍', 'בודק חיבור ל-Supabase...', colors.cyan);
  console.log(`   URL: ${SUPABASE_URL}`);
  
  // בדיקה פשוטה
  const { data, error } = await supabase.from('psakim').select('id').limit(1);
  
  if (error) {
    log('⚠️', `שגיאה בחיבור: ${error.message}`, colors.yellow);
    console.log('   (זה תקין אם הטבלה לא קיימת עדיין)');
  } else {
    log('✅', 'חיבור לדאטהבייס תקין!', colors.green);
  }
  
  // בדיקת exec_sql
  log('🔍', 'בודק פונקציית exec_sql...', colors.cyan);
  const { error: rpcError } = await supabase.rpc('exec_sql', { sql_text: 'SELECT 1;' });
  
  if (rpcError) {
    if (rpcError.code === 'PGRST202') {
      log('❌', 'פונקציית exec_sql לא קיימת!', colors.red);
      console.log('   הרץ: node scripts/direct-run.mjs setup');
    } else {
      log('⚠️', `שגיאה: ${rpcError.message}`, colors.yellow);
    }
  } else {
    log('✅', 'פונקציית exec_sql קיימת ועובדת!', colors.green);
  }
}

// יצירת פונקציות RPC
async function setupFunctions() {
  log('🔧', 'יוצר פונקציות RPC...', colors.cyan);
  
  // הקוד ליצירת exec_sql
  const execSqlFunction = `
CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION exec_sql(TEXT) TO authenticated;
`;

  console.log('');
  console.log(colors.yellow + '═══════════════════════════════════════════════════════════' + colors.reset);
  console.log(colors.yellow + '⚠️  העתק והרץ את ה-SQL הבא ב-Supabase Dashboard > SQL Editor:' + colors.reset);
  console.log(colors.yellow + '═══════════════════════════════════════════════════════════' + colors.reset);
  console.log('');
  console.log(colors.green + execSqlFunction + colors.reset);
  console.log('');
  console.log(colors.yellow + '═══════════════════════════════════════════════════════════' + colors.reset);
  console.log('');
  console.log('🔗 לינק ישיר:');
  console.log(`   https://supabase.com/dashboard/project/hrnmggrhgcuxqfumayxk/sql`);
  console.log('');
}

// הרצת SQL
async function runSql(sql, name = 'direct-sql') {
  log('🚀', `מריץ SQL: ${name}`, colors.cyan);
  console.log('──────────────────────────────────────────────────────────────');
  
  // פיצול לפקודות
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  log('📋', `מספר פקודות: ${statements.length}`, colors.blue);

  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const shortStatement = statement.substring(0, 60).replace(/\n/g, ' ');
    
    process.stdout.write(`   [${i + 1}/${statements.length}] ${shortStatement}...`);

    const { data, error } = await supabase.rpc('exec_sql', { sql_text: statement + ';' });

    if (error) {
      console.log(colors.red + ' ❌' + colors.reset);
      console.log(`      שגיאה: ${error.message}`);
      errorCount++;
      errors.push({ index: i + 1, error: error.message, sql: statement.substring(0, 100) });
    } else {
      console.log(colors.green + ' ✅' + colors.reset);
      successCount++;
    }
  }

  console.log('──────────────────────────────────────────────────────────────');
  
  if (errorCount === 0) {
    log('✅', `הושלם בהצלחה! ${successCount} פקודות בוצעו`, colors.green);
  } else {
    log('⚠️', `הושלם עם ${errorCount} שגיאות (${successCount} הצליחו)`, colors.yellow);
    console.log('');
    console.log('שגיאות:');
    errors.forEach(e => {
      console.log(`   [${e.index}] ${e.error}`);
    });
  }

  return { successCount, errorCount, errors };
}

// הרצת קובץ
async function runFile(filePath) {
  // נרמול הנתיב
  let fullPath = filePath;
  if (!path.isAbsolute(filePath)) {
    fullPath = path.join(__dirname, '..', filePath);
  }

  log('📄', `קורא קובץ: ${filePath}`, colors.cyan);

  if (!fs.existsSync(fullPath)) {
    log('❌', `קובץ לא נמצא: ${fullPath}`, colors.red);
    return;
  }

  const sqlContent = fs.readFileSync(fullPath, 'utf8');
  log('📊', `גודל: ${(sqlContent.length / 1024).toFixed(2)} KB`, colors.blue);

  const name = path.basename(filePath);
  await runSql(sqlContent, name);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  printHeader();

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'test') {
    await testConnection();
    return;
  }

  if (command === 'setup') {
    await setupFunctions();
    return;
  }

  // פקודות שדורשות התחברות
  const loggedIn = await loginAsAdmin();
  
  if (command === 'file') {
    const filePath = args[1];
    if (!filePath) {
      log('❌', 'חסר נתיב לקובץ', colors.red);
      console.log('   שימוש: node scripts/direct-run.mjs file "path/to/file.sql"');
      return;
    }
    await runFile(filePath);
  }
  else if (command === 'sql') {
    const sql = args.slice(1).join(' ');
    if (!sql) {
      log('❌', 'חסר SQL להרצה', colors.red);
      console.log('   שימוש: node scripts/direct-run.mjs sql "SELECT * FROM table"');
      return;
    }
    await runSql(sql);
  }
  else {
    log('❌', `פקודה לא מוכרת: ${command}`, colors.red);
    printHelp();
  }

  console.log('');
  log('🏁', 'סיום!', colors.cyan);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
