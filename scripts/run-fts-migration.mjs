#!/usr/bin/env node
/**
 * 🚀 סקריפט להרצת מיגרציית Full-Text Search
 * 
 * איך להריץ:
 * node scripts/run-fts-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ════════════════════════════════════════════════════════════════
// הגדרות Supabase - עדכן את הערכים האלה!
// ════════════════════════════════════════════════════════════════

// אפשרות 1: הזן ישירות (לא מומלץ לפרודקשן)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY';

// ════════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════════════════');
console.log('   🔧 Full-Text Search Migration Runner');
console.log('══════════════════════════════════════════════════════════════');

// בדיקת הגדרות
if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_SERVICE_KEY === 'YOUR_SERVICE_ROLE_KEY') {
  console.log('\n❌ שגיאה: חסרות הגדרות Supabase!\n');
  console.log('📝 אפשרויות לתיקון:');
  console.log('');
  console.log('   אפשרות 1 - הגדר משתני סביבה:');
  console.log('   $env:SUPABASE_URL="https://your-project.supabase.co"');
  console.log('   $env:SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.log('');
  console.log('   אפשרות 2 - ערוך את הקובץ הזה והזן את הערכים ישירות');
  console.log('');
  console.log('   📍 איפה למצוא את המפתחות?');
  console.log('   1. היכנס ל: https://supabase.com/dashboard');
  console.log('   2. בחר את הפרויקט שלך');
  console.log('   3. Settings → API');
  console.log('   4. העתק את "Project URL" ו-"service_role" key');
  console.log('');
  process.exit(1);
}

// יצירת חיבור לSupabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

async function runMigration() {
  try {
    console.log('\n🔐 מתחבר ל-Supabase...');
    console.log(`   URL: ${SUPABASE_URL.substring(0, 30)}...`);
    
    // קריאת קובץ המיגרציה
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260129_add_fulltext_search.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.log(`\n❌ קובץ המיגרציה לא נמצא: ${migrationPath}`);
      process.exit(1);
    }
    
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');
    console.log('\n📄 קובץ המיגרציה נקרא בהצלחה');
    console.log(`   גודל: ${(sqlContent.length / 1024).toFixed(2)} KB`);
    
    console.log('\n🚀 מריץ את המיגרציה...');
    console.log('──────────────────────────────────────────────────────────────');
    
    // הרצת ה-SQL דרך rpc או ישירות
    // נשתמש בפיצול לפקודות בודדות
    const statements = sqlContent
      .split(/;\s*$/m)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`\n📋 מספר פקודות SQL: ${statements.length}`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      const shortStatement = statement.substring(0, 50).replace(/\n/g, ' ') + '...';
      
      try {
        // שימוש ב-rpc לביצוע SQL
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          // אם אין פונקציית exec_sql, ננסה בדרך אחרת
          if (error.message.includes('function') && error.message.includes('does not exist')) {
            console.log(`\n⚠️  פקודה ${i + 1}/${statements.length}: נדרש להריץ ידנית`);
            errorCount++;
          } else {
            console.log(`\n❌ פקודה ${i + 1}/${statements.length}: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`✅ פקודה ${i + 1}/${statements.length}: ${shortStatement}`);
          successCount++;
        }
      } catch (err) {
        console.log(`\n⚠️  פקודה ${i + 1}/${statements.length}: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log('\n──────────────────────────────────────────────────────────────');
    
    if (errorCount > 0) {
      console.log(`\n⚠️  המיגרציה הושלמה עם ${errorCount} שגיאות`);
      console.log('\n📝 כנראה שצריך להריץ את ה-SQL ישירות ב-Supabase Dashboard:');
      console.log('   1. היכנס ל: https://supabase.com/dashboard');
      console.log('   2. בחר את הפרויקט → SQL Editor');
      console.log('   3. העתק והדבק את תוכן הקובץ:');
      console.log(`      ${migrationPath}`);
      console.log('   4. לחץ Run');
    } else {
      console.log('\n✅ המיגרציה הושלמה בהצלחה!');
    }
    
    console.log('\n🏁 סיום!');
    
  } catch (error) {
    console.error('\n❌ שגיאה:', error.message);
    process.exit(1);
  }
}

// הרצה
runMigration();
