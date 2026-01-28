import { useState, useMemo } from 'react';
import { Plus, X, Search, List, HelpCircle, Sparkles, Eye, BookTemplate, Hash, Languages, FileText, Calculator, Type, AlignJustify } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchCondition, ConditionOperator, ProximityDirection, ListMode, SmartSearchOptions } from '@/types/search';
import { ChevronDown } from 'lucide-react';
import { WordListSelector } from './WordListSelector';
import { WordList, WordListCategory } from '@/types/wordList';

interface SearchConditionBuilderProps {
  conditions: SearchCondition[];
  onConditionsChange: (conditions: SearchCondition[]) => void;
  onSearch: () => void;
  smartOptions: SmartSearchOptions;
  onSmartOptionsChange: (options: SmartSearchOptions) => void;
  wordLists: WordList[];
  categories: WordListCategory[];
}

// תבניות חיפוש מוכנות
const searchTemplates = [
  {
    id: 'exact-phrase',
    name: 'חיפוש מדויק',
    description: 'מצא ביטוי מדויק בטקסט',
    conditions: [{ id: '1', term: '', operator: 'AND' as ConditionOperator }],
  },
  {
    id: 'include-exclude',
    name: 'כולל + לא כולל',
    description: 'מצא מילה אחת אבל לא אחרת',
    conditions: [
      { id: '1', term: '', operator: 'AND' as ConditionOperator },
      { id: '2', term: '', operator: 'NOT' as ConditionOperator },
    ],
  },
  {
    id: 'multiple-options',
    name: 'אחת מכמה אפשרויות',
    description: 'מצא אחת מרשימת מילים',
    conditions: [
      { id: '1', term: '', operator: 'AND' as ConditionOperator },
      { id: '2', term: '', operator: 'LIST' as ConditionOperator, listWords: [], listMode: 'any' as ListMode },
    ],
  },
  {
    id: 'proximity',
    name: 'מילים קרובות',
    description: 'מצא מילים בקרבה זו לזו',
    conditions: [
      { id: '1', term: '', operator: 'AND' as ConditionOperator },
      { id: '2', term: '', operator: 'NEAR' as ConditionOperator, proximityRange: 10, proximityDirection: 'both' as ProximityDirection },
    ],
  },
];

// הסברים לאופרטורים
const operatorHelp: Record<ConditionOperator, { label: string; description: string; example: string }> = {
  AND: {
    label: 'וגם',
    description: 'שתי המילים חייבות להופיע יחד',
    example: '"תורה" וגם "משה" → ימצא רק שורות עם שתי המילים',
  },
  OR: {
    label: 'או',
    description: 'לפחות אחת מהמילים צריכה להופיע',
    example: '"משה" או "אהרון" → ימצא שורות עם אחת מהן',
  },
  NOT: {
    label: 'ללא',
    description: 'המילה לא צריכה להופיע',
    example: '"תורה" ללא "משנה" → ימצא תורה ללא משנה',
  },
  NEAR: {
    label: 'בקרבת',
    description: 'המילים צריכות להיות קרובות זו לזו',
    example: '"משה" בקרבת 5 מילים מ-"הר" → ימצא כשהן קרובות',
  },
  LIST: {
    label: 'רשימה',
    description: 'חפש אחת או כל המילים מרשימה',
    example: 'רשימה של שמות → ימצא כל שם מהרשימה',
  },
};

// הגדרות חיפוש חכם
const smartSearchConfig = [
  {
    key: 'numberToHebrew' as keyof SmartSearchOptions,
    icon: Hash,
    label: 'מספרים ↔ אותיות',
    description: 'דף 20 ימצא גם דף כ׳',
    example: 'פרק 5 = פרק ה׳',
  },
  {
    key: 'wordVariations' as keyof SmartSearchOptions,
    icon: Languages,
    label: 'וריאציות מילים',
    description: 'יחיד/רבים, עם/בלי ה׳',
    example: 'ספר = הספר = ספרים',
  },
  {
    key: 'ignoreNikud' as keyof SmartSearchOptions,
    icon: Type,
    label: 'התעלמות מניקוד',
    description: 'מתעלם מסימני ניקוד בחיפוש',
    example: 'שָׁלוֹם = שלום',
  },
  {
    key: 'sofitEquivalence' as keyof SmartSearchOptions,
    icon: AlignJustify,
    label: 'אותיות סופיות',
    description: 'ך=כ, ם=מ, ן=נ, ף=פ, ץ=צ',
    example: 'שלם = שלום (עם ם סופית)',
  },
  {
    key: 'gematriaSearch' as keyof SmartSearchOptions,
    icon: Calculator,
    label: 'חיפוש גימטריא',
    description: 'מוצא מילים עם אותו ערך מספרי',
    example: 'אחד (13) = אהבה (13)',
  },
  {
    key: 'acronymExpansion' as keyof SmartSearchOptions,
    icon: FileText,
    label: 'ראשי תיבות',
    description: 'מרחיב קיצורים נפוצים',
    example: 'רמב"ם = רבי משה בן מימון',
  },
];

export function SearchConditionBuilder({
  conditions,
  onConditionsChange,
  onSearch,
  smartOptions,
  onSmartOptionsChange,
  wordLists,
  categories,
}: SearchConditionBuilderProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [smartSearchOpen, setSmartSearchOpen] = useState(true);

  const addCondition = () => {
    const newCondition: SearchCondition = {
      id: crypto.randomUUID(),
      term: '',
      operator: 'AND',
      proximityRange: 10,
      proximityDirection: 'both',
      listWords: [],
      listMode: 'any',
    };
    onConditionsChange([...conditions, newCondition]);
  };

  const removeCondition = (id: string) => {
    onConditionsChange(conditions.filter(c => c.id !== id));
  };

  const updateCondition = (id: string, updates: Partial<SearchCondition>) => {
    onConditionsChange(
      conditions.map(c => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleListWordsChange = (id: string, text: string) => {
    const words = text.split('\n').filter(w => w.trim());
    updateCondition(id, { listWords: words, term: words.join(' | ') });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if ((e.target as HTMLElement).tagName !== 'TEXTAREA') {
        onSearch();
      }
    }
  };

  const applyTemplate = (template: typeof searchTemplates[0]) => {
    const newConditions = template.conditions.map(c => ({
      ...c,
      id: crypto.randomUUID(),
    }));
    onConditionsChange(newConditions);
    setShowTemplates(false);
  };

  // בניית תצוגה מקדימה של השאילתה
  const queryPreview = useMemo(() => {
    const parts: string[] = [];
    
    conditions.forEach((cond, index) => {
      if (!cond.term.trim() && cond.operator !== 'LIST') return;
      if (cond.operator === 'LIST' && (!cond.listWords || cond.listWords.length === 0)) return;
      
      if (index > 0 && parts.length > 0) {
        parts.push(operatorHelp[cond.operator].label);
      }
      
      if (cond.operator === 'LIST') {
        const words = cond.listWords?.slice(0, 3).join(', ') || '';
        const more = (cond.listWords?.length || 0) > 3 ? '...' : '';
        parts.push(`[${words}${more}]`);
      } else {
        parts.push(`"${cond.term}"`);
      }
    });
    
    return parts.join(' ');
  }, [conditions]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="glass-effect rounded-2xl p-6 space-y-6 animate-fade-in" dir="rtl">
        {/* כותרת עם כפתורים */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-navy rounded-xl flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-navy">בנאי שאילתות חיפוש</h2>
              <p className="text-sm text-muted-foreground">בנה חיפוש מתקדם עם תנאים מרובים</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowTemplates(!showTemplates)}
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-gold text-navy hover:bg-gold/10"
            >
              <BookTemplate className="w-4 h-4" />
              תבניות
            </Button>
            <Button
              onClick={addCondition}
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl border-navy text-navy hover:bg-navy/10"
            >
              <Plus className="w-4 h-4" />
              הוסף תנאי
            </Button>
          </div>
        </div>

        {/* תבניות חיפוש */}
        {showTemplates && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-secondary/30 rounded-xl border border-gold/30 animate-fade-in">
            <div className="col-span-full flex items-center gap-2 pb-2 border-b border-border">
              <Sparkles className="w-4 h-4 text-gold" />
              <span className="font-semibold text-navy">תבניות חיפוש מוכנות</span>
            </div>
            {searchTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="text-right p-4 rounded-xl bg-white border-2 border-transparent hover:border-gold transition-all hover:shadow-md"
              >
                <div className="font-semibold text-navy">{template.name}</div>
                <div className="text-sm text-muted-foreground">{template.description}</div>
              </button>
            ))}
          </div>
        )}

        {/* חיפוש חכם */}
        <Collapsible open={smartSearchOpen} onOpenChange={setSmartSearchOpen}>
          <div className="bg-gradient-to-br from-gold/10 to-gold/5 rounded-2xl border-2 border-gold/30 overflow-hidden">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gold/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gold rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-navy" />
                  </div>
                  <div className="text-right">
                    <h3 className="font-bold text-lg text-navy">חיפוש חכם</h3>
                    <p className="text-sm text-muted-foreground">
                      {Object.values(smartOptions).filter(Boolean).length} כללים פעילים
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-navy transition-transform duration-200 ${smartSearchOpen ? 'rotate-180' : ''}`} />
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent>
              <div className="p-4 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {smartSearchConfig.map((config) => {
                  const Icon = config.icon;
                  const isActive = smartOptions[config.key];
                  
                  return (
                    <Tooltip key={config.key}>
                      <TooltipTrigger asChild>
                        <div 
                          className={`flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer ${
                            isActive 
                              ? 'bg-white border-2 border-gold shadow-sm' 
                              : 'bg-white/50 border-2 border-transparent hover:border-gold/30'
                          }`}
                          onClick={() => onSmartOptionsChange({ ...smartOptions, [config.key]: !isActive })}
                        >
                          <div className="flex items-center gap-3 text-right">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-gold text-navy' : 'bg-secondary text-muted-foreground'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <Label className={`font-medium ${isActive ? 'text-navy' : 'text-foreground'}`}>{config.label}</Label>
                              <p className="text-xs text-muted-foreground">{config.description}</p>
                            </div>
                          </div>
                          <Switch
                            checked={isActive}
                            onCheckedChange={(checked) => onSmartOptionsChange({ ...smartOptions, [config.key]: checked })}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-navy text-white p-3 rounded-xl max-w-xs text-right">
                        <div className="font-bold mb-1">{config.label}</div>
                        <div className="text-sm opacity-90 mb-2">{config.description}</div>
                        <div className="text-xs bg-white/10 px-2 py-1 rounded-lg inline-block">
                          דוגמה: {config.example}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* תנאי החיפוש */}
        <div className="space-y-4">
          {conditions.map((condition, index) => (
            <div
              key={condition.id}
              className="animate-slide-up bg-white rounded-xl p-4 border-2 border-border/50 hover:border-navy/30 transition-all"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                {/* אופרטור */}
                {index > 0 ? (
                  <div className="flex items-center gap-1">
                    <Select
                      value={condition.operator}
                      onValueChange={(value: ConditionOperator) =>
                        updateCondition(condition.id, { operator: value })
                      }
                    >
                      <SelectTrigger className="w-28 bg-secondary rounded-xl font-semibold border-2 border-navy/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-navy/20 rounded-xl">
                        <SelectItem value="AND">וגם</SelectItem>
                        <SelectItem value="OR">או</SelectItem>
                        <SelectItem value="NOT">ללא</SelectItem>
                        <SelectItem value="NEAR">בקרבת</SelectItem>
                        <SelectItem value="LIST">רשימה</SelectItem>
                      </SelectContent>
                    </Select>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="p-1 text-muted-foreground hover:text-navy transition-colors">
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-right bg-navy text-white p-3 rounded-xl">
                        <div className="font-bold mb-1">{operatorHelp[condition.operator].label}</div>
                        <div className="text-sm opacity-90 mb-2">{operatorHelp[condition.operator].description}</div>
                        <div className="text-xs bg-white/10 p-2 rounded-lg">
                          {operatorHelp[condition.operator].example}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ) : (
                  <Badge variant="secondary" className="h-10 px-4 bg-navy text-white font-semibold rounded-xl">
                    חפש:
                  </Badge>
                )}

                {/* שדה הקלט */}
                {condition.operator === 'LIST' && index > 0 ? (
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-xl flex-wrap">
                      <List className="w-5 h-5 text-navy" />
                      <span className="text-sm text-muted-foreground font-medium">רשימת מילים (כל שורה = מילה אחת)</span>
                      <Select
                        value={condition.listMode || 'any'}
                        onValueChange={(value: ListMode) =>
                          updateCondition(condition.id, { listMode: value })
                        }
                      >
                        <SelectTrigger className="w-32 bg-white rounded-xl border-2 border-gold/30">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white rounded-xl">
                          <SelectItem value="any">אחת מהן</SelectItem>
                          <SelectItem value="all">כולן</SelectItem>
                        </SelectContent>
                      </Select>
                      <WordListSelector
                        wordLists={wordLists}
                        categories={categories}
                        onSelectList={(words) => {
                          const existingWords = condition.listWords || [];
                          const allWords = [...new Set([...existingWords, ...words])];
                          updateCondition(condition.id, { 
                            listWords: allWords, 
                            term: allWords.join(' | ') 
                          });
                        }}
                      />
                    </div>
                    <Textarea
                      value={(condition.listWords || []).join('\n')}
                      onChange={(e) => handleListWordsChange(condition.id, e.target.value)}
                      placeholder="הזן מילים - כל שורה מילה אחת..."
                      className="min-h-[100px] bg-secondary/30 font-mono text-sm rounded-xl border-2 border-border focus:border-navy"
                      dir="rtl"
                    />
                  </div>
                ) : (
                  <Input
                    value={condition.term}
                    onChange={(e) => updateCondition(condition.id, { term: e.target.value })}
                    onKeyPress={handleKeyPress}
                    placeholder={index === 0 ? 'הזן מילת חיפוש...' : 'הזן תנאי נוסף...'}
                    className="flex-1 bg-secondary/30 h-12 text-lg rounded-xl border-2 border-border focus:border-navy"
                    dir="rtl"
                  />
                )}

                {/* כפתור מחיקה */}
                {conditions.length > 1 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => removeCondition(condition.id)}
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl shrink-0"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-destructive text-white rounded-lg">
                      הסר תנאי זה
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* אפשרויות קרבה */}
              {index > 0 && condition.operator === 'NEAR' && (
                <div className="flex items-center gap-3 mt-4 p-4 bg-gold/10 rounded-xl border border-gold/30">
                  <span className="text-sm font-medium text-navy whitespace-nowrap">טווח:</span>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={condition.proximityRange || 10}
                    onChange={(e) => updateCondition(condition.id, { proximityRange: parseInt(e.target.value) || 10 })}
                    className="w-20 bg-white rounded-xl border-2 text-center"
                  />
                  <span className="text-sm text-muted-foreground">מילים</span>
                  
                  <Select
                    value={condition.proximityDirection || 'both'}
                    onValueChange={(value: ProximityDirection) =>
                      updateCondition(condition.id, { proximityDirection: value })
                    }
                  >
                    <SelectTrigger className="w-32 bg-white rounded-xl border-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white rounded-xl">
                      <SelectItem value="before">לפני</SelectItem>
                      <SelectItem value="after">אחרי</SelectItem>
                      <SelectItem value="both">לפני ואחרי</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* תצוגה מקדימה של השאילתה */}
        {queryPreview && (
          <div className="flex items-start gap-3 p-4 bg-navy/5 rounded-xl border border-navy/20 animate-fade-in">
            <Eye className="w-5 h-5 text-navy mt-0.5 shrink-0" />
            <div className="text-right">
              <div className="text-sm font-semibold text-navy mb-1">תצוגה מקדימה של השאילתה:</div>
              <div className="text-base font-mono text-foreground bg-white px-3 py-2 rounded-lg inline-block">
                {queryPreview}
              </div>
            </div>
          </div>
        )}

        {/* כפתור חיפוש */}
        <Button
          onClick={onSearch}
          size="lg"
          className="w-full h-16 text-xl rounded-2xl bg-navy hover:bg-navy-light text-white font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] gap-3"
        >
          <Search className="w-6 h-6" />
          חפש בטקסט
        </Button>
      </div>
    </TooltipProvider>
  );
}
