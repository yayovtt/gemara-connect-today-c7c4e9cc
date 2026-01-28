import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Share2, 
  Copy, 
  Check,
  QrCode,
  Link,
  Loader2
} from 'lucide-react';
import { SearchCondition, FilterRules } from '@/types/search';
import { toast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

interface ShareSearchProps {
  conditions: SearchCondition[];
  filterRules: FilterRules;
  text?: string;
  disabled?: boolean;
}

interface ShareOptions {
  includeText: boolean;
  includeConditions: boolean;
  includeFilterRules: boolean;
}

export function ShareSearch({ 
  conditions, 
  filterRules, 
  text = '',
  disabled = false 
}: ShareSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [options, setOptions] = useState<ShareOptions>({
    includeText: false,
    includeConditions: true,
    includeFilterRules: true,
  });

  const generateShareUrl = async () => {
    setIsGenerating(true);
    
    try {
      const shareData: { text?: string; conditions?: SearchCondition[]; filterRules?: FilterRules } = {};
      
      if (options.includeText && text) {
        shareData.text = text;
      }
      if (options.includeConditions && conditions.length > 0) {
        shareData.conditions = conditions;
      }
      if (options.includeFilterRules && Object.keys(filterRules).length > 0) {
        shareData.filterRules = filterRules;
      }

      const encoded = btoa(encodeURIComponent(JSON.stringify(shareData)));
      const url = `${window.location.origin}${window.location.pathname}?search=${encoded}`;
      
      setShareUrl(url);

      // Generate QR code
      const qr = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrCodeUrl(qr);

    } catch (error) {
      console.error('Error generating share URL:', error);
      toast({
        title: 'שגיאה',
        description: 'אירעה שגיאה ביצירת קישור השיתוף',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    generateShareUrl();
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'הועתק',
      description: 'הקישור הועתק ללוח',
    });
  };

  const shareViaWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'שיתוף חיפוש',
          text: 'צפה בחיפוש המתקדם שלי',
          url: shareUrl,
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share error:', error);
        }
      }
    }
  };

  const hasContent = conditions.length > 0 || text.length > 0;

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleOpen}
        disabled={disabled || !hasContent}
      >
        <Share2 className="h-4 w-4 mr-1" />
        שתף
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>שיתוף חיפוש</DialogTitle>
            <DialogDescription>
              צור קישור לשיתוף הגדרות החיפוש
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Options */}
            <div className="space-y-3">
              <Label>מה לשתף?</Label>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="includeConditions"
                  checked={options.includeConditions}
                  onCheckedChange={(checked) => {
                    setOptions({ ...options, includeConditions: !!checked });
                  }}
                />
                <Label htmlFor="includeConditions" className="text-sm">
                  תנאי חיפוש
                  <Badge variant="secondary" className="mr-2">{conditions.length}</Badge>
                </Label>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="includeFilterRules"
                  checked={options.includeFilterRules}
                  onCheckedChange={(checked) => {
                    setOptions({ ...options, includeFilterRules: !!checked });
                  }}
                />
                <Label htmlFor="includeFilterRules" className="text-sm">
                  כללי סינון
                </Label>
              </div>

              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="includeText"
                  checked={options.includeText}
                  onCheckedChange={(checked) => {
                    setOptions({ ...options, includeText: !!checked });
                  }}
                  disabled={!text}
                />
                <Label htmlFor="includeText" className="text-sm">
                  טקסט המקור
                  {text && <Badge variant="secondary" className="mr-2">{text.length} תווים</Badge>}
                </Label>
              </div>
            </div>

            {/* Regenerate button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateShareUrl}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link className="h-4 w-4 mr-2" />
              )}
              צור קישור
            </Button>

            {/* URL Display */}
            {shareUrl && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    dir="ltr"
                    className="flex-1 text-xs"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyToClipboard}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* QR Code */}
                {qrCodeUrl && (
                  <div className="flex flex-col items-center gap-2 p-4 border rounded-lg">
                    <QrCode className="h-5 w-5 text-muted-foreground" />
                    <img src={qrCodeUrl} alt="QR Code" className="rounded-lg" />
                    <p className="text-xs text-muted-foreground">סרוק לפתיחת החיפוש</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              סגור
            </Button>
            {navigator.share && shareUrl && (
              <Button onClick={shareViaWebShare}>
                <Share2 className="h-4 w-4 mr-2" />
                שתף
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// parseSharedSearch function is available from '@/utils/shareUtils'
