import { Star, Trash2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';

interface BookmarkedResult {
  id: string;
  result: any;
  note?: string;
  color?: string;
  timestamp: number;
}

interface ResultBookmarksProps {
  results: any[];
  bookmarkedIds: Set<string>;
  onToggleBookmark: (resultId: string) => void;
  onAddNote: (resultId: string, note: string) => void;
  onSetColor: (resultId: string, color: string) => void;
}

const COLORS = [
  { name: 'צהוב', value: '#fef08a', text: '#713f12' },
  { name: 'ירוק', value: '#bbf7d0', text: '#14532d' },
  { name: 'כחול', value: '#bfdbfe', text: '#1e3a8a' },
  { name: 'ורוד', value: '#fbcfe8', text: '#831843' },
  { name: 'סגול', value: '#e9d5ff', text: '#581c87' },
  { name: 'כתום', value: '#fed7aa', text: '#7c2d12' },
];

export function ResultBookmarks({
  results,
  bookmarkedIds,
  onToggleBookmark,
  onAddNote,
  onSetColor,
}: ResultBookmarksProps) {
  const [noteDialog, setNoteDialog] = useState<{ open: boolean; resultId: string; currentNote: string }>({
    open: false,
    resultId: '',
    currentNote: '',
  });

  const handleSaveNote = () => {
    onAddNote(noteDialog.resultId, noteDialog.currentNote);
    setNoteDialog({ open: false, resultId: '', currentNote: '' });
  };

  return (
    <>
      {results.map((result, index) => {
        const resultId = `result-${index}`;
        const isBookmarked = bookmarkedIds.has(resultId);

        return (
          <div key={resultId} className="relative group">
            {/* Bookmark controls */}
            <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onToggleBookmark(resultId)}
                className={`${
                  isBookmarked
                    ? 'text-yellow-600 bg-yellow-50'
                    : 'text-gray-400 hover:text-yellow-600'
                }`}
              >
                <Star className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </Button>
              {isBookmarked && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setNoteDialog({
                        open: true,
                        resultId,
                        currentNote: result.note || '',
                      })
                    }
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <div className="flex gap-0.5">
                    {COLORS.map(color => (
                      <button
                        key={color.value}
                        onClick={() => onSetColor(resultId, color.value)}
                        className="w-5 h-5 rounded-full border-2 border-white hover:scale-110 transition-transform"
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Result display */}
            <div
              className="p-6 rounded-xl border shadow-sm hover:shadow-md transition-all"
              style={{
                backgroundColor: result.highlightColor || 'white',
                borderColor: isBookmarked ? '#D4AF37' : '#D4AF37',
              }}
            >
              <div className="text-right">
                <div className="flex items-center gap-2 mb-3 flex-row-reverse">
                  {isBookmarked && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      <Star className="w-3 h-3 fill-current mr-1" />
                      מסומן
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-navy">
                    מיקום: {result.position}
                  </Badge>
                  <Badge variant="outline" className="text-navy">
                    תוצאה #{index + 1}
                  </Badge>
                </div>

                <p className="text-lg leading-relaxed mb-3 text-navy">{result.context}</p>

                {result.note && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-2 text-right">
                      <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-900">{result.note}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Note Dialog */}
      <Dialog open={noteDialog.open} onOpenChange={(open) => setNoteDialog({ ...noteDialog, open })}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right text-navy">הוסף הערה לתוצאה</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={noteDialog.currentNote}
              onChange={(e) => setNoteDialog({ ...noteDialog, currentNote: e.target.value })}
              placeholder="כתוב כאן הערות, תובנות או קישורים..."
              className="min-h-[150px] text-right"
              dir="rtl"
            />
            <div className="flex gap-2 justify-start">
              <Button onClick={handleSaveNote} className="bg-gold hover:bg-gold/90 text-navy">
                שמור הערה
              </Button>
              <Button
                variant="outline"
                onClick={() => setNoteDialog({ open: false, resultId: '', currentNote: '' })}
              >
                ביטול
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
