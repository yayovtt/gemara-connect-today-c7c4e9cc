import { FileText, Upload, Files } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useRef, useState } from 'react';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import { useToast } from '@/hooks/use-toast';

// Configure PDF.js worker - use local worker from node_modules
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface TextInputProps {
  text: string;
  onTextChange: (text: string) => void;
}

export function TextInput({ text, onTextChange }: TextInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const extractTextFromFile = async (file: File, useOCR: boolean = false): Promise<string> => {
    // Handle PDF files
    if (file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        
        // If no text found and OCR is enabled
        if (!pageText.trim() && useOCR) {
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d')!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;
          const imageData = canvas.toDataURL();
          
          const ocrResult = await Tesseract.recognize(imageData, 'heb+eng');
          fullText += ocrResult.data.text + '\n\n';
        } else {
          fullText += pageText + '\n\n';
        }
      }
      return fullText.trim();
    }

    // Handle Word documents
    if (file.name.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    }

    // Handle text and HTML files
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        
        if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(content, 'text/html');
          doc.querySelectorAll('script, style').forEach(el => el.remove());
          const textContent = doc.body?.innerText || doc.body?.textContent || content;
          resolve(textContent);
        } else {
          resolve(content);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const extractedText = await extractTextFromFile(file, true);
      onTextChange(extractedText);
      toast({
        title: 'קובץ נטען בהצלחה',
        description: `${file.name} - ${extractedText.length} תווים`,
      });
    } catch (error) {
      console.error('Error reading file:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בקריאת הקובץ. אנא נסה קובץ אחר.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMultipleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsProcessing(true);
    let combinedText = '';

    try {
      for (const file of files) {
        const fileText = await extractTextFromFile(file, true);
        combinedText += `\n\n=== ${file.name} ===\n\n${fileText}`;
      }

      onTextChange(combinedText.trim());
      toast({
        title: 'קבצים נטענו בהצלחה',
        description: `${files.length} קבצים - ${combinedText.length} תווים`,
      });
    } catch (error) {
      console.error('Error reading files:', error);
      toast({
        title: 'שגיאה',
        description: 'שגיאה בקריאת אחד הקבצים',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gold shadow-md overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="bg-white border border-gold px-6 py-4 border-b border-gold flex items-center justify-between flex-row-reverse">
        <div className="flex items-center gap-3 flex-row-reverse text-right">
          <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-navy" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-navy">טקסט לניתוח</h2>
            <p className="text-sm text-muted-foreground">הדבק או העלה PDF/Word/HTML/טקסט</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.html,.htm,.docx,.pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={multiFileInputRef}
            type="file"
            accept=".txt,.html,.htm,.docx,.pdf"
            multiple
            onChange={handleMultipleFiles}
            className="hidden"
          />
          <Button
            onClick={() => multiFileInputRef.current?.click()}
            variant="outline"
            className="gap-2 rounded-xl border border-gold hover:bg-gold/5 flex-row-reverse text-navy"
            disabled={isProcessing}
          >
            <Files className="w-4 h-4" />
            {isProcessing ? 'מעלה...' : 'העלה מספר קבצים'}
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="gap-2 rounded-xl border border-gold hover:bg-gold/5 flex-row-reverse text-navy"
            disabled={isProcessing}
          >
            <Upload className="w-4 h-4" />
            {isProcessing ? 'מעלה...' : 'העלה קובץ'}
          </Button>
        </div>
      </div>

      {/* Text area */}
      <div className="p-6">
        <Textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="הדבק כאן את הטקסט לניתוח, או העלה קובץ PDF/Word/HTML/טקסט..."
          className="min-h-[180px] resize-y bg-white border border-gold focus:border-gold text-navy leading-relaxed text-base rounded-xl text-right placeholder:text-navy/50"
          dir="rtl"
        />

        <div className="flex items-center justify-between mt-4 px-1 flex-row-reverse">
          <p className="text-sm text-muted-foreground">
            {text.length > 0 ? `${text.length.toLocaleString()} תווים` : 'הזן טקסט להתחלה'}
          </p>
          {text.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTextChange('')}
              className="text-muted-foreground hover:text-destructive"
            >
              נקה טקסט
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
