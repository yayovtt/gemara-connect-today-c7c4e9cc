import { useState, useEffect } from 'react';
import { Book, FileText, Trash2, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  fetchAllReferencesGrouped, 
  fetchDocuments, 
  fetchReferencesByDocument,
  deleteDocument,
  SourceReference, 
  Document 
} from '@/services/indexService';
import { useToast } from '@/hooks/use-toast';
import { DocumentViewer } from './DocumentViewer';
import { numberToHebrew } from '@/utils/hebrewUtils';

interface IndexViewerProps {
  refreshTrigger: number;
}

// פורמט דף ועמוד באותיות עבריות
function formatDafAmud(daf: number, amud: string): string {
  const dafHebrew = numberToHebrew(daf);
  const amudHebrew = amud === 'א' || amud === 'ע"א' ? 'א' : 'ב';
  return `דף ${dafHebrew} עמוד ${amudHebrew}`;
}

export function IndexViewer({ refreshTrigger }: IndexViewerProps) {
  const { toast } = useToast();
  const [view, setView] = useState<'tractates' | 'documents'>('tractates');
  const [groupedRefs, setGroupedRefs] = useState<Map<string, SourceReference[]>>(new Map());
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [selectedDocRefs, setSelectedDocRefs] = useState<SourceReference[]>([]);

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [refs, docs] = await Promise.all([
        fetchAllReferencesGrouped(),
        fetchDocuments(),
      ]);
      setGroupedRefs(refs);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      const refs = await fetchReferencesByDocument(doc.id);
      setSelectedDocument(doc);
      setSelectedDocRefs(refs);
      setViewerOpen(true);
    } catch (error) {
      toast({
        title: 'שגיאה בטעינת המסמך',
        description: 'אנא נסה שנית',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id);
      toast({
        title: 'המסמך נמחק',
        description: 'המסמך וכל מראי המקומות שלו נמחקו',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'שגיאה במחיקה',
        description: 'אנא נסה שנית',
        variant: 'destructive',
      });
    }
  };

  const totalRefs = Array.from(groupedRefs.values()).reduce((sum, refs) => sum + refs.length, 0);

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        טוען נתונים...
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-gold to-gold-light rounded-xl flex items-center justify-center shadow-md">
            <Book className="w-5 h-5 text-navy" />
          </div>
          אינדקס מראי מקומות
        </h3>
        <div className="flex gap-2">
          <Button
            variant={view === 'tractates' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('tractates')}
            className="rounded-xl"
          >
            לפי מסכת
          </Button>
          <Button
            variant={view === 'documents' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('documents')}
            className="rounded-xl"
          >
            לפי מסמך
          </Button>
        </div>
      </div>

      {/* Stats - RTL order */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-bl from-navy/10 to-navy/5 rounded-xl p-5 text-right border border-navy/10">
          <div className="text-3xl font-bold text-navy">{documents.length}</div>
          <div className="text-sm text-muted-foreground mt-1">מסמכים</div>
        </div>
        <div className="bg-gradient-to-bl from-gold/20 to-gold/10 rounded-xl p-5 text-right border border-gold/20">
          <div className="text-3xl font-bold text-navy">{groupedRefs.size}</div>
          <div className="text-sm text-muted-foreground mt-1">מסכתות</div>
        </div>
        <div className="bg-gradient-to-bl from-accent/20 to-accent/10 rounded-xl p-5 text-right border border-accent/20">
          <div className="text-3xl font-bold text-navy">{totalRefs}</div>
          <div className="text-sm text-muted-foreground mt-1">מראי מקומות</div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[400px]">
        {view === 'tractates' ? (
          <Accordion type="multiple" className="space-y-3 pl-4">
            {Array.from(groupedRefs.entries())
              .sort((a, b) => a[0].localeCompare(b[0], 'he'))
              .map(([tractate, refs]) => (
                <AccordionItem
                  key={tractate}
                  value={tractate}
                  className="bg-card rounded-xl border-2 border-border/50 overflow-hidden shadow-sm border-r-4 border-r-gold"
                >
                  <AccordionTrigger rtl className="px-5 py-4 hover:no-underline hover:bg-secondary/30">
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 bg-gold/20 rounded-lg flex items-center justify-center">
                        <Book className="w-4 h-4 text-gold" />
                      </div>
                      <span className="font-bold text-lg text-foreground">{tractate}</span>
                      <Badge variant="secondary" className="rounded-full bg-gold/20 text-navy font-bold mr-auto">
                        {refs.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-5 pb-4">
                    <div className="space-y-3">
                      {refs.map((ref) => (
                        <div
                          key={ref.id}
                          className="bg-gradient-to-l from-secondary/50 to-secondary/20 rounded-xl p-4 text-right border-r-4 border-gold/50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-foreground text-base">
                              {formatDafAmud(ref.daf_number, ref.amud)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => ref.document && handleViewDocument(ref.document)}
                              className="h-8 text-xs gap-2 hover:bg-navy/10 rounded-lg"
                            >
                              {ref.document?.name}
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          {ref.context && (
                            <p className="text-muted-foreground text-sm line-clamp-2 leading-relaxed">
                              ...{ref.context}...
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        ) : (
          <div className="space-y-4 pl-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-card rounded-xl border-2 border-border/50 p-5 text-right shadow-sm hover:shadow-md transition-shadow border-r-4 border-navy"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-navy/10 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-navy" />
                    </div>
                    <span className="font-bold text-lg text-foreground">{doc.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleViewDocument(doc)}
                      className="h-9 w-9 text-navy hover:text-navy hover:bg-navy/10 rounded-xl"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  נוצר בתאריך: {new Date(doc.created_at).toLocaleDateString('he-IL')}
                </div>
              </div>
            ))}
            {documents.length === 0 && (
              <div className="text-right py-12 text-muted-foreground bg-secondary/20 rounded-xl px-6">
                <div className="flex justify-end mb-4">
                  <FileText className="w-12 h-12 opacity-30" />
                </div>
                <p className="text-lg">אין מסמכים עדיין</p>
                <p className="text-sm mt-1">העלה מסמך כדי להתחיל ליצור אינדקס</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Document Viewer Dialog */}
      <DocumentViewer
        document={selectedDocument}
        references={selectedDocRefs}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}
