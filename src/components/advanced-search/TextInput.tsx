import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  FileText, 
  Image, 
  X, 
  Loader2,
  Camera,
  Link,
  Copy,
  Trash2,
  FileImage
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import Tesseract from 'tesseract.js';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  showFileUpload?: boolean;
  showOcr?: boolean;
  showUrlFetch?: boolean;
  minHeight?: string;
}

export function TextInput({
  value,
  onChange,
  placeholder = 'הכנס טקסט לחיפוש...',
  label = 'טקסט לחיפוש',
  showFileUpload = true,
  showOcr = true,
  showUrlFetch = true,
  minHeight = '200px'
}: TextInputProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'txt') {
        setProcessingStatus('קורא קובץ טקסט...');
        const text = await file.text();
        onChange(value + (value ? '\n\n' : '') + text);
        toast({
          title: 'הצלחה',
          description: 'קובץ הטקסט נטען בהצלחה',
        });
      } else if (extension === 'docx' || extension === 'doc') {
        setProcessingStatus('מעבד קובץ Word...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        onChange(value + (value ? '\n\n' : '') + result.value);
        toast({
          title: 'הצלחה',
          description: 'קובץ Word נטען בהצלחה',
        });
      } else if (extension === 'pdf') {
        setProcessingStatus('מעבד קובץ PDF...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          setProcessingProgress((i / pdf.numPages) * 100);
          setProcessingStatus(`מעבד עמוד ${i} מתוך ${pdf.numPages}...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .filter((item): item is TextItem => 'str' in item)
            .map((item) => item.str)
            .join(' ');
          fullText += pageText + '\n\n';
        }
        
        onChange(value + (value ? '\n\n' : '') + fullText.trim());
        toast({
          title: 'הצלחה',
          description: `קובץ PDF נטען בהצלחה (${pdf.numPages} עמודים)`,
        });
      } else {
        toast({
          title: 'שגיאה',
          description: 'סוג קובץ לא נתמך. נא להעלות TXT, DOCX או PDF',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בעיבוד הקובץ',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStatus('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [value, onChange]);

  const handleImageOcr = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingStatus('מזהה טקסט בתמונה...');

    try {
      const result = await Tesseract.recognize(file, 'heb+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProcessingProgress(m.progress * 100);
          }
        },
      });

      const extractedText = result.data.text.trim();
      if (extractedText) {
        onChange(value + (value ? '\n\n' : '') + extractedText);
        toast({
          title: 'הצלחה',
          description: 'הטקסט זוהה בהצלחה מהתמונה',
        });
      } else {
        toast({
          title: 'אזהרה',
          description: 'לא זוהה טקסט בתמונה',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('OCR error:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה בזיהוי הטקסט',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingStatus('');
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  }, [value, onChange]);

  const handleUrlFetch = useCallback(async () => {
    if (!urlInput.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין כתובת URL',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('מוריד תוכן מהאינטרנט...');

    try {
      // Note: This would require a backend proxy in production
      // For now, we'll show a message about CORS limitations
      toast({
        title: 'מידע',
        description: 'שליפת תוכן מ-URL דורשת שרת proxy. נא להעתיק את הטקסט ידנית.',
        variant: 'default'
      });
    } catch (error) {
      console.error('URL fetch error:', error);
      toast({
        title: 'שגיאה',
        description: 'לא ניתן לטעון את התוכן מהכתובת',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      setShowUrlInput(false);
      setUrlInput('');
    }
  }, [urlInput]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(value);
    toast({
      title: 'הועתק',
      description: 'הטקסט הועתק ללוח',
    });
  }, [value]);

  const clearText = useCallback(() => {
    onChange('');
    toast({
      title: 'נמחק',
      description: 'הטקסט נמחק',
    });
  }, [onChange]);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">{label}</CardTitle>
          <div className="flex items-center gap-2">
            {value && (
              <Badge variant="secondary" className="text-xs">
                {value.length.toLocaleString()} תווים
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-2">
          {showFileUpload && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.doc,.docx,.pdf"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                <FileText className="h-4 w-4 mr-2" />
                טען קובץ
              </Button>
            </>
          )}

          {showOcr && (
            <>
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleImageOcr}
                accept="image/*"
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                disabled={isProcessing}
              >
                <FileImage className="h-4 w-4 mr-2" />
                OCR מתמונה
              </Button>
            </>
          )}

          {showUrlFetch && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowUrlInput(!showUrlInput)}
              disabled={isProcessing}
            >
              <Link className="h-4 w-4 mr-2" />
              טען מ-URL
            </Button>
          )}

          <div className="flex-1" />

          {value && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyToClipboard}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearText}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* URL Input */}
        {showUrlInput && (
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/text"
              dir="ltr"
              className="flex-1"
            />
            <Button onClick={handleUrlFetch} disabled={isProcessing}>
              טען
            </Button>
            <Button variant="ghost" onClick={() => setShowUrlInput(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {processingStatus}
            </div>
            {processingProgress > 0 && (
              <Progress value={processingProgress} className="h-2" />
            )}
          </div>
        )}

        {/* Text Area */}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="resize-none font-hebrew"
          style={{ minHeight }}
          dir="rtl"
        />
      </CardContent>
    </Card>
  );
}
