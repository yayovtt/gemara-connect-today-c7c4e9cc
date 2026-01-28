import { Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState } from 'react';

interface SearchTemplate {
  id: string;
  name: string;
  description: string;
  conditions: any[];
  category: string;
}

interface SearchTemplatesProps {
  onApplyTemplate: (conditions: any[]) => void;
}

const templates: SearchTemplate[] = [
  {
    id: 'talmud-citations',
    name: 'כל הציטוטים מהתלמוד',
    description: 'מוצא כל ההתייחסויות למסכתות, דפים ועמודים',
    category: 'תלמוד',
    conditions: [
      { id: '1', type: 'pattern', text: 'colon-notation', distance: 0, order: 'any' },
      { id: '2', type: 'pattern', text: 'dot-notation', distance: 0, order: 'any' },
      { id: '3', type: 'pattern', text: 'english-folio', distance: 0, order: 'any' },
    ],
  },
  {
    id: 'rambam-refs',
    name: 'הפניות לרמב"ם',
    description: 'כל ההפניות למשנה תורה והלכות',
    category: 'ראשונים',
    conditions: [
      { id: '1', type: 'pattern', text: 'rambam-ref', distance: 0, order: 'any' },
    ],
  },
  {
    id: 'shulchan-aruch',
    name: 'מראי מקומות בשולחן ערוך',
    description: 'חיפוש הפניות לשולחן ערוך - סימן, סעיף',
    category: 'פוסקים',
    conditions: [
      { id: '1', type: 'pattern', text: 'shulchan-aruch', distance: 0, order: 'any' },
      { id: '2', type: 'pattern', text: 'siman-seif', distance: 0, order: 'any' },
    ],
  },
  {
    id: 'mishna-refs',
    name: 'כל המשניות',
    description: 'מוצא כל ההתייחסויות למשנה - מסכת, פרק, משנה',
    category: 'משנה',
    conditions: [
      { id: '1', type: 'pattern', text: 'mishna-ref', distance: 0, order: 'any' },
    ],
  },
  {
    id: 'torah-verses',
    name: 'פסוקי תנ"ך',
    description: 'חיפוש הפניות לפסוקים בתורה ונביאים',
    category: 'תנ"ך',
    conditions: [
      { id: '1', type: 'pattern', text: 'torah-verse', distance: 0, order: 'any' },
    ],
  },
  {
    id: 'zohar-refs',
    name: 'מקומות בזוהר',
    description: 'כל ההפניות לזוהר הקדוש',
    category: 'קבלה',
    conditions: [
      { id: '1', type: 'pattern', text: 'zohar-ref', distance: 0, order: 'any' },
    ],
  },
  {
    id: 'midrash-refs',
    name: 'מדרשי חז"ל',
    description: 'חיפוש מדרשים, פרקים ופסוקים',
    category: 'מדרש',
    conditions: [
      { id: '1', type: 'pattern', text: 'midrash-ref', distance: 0, order: 'any' },
    ],
  },
  {
    id: 'shut-refs',
    name: 'שו"ת - שאלות ותשובות',
    description: 'הפניות לספרי שו"ת',
    category: 'פוסקים',
    conditions: [
      { id: '1', type: 'pattern', text: 'shut-ref', distance: 0, order: 'any' },
    ],
  },
  {
    id: 'multiple-sources',
    name: 'ריבוי מקורות באותו מקום',
    description: 'מוצא מקומות עם 3+ מקורות קרובים',
    category: 'מתקדם',
    conditions: [
      { id: '1', type: 'pattern', text: 'colon-notation', distance: 20, order: 'any' },
      { id: '2', type: 'pattern', text: 'colon-notation', distance: 20, order: 'any' },
      { id: '3', type: 'pattern', text: 'colon-notation', distance: 20, order: 'any' },
    ],
  },
  {
    id: 'talmud-with-rashi',
    name: 'תלמוד עם רש"י',
    description: 'מוצא מקומות שמציינים גם תלמוד וגם רש"י',
    category: 'משולב',
    conditions: [
      { id: '1', type: 'pattern', text: 'colon-notation', distance: 50, order: 'any' },
      { id: '2', type: 'text', text: 'רש"י', distance: 50, order: 'any' },
    ],
  },
];

export function SearchTemplates({ onApplyTemplate }: SearchTemplatesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))];

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="bg-white rounded-2xl border border-gold shadow-md overflow-hidden animate-fade-in">
      {/* Header */}
      <div
        className="bg-white border border-gold px-6 py-4 border-b border-gold cursor-pointer hover:bg-gold/5 transition-colors flex items-center justify-between flex-row-reverse"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3 flex-row-reverse text-right">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-navy">תבניות חיפוש מוכנות</h2>
            <p className="text-sm text-muted-foreground">
              {templates.length} תבניות לחיפוש מהיר
            </p>
          </div>
        </div>
      </div>

      {/* Templates List */}
      {isOpen && (
        <div className="p-4">
          {/* Category Filter */}
          <div className="flex gap-2 mb-4 flex-wrap flex-row-reverse">
            {categories.map(cat => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                className={`cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-gold text-navy'
                    : 'hover:bg-gold/10'
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat === 'all' ? 'הכל' : cat}
              </Badge>
            ))}
          </div>

          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 rounded-xl border border-gold/30 hover:border-gold hover:shadow-md transition-all group"
                >
                  <div className="text-right">
                    <div className="flex items-start justify-between mb-2 flex-row-reverse">
                      <h3 className="font-bold text-navy group-hover:text-gold transition-colors">
                        {template.name}
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {template.description}
                    </p>
                    <div className="flex items-center justify-between flex-row-reverse">
                      <Badge variant="secondary" className="text-xs">
                        {template.conditions.length} תנאים
                      </Badge>
                      <Button
                        size="sm"
                        onClick={() => onApplyTemplate(template.conditions)}
                        className="gap-2 bg-gold hover:bg-gold/90 text-navy flex-row-reverse"
                      >
                        <Plus className="w-3 h-3" />
                        החל
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
