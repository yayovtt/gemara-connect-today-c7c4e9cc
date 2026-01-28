import { useState, useCallback } from 'react';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { findTalmudReferences, formatReference, TalmudReference } from '@/utils/talmudParser';
import { 
  createDocument, 
  saveSourceReferences, 
  uploadDocument,
  Tractate 
} from '@/services/indexService';

interface DocumentUploaderProps {
  tractates: Tractate[];
  onDocumentProcessed: () => void;
}

export function DocumentUploader({ tractates, onDocumentProcessed }: DocumentUploaderProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [docName, setDocName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [previewRefs, setPreviewRefs] = useState<TalmudReference[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const handleTextChange = useCallback((text: string) => {
    setTextContent(text);
    // תצוגה מקדימה של מראי המקומות
    const refs = findTalmudReferences(text);
    setPreviewRefs(refs);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setDocName(uploadedFile.name.replace(/\.[^/.]+$/, ''));

    const fileName = uploadedFile.name.toLowerCase();
    const fileType = uploadedFile.type;

    // קריאת תוכן הקובץ לפי סוג
    if (
      fileType.includes('text') || 
      fileName.endsWith('.txt') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.html') ||
      fileName.endsWith('.htm')
    ) {
      const text = await uploadedFile.text();
      
      // עיבוד HTML - חילוץ טקסט בלבד
      if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        // הסרת script ו-style
        doc.querySelectorAll('script, style').forEach(el => el.remove());
        const extractedText = doc.body?.textContent || doc.documentElement?.textContent || text;
        handleTextChange(extractedText);
      } 
      // עיבוד JSON - חילוץ ערכי טקסט
      else if (fileName.endsWith('.json')) {
        try {
          const jsonData = JSON.parse(text);
          const extractedText = extractTextFromJson(jsonData);
          handleTextChange(extractedText);
        } catch {
          // אם JSON לא תקין, נשתמש בטקסט הגולמי
          handleTextChange(text);
        }
      } 
      else {
        handleTextChange(text);
      }
    } else {
      toast({
        title: 'שים לב',
        description: 'לעיבוד אוטומטי של PDF יש להעתיק את הטקסט לשדה למטה',
        variant: 'default',
      });
    }
  };

  // פונקציה לחילוץ טקסט מ-JSON
  const extractTextFromJson = (data: unknown): string => {
    const texts: string[] = [];
    
    const extract = (obj: unknown) => {
      if (typeof obj === 'string') {
        texts.push(obj);
      } else if (Array.isArray(obj)) {
        obj.forEach(extract);
      } else if (obj && typeof obj === 'object') {
        Object.values(obj).forEach(extract);
      }
    };
    
    extract(data);
    return texts.join('\n');
  };

  const handleProcess = async () => {
    if (!docName.trim() || !textContent.trim()) {
      toast({
        title: 'שגיאה',
        description: 'יש להזין שם מסמך ותוכן טקסט',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      // העלאת קובץ אם קיים
      let filePath: string | undefined;
      if (file) {
        filePath = await uploadDocument(file, file.name);
      }

      // יצירת רשומת מסמך
      const doc = await createDocument(docName, textContent, filePath);

      // חיפוש וזיהוי מראי מקומות
      const refs = findTalmudReferences(textContent);

      // שמירת מראי המקומות
      await saveSourceReferences(doc.id, refs, tractates, textContent);

      toast({
        title: 'המסמך עובד בהצלחה!',
        description: `נמצאו ${refs.length} מראי מקומות`,
      });

      // איפוס הטופס
      setDocName('');
      setTextContent('');
      setPreviewRefs([]);
      setFile(null);
      onDocumentProcessed();

    } catch (error) {
      console.error('Error processing document:', error);
      toast({
        title: 'שגיאה בעיבוד המסמך',
        description: 'אנא נסה שנית',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3 flex-row-reverse justify-end">
        <div className="w-10 h-10 bg-gradient-to-br from-gold to-gold-light rounded-xl flex items-center justify-center shadow-md">
          <FileText className="w-5 h-5 text-navy" />
        </div>
        <h3 className="text-xl font-bold text-navy">
          העלאת מסמך חדש
        </h3>
      </div>

      {/* העלאת קובץ */}
      <div className="border-2 border-dashed border-border rounded-xl p-8 text-right hover:border-gold transition-colors bg-gradient-to-l from-secondary/30 to-transparent">
        <input
          type="file"
          onChange={handleFileUpload}
          accept=".txt,.doc,.docx,.pdf,.json,.html,.htm"
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className="cursor-pointer block">
          <div className="flex items-center gap-4 flex-row-reverse justify-end">
            <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center">
              <Upload className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-base text-foreground font-medium">
                {file ? (
                  <span className="text-navy">{file.name}</span>
                ) : (
                  'גרור קובץ לכאן או לחץ לבחירה'
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                TXT, DOC, DOCX, PDF, JSON, HTML
              </p>
            </div>
          </div>
        </label>
        {file && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFile(null)}
            className="mt-4 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4 ml-2" />
            הסר קובץ
          </Button>
        )}
      </div>

      {/* שם המסמך */}
      <div className="text-right">
        <label className="block text-sm font-bold text-navy mb-2">
          שם המסמך / פסק הדין
        </label>
        <Input
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          placeholder="לדוגמה: פסק דין בעניין גירושין..."
          className="rounded-xl text-right"
        />
      </div>

      {/* תוכן הטקסט */}
      <div className="text-right">
        <label className="block text-sm font-bold text-navy mb-2">
          תוכן הטקסט לניתוח
        </label>
        <Textarea
          value={textContent}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="הדבק כאן את תוכן פסק הדין..."
          className="min-h-[200px] rounded-xl font-mono text-sm text-right"
        />
      </div>

      {/* תצוגה מקדימה של מראי מקומות */}
      {previewRefs.length > 0 && (
        <div className="bg-gradient-to-l from-gold/20 to-gold/5 rounded-xl p-5 border border-gold/30 text-right">
          <h4 className="font-bold text-navy mb-4 text-lg">
            מראי מקומות שזוהו ({previewRefs.length}):
          </h4>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto justify-end">
            {previewRefs.map((ref, idx) => (
              <Badge 
                key={idx} 
                variant="secondary"
                className="rounded-full bg-white shadow-sm text-navy font-medium px-3 py-1"
              >
                {formatReference(ref)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* כפתור עיבוד */}
      <Button
        onClick={handleProcess}
        disabled={isProcessing || !docName.trim() || !textContent.trim()}
        className="w-full h-14 text-lg rounded-xl bg-gradient-to-l from-navy to-navy-light hover:from-navy-light hover:to-navy gap-3 shadow-lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            מעבד את המסמך...
          </>
        ) : (
          <>
            <FileText className="w-5 h-5" />
            עבד מסמך וצור אינדקס
          </>
        )}
      </Button>
    </div>
  );
}
