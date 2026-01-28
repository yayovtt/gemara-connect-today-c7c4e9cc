import { Download, FileText, FileSpreadsheet, FileJson, FileType } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface ExportResultsProps {
  results: any[];
  text: string;
  conditions: any[];
}

export function ExportResults({ results, text, conditions }: ExportResultsProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const exportToJSON = () => {
    const data = {
      exportDate: new Date().toISOString(),
      searchConditions: conditions,
      totalResults: results.length,
      results: results.map(r => ({
        position: r.position,
        context: r.context,
        matchedText: r.matchedText,
        beforeText: r.beforeText,
        afterText: r.afterText,
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `חיפוש-${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'ייצוא JSON הצליח',
      description: 'הקובץ הורד למחשב',
    });
    setIsOpen(false);
  };

  const exportToCSV = () => {
    const headers = ['מיקום', 'טקסט מתאים', 'הקשר'];
    const rows = results.map(r => [
      r.position.toString(),
      `"${r.matchedText.replace(/"/g, '""')}"`,
      `"${r.context.replace(/"/g, '""')}"`,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    // Add BOM for Hebrew support in Excel
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `חיפוש-${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'ייצוא Excel הצליח',
      description: 'הקובץ הורד למחשב - פתח ב-Excel',
    });
    setIsOpen(false);
  };

  const exportToText = () => {
    const content = [
      '='.repeat(60),
      'תוצאות חיפוש',
      '='.repeat(60),
      '',
      `תאריך: ${new Date().toLocaleDateString('he-IL')}`,
      `סה"כ תוצאות: ${results.length}`,
      '',
      'תנאי חיפוש:',
      ...conditions.map((c, i) => `${i + 1}. ${c.type === 'pattern' ? 'תבנית' : 'טקסט'}: ${c.text}`),
      '',
      '='.repeat(60),
      '',
      ...results.map((r, i) => [
        `תוצאה #${i + 1} (מיקום: ${r.position})`,
        '-'.repeat(40),
        r.context,
        '',
      ].join('\n')),
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `חיפוש-${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'ייצוא טקסט הצליח',
      description: 'הקובץ הורד למחשב',
    });
    setIsOpen(false);
  };

  const exportToHTML = () => {
    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>תוצאות חיפוש</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
      direction: rtl;
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .result {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      border: 2px solid #D4AF37;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .result-number {
      color: #D4AF37;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .context {
      line-height: 1.8;
      color: #333;
    }
    .highlight {
      background: #fef08a;
      padding: 2px 4px;
      border-radius: 3px;
      font-weight: bold;
    }
    .metadata {
      color: #666;
      font-size: 0.9em;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>תוצאות חיפוש</h1>
    <p>תאריך: ${new Date().toLocaleDateString('he-IL')}</p>
    <p>סה"כ תוצאות: ${results.length}</p>
  </div>
  ${results.map((r, i) => `
    <div class="result">
      <div class="result-number">תוצאה #${i + 1}</div>
      <div class="context">${r.context.replace(r.matchedText, `<span class="highlight">${r.matchedText}</span>`)}</div>
      <div class="metadata">מיקום בטקסט: ${r.position}</div>
    </div>
  `).join('')}
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `חיפוש-${new Date().getTime()}.html`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'ייצוא HTML הצליח',
      description: 'הקובץ הורד למחשב - פתח בדפדפן',
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 rounded-xl border-gold hover:bg-gold/5 flex-row-reverse text-navy"
          disabled={results.length === 0}
        >
          <Download className="w-4 h-4" />
          ייצא תוצאות
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-navy">ייצוא תוצאות חיפוש</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <Button
            onClick={exportToHTML}
            className="w-full justify-between bg-white hover:bg-gold/5 text-navy border border-gold"
          >
            <span className="flex items-center gap-2">
              <FileType className="w-5 h-5" />
              HTML - עמוד אינטרנט מעוצב
            </span>
            <span className="text-xs text-muted-foreground">מומלץ לצפייה</span>
          </Button>

          <Button
            onClick={exportToCSV}
            className="w-full justify-between bg-white hover:bg-gold/5 text-navy border border-gold"
          >
            <span className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              CSV - אקסל
            </span>
            <span className="text-xs text-muted-foreground">לניתוח נתונים</span>
          </Button>

          <Button
            onClick={exportToText}
            className="w-full justify-between bg-white hover:bg-gold/5 text-navy border border-gold"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              TXT - קובץ טקסט
            </span>
            <span className="text-xs text-muted-foreground">פשוט וקל</span>
          </Button>

          <Button
            onClick={exportToJSON}
            className="w-full justify-between bg-white hover:bg-gold/5 text-navy border border-gold"
          >
            <span className="flex items-center gap-2">
              <FileJson className="w-5 h-5" />
              JSON - מבנה נתונים
            </span>
            <span className="text-xs text-muted-foreground">לתכנות</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
