import { useMemo } from 'react';
import { X, Book } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Document, SourceReference } from '@/services/indexService';
import { numberToHebrew } from '@/utils/hebrewUtils';

interface DocumentViewerProps {
  document: Document | null;
  references: SourceReference[];
  open: boolean;
  onClose: () => void;
}

// הסרת תגיות HTML וחילוץ טקסט בלבד
function stripHtmlTags(html: string): string {
  // יצירת אלמנט זמני לפרסור HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // הסרת תגיות style ו-script
  const scripts = doc.querySelectorAll('script, style, head');
  scripts.forEach(el => el.remove());
  
  // חילוץ הטקסט בלבד
  const text = doc.body?.textContent || doc.documentElement?.textContent || html;
  
  // ניקוי רווחים מיותרים
  return text.replace(/\s+/g, ' ').trim();
}

// הסרת אותיות אנגליות (משאיר עברית, מספרים, סימני פיסוק)
function removeEnglishLetters(text: string): string {
  // משאיר: עברית, מספרים, רווחים, סימני פיסוק נפוצים
  return text.replace(/[a-zA-Z]/g, '');
}

// המרת מספרים לאותיות עבריות בטקסט
function convertNumbersToHebrewLetters(text: string): string {
  // דפוסים לזיהוי דפים ועמודים עם מספרים
  const patterns = [
    // דף + מספר
    { regex: /דף\s*(\d+)/g, prefix: 'דף ' },
    // עמוד + מספר
    { regex: /עמוד\s*(\d+)/g, prefix: 'עמוד ' },
    // ע"א, ע"ב עם מספרים
    { regex: /ע['"]?א\s*(\d+)/g, prefix: 'ע"א ' },
    { regex: /ע['"]?ב\s*(\d+)/g, prefix: 'ע"ב ' },
  ];

  let result = text;
  
  for (const pattern of patterns) {
    result = result.replace(pattern.regex, (match, num) => {
      const hebrewNum = numberToHebrew(parseInt(num));
      return hebrewNum ? `${pattern.prefix}${hebrewNum}` : match;
    });
  }

  // המר גם מספרים בודדים אחרי מילות מפתח
  result = result.replace(/(דף|עמוד|פרק|סימן)\s*(\d+)/g, (match, word, num) => {
    const hebrewNum = numberToHebrew(parseInt(num));
    return hebrewNum ? `${word} ${hebrewNum}` : match;
  });

  return result;
}

// ניקוי מלא של הטקסט
function cleanDocumentContent(content: string): string {
  // בדוק אם זה HTML
  const isHtml = content.trim().startsWith('<') || content.includes('<!DOCTYPE');
  
  let text = content;
  
  if (isHtml) {
    text = stripHtmlTags(content);
  }
  
  // הסר אותיות אנגליות
  text = removeEnglishLetters(text);
  
  // המר מספרים לאותיות עבריות
  text = convertNumbersToHebrewLetters(text);
  
  // נקה רווחים כפולים
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// פורמט מראה מקום עם אותיות עבריות
function formatReferenceHebrew(ref: SourceReference): string {
  const dafHebrew = numberToHebrew(ref.daf_number);
  const amudHebrew = ref.amud === 'א' || ref.amud.includes('א') ? 'א' : 'ב';
  return `${ref.tractate?.name || ''} דף ${dafHebrew} עמוד ${amudHebrew}`;
}

export function DocumentViewer({ document, references, open, onClose }: DocumentViewerProps) {
  // יצירת טקסט עם הדגשות - hook must be before any early return
  const highlightedContent = useMemo(() => {
    if (!document?.content) return null;

    // ניקוי התוכן - הסרת HTML ואותיות אנגליות
    const cleanedContent = cleanDocumentContent(document.content);

    // עבור תצוגה פשוטה ללא הדגשות (אם אין מראי מקומות)
    if (references.length === 0) {
      return [{ text: cleanedContent, highlighted: false }];
    }

    // כאשר יש מראי מקומות, חפש אותם בטקסט המנוקה והדגש
    const segments: { text: string; highlighted: boolean; ref?: SourceReference }[] = [];
    let remainingText = cleanedContent;
    let currentPos = 0;

    // מיין לפי מיקום
    const sortedRefs = [...references].sort((a, b) => (a.position_in_doc || 0) - (b.position_in_doc || 0));

    for (const ref of sortedRefs) {
      // חפש את הטקסט המקורי של ההפניה בתוכן המנוקה
      const searchText = removeEnglishLetters(ref.original_text);
      const foundIndex = remainingText.indexOf(searchText);
      
      if (foundIndex !== -1) {
        // הוסף טקסט לפני ההדגשה
        if (foundIndex > 0) {
          segments.push({ text: remainingText.substring(0, foundIndex), highlighted: false });
        }
        
        // הוסף את הטקסט המודגש
        segments.push({ 
          text: convertNumbersToHebrewLetters(searchText), 
          highlighted: true,
          ref 
        });
        
        // עדכן את הטקסט הנותר
        remainingText = remainingText.substring(foundIndex + searchText.length);
      }
    }

    // הוסף את הטקסט הנותר
    if (remainingText) {
      segments.push({ text: remainingText, highlighted: false });
    }

    return segments.length > 0 ? segments : [{ text: cleanedContent, highlighted: false }];
  }, [document?.content, references]);

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0" dir="rtl">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
              <Book className="w-5 h-5" />
              {document.name}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span>
              נמצאו {references.length} מראי מקומות
            </span>
            <span>•</span>
            <span>
              {new Date(document.created_at).toLocaleDateString('he-IL')}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 h-full">
          <div className="p-6">
            {/* רשימת מראי מקומות שזוהו */}
            {references.length > 0 && (
              <div className="mb-6 p-4 bg-accent/30 rounded-xl border border-accent">
                <h4 className="font-semibold text-foreground mb-3">מראי מקומות שזוהו:</h4>
                <div className="flex flex-wrap gap-2">
                  {references.map((ref, idx) => (
                    <span
                      key={ref.id || idx}
                      className="px-3 py-1 bg-warning text-warning-foreground font-bold rounded-full text-sm"
                    >
                      {formatReferenceHebrew(ref)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* תוכן המסמך עם הדגשות */}
            <div className="prose prose-lg max-w-none text-right leading-relaxed">
              {highlightedContent?.map((segment, idx) => (
                segment.highlighted ? (
                  <mark
                    key={idx}
                    className="bg-warning text-warning-foreground font-bold px-1 rounded"
                    title={segment.ref ? formatReferenceHebrew(segment.ref) : undefined}
                  >
                    {segment.text}
                  </mark>
                ) : (
                  <span key={idx} className="whitespace-pre-wrap">{segment.text}</span>
                )
              ))}
              
              {!document.content && (
                <p className="text-muted-foreground text-center py-8">
                  אין תוכן טקסט זמין למסמך זה
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}