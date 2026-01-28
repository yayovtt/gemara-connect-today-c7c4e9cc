import { Share2, Copy, Link as LinkIcon, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import QRCodeLib from 'qrcode';

interface ShareSearchProps {
  conditions: any[];
  text: string;
}

export function ShareSearch({ conditions, text }: ShareSearchProps) {
  const { toast } = useToast();
  const [shareUrl, setShareUrl] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen && conditions.length > 0) {
      generateShareUrl();
    }
  }, [isOpen, conditions]);

  const generateShareUrl = async () => {
    const searchData = {
      conditions,
      text: text.substring(0, 500), // Include preview of text
    };

    const encoded = btoa(encodeURIComponent(JSON.stringify(searchData)));
    const url = `${window.location.origin}${window.location.pathname}?search=${encoded}`;
    setShareUrl(url);

    // Generate QR code
    try {
      const qrDataUrl = await QRCodeLib.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e3a8a',
          light: '#ffffff',
        },
      });
      setQrCodeDataUrl(qrDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: 'הקישור הועתק',
      description: 'הקישור הועתק ללוח',
    });
  };

  const shareViaWhatsApp = () => {
    const message = encodeURIComponent(`בדוק את החיפוש הזה: ${shareUrl}`);
    window.open(`https://wa.me/?text=${message}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('שיתוף חיפוש - מערכת חיפוש הקשר');
    const body = encodeURIComponent(`
שלום,

רציתי לשתף איתך חיפוש שביצעתי במערכת:

${shareUrl}

תנאי החיפוש:
${conditions.map((c, i) => `${i + 1}. ${c.type === 'pattern' ? 'תבנית' : 'טקסט'}: ${c.text}`).join('\n')}
    `);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const downloadQRCode = () => {
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `qr-code-${Date.now()}.png`;
    a.click();

    toast({
      title: 'QR Code הורד',
      description: 'הקובץ הורד למחשב',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 rounded-xl border-gold hover:bg-gold/5 flex-row-reverse text-navy"
          disabled={conditions.length === 0}
        >
          <Share2 className="w-4 h-4" />
          שתף חיפוש
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right text-navy">שיתוף חיפוש</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Share URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy text-right block">
              קישור לחיפוש
            </label>
            <div className="flex gap-2">
              <Input
                value={shareUrl}
                readOnly
                className="flex-1 text-right"
                dir="ltr"
              />
              <Button onClick={copyToClipboard} variant="outline" size="icon">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={shareViaWhatsApp}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </Button>
            <Button
              onClick={shareViaEmail}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email
            </Button>
          </div>

          {/* QR Code */}
          {qrCodeDataUrl && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-navy text-right block">
                QR Code לגישה מנייד
              </label>
              <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48" />
                <Button
                  onClick={downloadQRCode}
                  variant="outline"
                  className="gap-2"
                  size="sm"
                >
                  <QrCode className="w-4 h-4" />
                  הורד QR Code
                </Button>
              </div>
            </div>
          )}

          {/* Search Details */}
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-right">
            <h4 className="font-medium text-navy mb-2">תנאי החיפוש שישותפו:</h4>
            <ul className="text-sm text-blue-900 space-y-1">
              {conditions.map((c, i) => (
                <li key={i}>
                  {i + 1}. {c.type === 'pattern' ? 'תבנית' : 'טקסט'}: {c.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
