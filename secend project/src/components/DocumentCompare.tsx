import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, GitCompare } from 'lucide-react';
import * as Diff from 'diff';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

export function DocumentCompare() {
  const [file1Text, setFile1Text] = useState('');
  const [file2Text, setFile2Text] = useState('');
  const [file1Name, setFile1Name] = useState('');
  const [file2Name, setFile2Name] = useState('');
  const [diffResult, setDiffResult] = useState<any[]>([]);
  const [isComparing, setIsComparing] = useState(false);
  const file1Ref = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);

  const extractText = async (file: File): Promise<string> => {
    // Handle PDF
    if (file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
    }

    // Handle Word
    if (file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    // Handle text/HTML
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(content, 'text/html');
          doc.querySelectorAll('script, style').forEach(el => el.remove());
          resolve(doc.body?.innerText || '');
        } else {
          resolve(content);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fileNum: 1 | 2
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractText(file);
      if (fileNum === 1) {
        setFile1Text(text);
        setFile1Name(file.name);
      } else {
        setFile2Text(text);
        setFile2Name(file.name);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('שגיאה בקריאת הקובץ');
    }
  };

  const compareDocuments = () => {
    if (!file1Text || !file2Text) {
      alert('נא להעלות שני קבצים');
      return;
    }

    setIsComparing(true);
    const diff = Diff.diffWords(file1Text, file2Text);
    setDiffResult(diff);
    setIsComparing(false);
  };

  const stats = {
    added: diffResult.filter(d => d.added).length,
    removed: diffResult.filter(d => d.removed).length,
    unchanged: diffResult.filter(d => !d.added && !d.removed).length,
  };

  return (
    <div className="bg-white rounded-2xl border border-gold p-6 shadow-md text-right space-y-6">
      <div className="flex items-center gap-3 justify-end">
        <h3 className="font-bold text-xl text-navy">השוואת מסמכים</h3>
        <GitCompare className="w-6 h-6 text-gold" />
      </div>

      {/* File Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* File 1 */}
        <div className="bg-secondary/30 rounded-xl p-4 border border-gold/30">
          <input
            ref={file1Ref}
            type="file"
            accept=".txt,.html,.htm,.docx,.pdf"
            onChange={(e) => handleFileUpload(e, 1)}
            className="hidden"
          />
          <Button
            onClick={() => file1Ref.current?.click()}
            variant="outline"
            className="w-full mb-3 border-gold text-navy"
          >
            <Upload className="w-4 h-4 ml-2" />
            העלה מסמך ראשון
          </Button>
          {file1Name && (
            <div className="flex items-center gap-2 text-sm text-navy bg-white p-2 rounded-lg border border-gold/50">
              <FileText className="w-4 h-4 text-gold" />
              <span>{file1Name}</span>
            </div>
          )}
        </div>

        {/* File 2 */}
        <div className="bg-secondary/30 rounded-xl p-4 border border-gold/30">
          <input
            ref={file2Ref}
            type="file"
            accept=".txt,.html,.htm,.docx,.pdf"
            onChange={(e) => handleFileUpload(e, 2)}
            className="hidden"
          />
          <Button
            onClick={() => file2Ref.current?.click()}
            variant="outline"
            className="w-full mb-3 border-gold text-navy"
          >
            <Upload className="w-4 h-4 ml-2" />
            העלה מסמך שני
          </Button>
          {file2Name && (
            <div className="flex items-center gap-2 text-sm text-navy bg-white p-2 rounded-lg border border-gold/50">
              <FileText className="w-4 h-4 text-gold" />
              <span>{file2Name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Compare Button */}
      <Button
        onClick={compareDocuments}
        disabled={!file1Text || !file2Text || isComparing}
        className="w-full bg-gold hover:bg-gold-dark text-navy font-bold text-lg h-12"
      >
        <GitCompare className="w-5 h-5 ml-2" />
        השווה מסמכים
      </Button>

      {/* Results */}
      {diffResult.length > 0 && (
        <>
          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-300 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.added}</div>
              <div className="text-sm text-green-600">נוספו</div>
            </div>
            <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-700">{stats.removed}</div>
              <div className="text-sm text-red-600">נמחקו</div>
            </div>
            <div className="bg-blue-50 border border-blue-300 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.unchanged}</div>
              <div className="text-sm text-blue-600">זהים</div>
            </div>
          </div>

          {/* Diff Display */}
          <div className="bg-white border border-gold rounded-xl p-4">
            <h4 className="font-bold text-navy mb-3">הבדלים:</h4>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 text-right font-mono text-sm leading-relaxed" dir="rtl">
                {diffResult.map((part, index) => (
                  <span
                    key={index}
                    className={`${
                      part.added
                        ? 'bg-green-200 text-green-900'
                        : part.removed
                        ? 'bg-red-200 text-red-900 line-through'
                        : 'text-gray-700'
                    } px-1`}
                  >
                    {part.value}
                  </span>
                ))}
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
