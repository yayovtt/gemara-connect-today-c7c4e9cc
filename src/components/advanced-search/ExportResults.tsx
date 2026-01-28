import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Download, 
  FileText, 
  FileJson, 
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { SearchResult } from '@/types/search';
import { toast } from '@/hooks/use-toast';

interface ExportResultsProps {
  results: SearchResult[];
  disabled?: boolean;
}

type ExportFormat = 'txt' | 'json' | 'csv' | 'html';

interface ExportOptions {
  includePosition: boolean;
  includeScore: boolean;
  includeMatchedTerms: boolean;
  includeContext: boolean;
  separator: string;
}

export function ExportResults({ results, disabled = false }: ExportResultsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [isExporting, setIsExporting] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({
    includePosition: true,
    includeScore: true,
    includeMatchedTerms: true,
    includeContext: false,
    separator: '\n---\n',
  });

  const handleExport = async () => {
    setIsExporting(true);

    try {
      let content: string;
      let mimeType: string;
      let extension: string;

      switch (format) {
        case 'txt':
          content = exportToTxt(results, options);
          mimeType = 'text/plain';
          extension = 'txt';
          break;
        case 'json':
          content = exportToJson(results, options);
          mimeType = 'application/json';
          extension = 'json';
          break;
        case 'csv':
          content = exportToCsv(results, options);
          mimeType = 'text/csv';
          extension = 'csv';
          break;
        case 'html':
          content = exportToHtml(results, options);
          mimeType = 'text/html';
          extension = 'html';
          break;
        default:
          throw new Error('Unsupported format');
      }

      const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results.${extension}`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'יוצא',
        description: `${results.length} תוצאות יוצאו בהצלחה`,
      });
      setIsOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בייצוא',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        disabled={disabled || results.length === 0}
      >
        <Download className="h-4 w-4 mr-1" />
        ייצא
        {results.length > 0 && (
          <Badge variant="secondary" className="mr-2">
            {results.length}
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ייצוא תוצאות</DialogTitle>
            <DialogDescription>
              בחר את פורמט הייצוא והאפשרויות הרצויות
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label>פורמט</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="txt">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      טקסט רגיל (.txt)
                    </div>
                  </SelectItem>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      JSON (.json)
                    </div>
                  </SelectItem>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV (.csv)
                    </div>
                  </SelectItem>
                  <SelectItem value="html">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      HTML (.html)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <Label>אפשרויות</Label>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="includePosition"
                  checked={options.includePosition}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, includePosition: !!checked })
                  }
                />
                <Label htmlFor="includePosition" className="text-sm">כלול מיקום</Label>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="includeScore"
                  checked={options.includeScore}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, includeScore: !!checked })
                  }
                />
                <Label htmlFor="includeScore" className="text-sm">כלול ציון התאמה</Label>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="includeMatchedTerms"
                  checked={options.includeMatchedTerms}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, includeMatchedTerms: !!checked })
                  }
                />
                <Label htmlFor="includeMatchedTerms" className="text-sm">כלול מילים שנמצאו</Label>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="includeContext"
                  checked={options.includeContext}
                  onCheckedChange={(checked) => 
                    setOptions({ ...options, includeContext: !!checked })
                  }
                />
                <Label htmlFor="includeContext" className="text-sm">כלול הקשר</Label>
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="text-muted-foreground">
                יוצא {results.length} תוצאות בפורמט {format.toUpperCase()}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              ביטול
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              ייצא
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function exportToTxt(results: SearchResult[], options: ExportOptions): string {
  return results.map((result, index) => {
    const parts = [`תוצאה ${index + 1}:`];
    if (options.includePosition) parts.push(`מיקום: ${result.position}`);
    if (options.includeScore && result.score !== undefined) {
      parts.push(`ציון: ${Math.round(result.score * 100)}%`);
    }
    if (options.includeMatchedTerms && result.matchedTerms?.length) {
      parts.push(`מילים: ${result.matchedTerms.join(', ')}`);
    }
    parts.push('');
    parts.push(result.text);
    if (options.includeContext && result.context) {
      parts.push('');
      parts.push(`הקשר: ${result.context}`);
    }
    return parts.join('\n');
  }).join(options.separator);
}

function exportToJson(results: SearchResult[], options: ExportOptions): string {
  const data = results.map(result => {
    const item: Record<string, string | number | string[] | undefined> = {
      text: result.text,
    };
    if (options.includePosition) item.position = result.position;
    if (options.includeScore) item.score = result.score;
    if (options.includeMatchedTerms) item.matchedTerms = result.matchedTerms;
    if (options.includeContext) item.context = result.context;
    return item;
  });
  return JSON.stringify(data, null, 2);
}

function exportToCsv(results: SearchResult[], options: ExportOptions): string {
  const headers = ['טקסט'];
  if (options.includePosition) headers.push('מיקום');
  if (options.includeScore) headers.push('ציון');
  if (options.includeMatchedTerms) headers.push('מילים שנמצאו');
  if (options.includeContext) headers.push('הקשר');

  const rows = results.map(result => {
    const row = [escapeCsvField(result.text)];
    if (options.includePosition) row.push(String(result.position));
    if (options.includeScore) row.push(result.score !== undefined ? String(Math.round(result.score * 100)) : '');
    if (options.includeMatchedTerms) row.push(escapeCsvField(result.matchedTerms?.join(', ') || ''));
    if (options.includeContext) row.push(escapeCsvField(result.context || ''));
    return row.join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

function exportToHtml(results: SearchResult[], options: ExportOptions): string {
  const rows = results.map((result, index) => {
    let row = `
      <tr>
        <td>${index + 1}</td>
        <td dir="rtl">${escapeHtml(result.text)}</td>
    `;
    if (options.includePosition) row += `<td>${result.position}</td>`;
    if (options.includeScore) row += `<td>${result.score !== undefined ? Math.round(result.score * 100) + '%' : '-'}</td>`;
    if (options.includeMatchedTerms) row += `<td dir="rtl">${escapeHtml(result.matchedTerms?.join(', ') || '')}</td>`;
    if (options.includeContext) row += `<td dir="rtl">${escapeHtml(result.context || '')}</td>`;
    row += '</tr>';
    return row;
  }).join('');

  let headers = '<th>#</th><th>טקסט</th>';
  if (options.includePosition) headers += '<th>מיקום</th>';
  if (options.includeScore) headers += '<th>ציון</th>';
  if (options.includeMatchedTerms) headers += '<th>מילים</th>';
  if (options.includeContext) headers += '<th>הקשר</th>';

  return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>תוצאות חיפוש</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; direction: rtl; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
    th { background-color: #f4f4f4; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    tr:hover { background-color: #f1f1f1; }
  </style>
</head>
<body>
  <h1>תוצאות חיפוש</h1>
  <p>סה"כ: ${results.length} תוצאות</p>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>
  `.trim();
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
