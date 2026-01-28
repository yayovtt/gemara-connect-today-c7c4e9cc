import { useState, useMemo } from 'react';
import { Plus, X, Sparkles, HelpCircle, Eye, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VisualWordGroup {
  id: string;
  words: string[];
  type: 'must' | 'any' | 'not';
}

interface VisualQueryBuilderProps {
  groups: VisualWordGroup[];
  onGroupsChange: (groups: VisualWordGroup[]) => void;
  onSearch: () => void;
}

const groupConfig = {
  must: {
    label: 'חייב להכיל',
    sublabel: 'כל המילים האלה חייבות להופיע',
    bgColor: 'bg-white',
    borderColor: 'border-navy/30',
    headerBg: 'bg-navy',
    headerText: 'text-white',
    badgeBg: 'bg-navy/10',
    badgeText: 'text-navy',
    badgeHover: 'hover:bg-navy/20',
    buttonBg: 'bg-navy hover:bg-navy-light',
    icon: '✓',
  },
  any: {
    label: 'אחד מאלה',
    sublabel: 'לפחות מילה אחת מהרשימה',
    bgColor: 'bg-white',
    borderColor: 'border-gold',
    headerBg: 'bg-gold',
    headerText: 'text-navy',
    badgeBg: 'bg-gold/20',
    badgeText: 'text-navy',
    badgeHover: 'hover:bg-gold/30',
    buttonBg: 'bg-gold hover:bg-gold-dark text-navy',
    icon: '◐',
  },
  not: {
    label: 'לא להכיל',
    sublabel: 'מילים שלא צריכות להופיע',
    bgColor: 'bg-white',
    borderColor: 'border-destructive/30',
    headerBg: 'bg-destructive',
    headerText: 'text-white',
    badgeBg: 'bg-destructive/10',
    badgeText: 'text-destructive',
    badgeHover: 'hover:bg-destructive/20',
    buttonBg: 'bg-destructive hover:bg-destructive/90',
    icon: '✗',
  },
};

export function VisualQueryBuilder({ 
  groups, 
  onGroupsChange, 
  onSearch,
}: VisualQueryBuilderProps) {
  const [newWords, setNewWords] = useState<Record<string, string>>({});

  const addGroup = (type: 'must' | 'any' | 'not') => {
    const existing = groups.find(g => g.type === type);
    if (!existing) {
      onGroupsChange([...groups, { id: crypto.randomUUID(), words: [], type }]);
    }
  };

  const removeGroup = (id: string) => {
    onGroupsChange(groups.filter(g => g.id !== id));
  };

  const addWordToGroup = (groupId: string) => {
    const word = newWords[groupId]?.trim();
    if (!word) return;

    onGroupsChange(
      groups.map(g =>
        g.id === groupId && !g.words.includes(word)
          ? { ...g, words: [...g.words, word] }
          : g
      )
    );
    setNewWords(prev => ({ ...prev, [groupId]: '' }));
  };

  const removeWordFromGroup = (groupId: string, word: string) => {
    onGroupsChange(
      groups.map(g =>
        g.id === groupId ? { ...g, words: g.words.filter(w => w !== word) } : g
      )
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent, groupId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWordToGroup(groupId);
    }
  };

  const availableTypes = (['must', 'any', 'not'] as const).filter(
    type => !groups.find(g => g.type === type)
  );

  // בניית תצוגה מקדימה של השאילתה
  const queryPreview = useMemo(() => {
    const parts: string[] = [];
    
    groups.forEach((group) => {
      if (group.words.length === 0) return;
      
      const wordsStr = group.words.slice(0, 3).join(', ');
      const more = group.words.length > 3 ? '...' : '';
      
      switch (group.type) {
        case 'must':
          parts.push(`חייב: [${wordsStr}${more}]`);
          break;
        case 'any':
          parts.push(`אחד מ: [${wordsStr}${more}]`);
          break;
        case 'not':
          parts.push(`ללא: [${wordsStr}${more}]`);
          break;
      }
    });
    
    return parts.join(' + ');
  }, [groups]);

  // הסברים לקבוצות
  const groupHelp = {
    must: 'כל המילים ברשימה זו חייבות להופיע בטקסט כדי שייחשב כתוצאה',
    any: 'לפחות מילה אחת מהרשימה צריכה להופיע בטקסט',
    not: 'אם אחת מהמילים האלה מופיעה, הטקסט לא ייחשב כתוצאה',
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-8 animate-fade-in" dir="rtl">
        {/* הודעה שהחיפוש החכם זמין במצב מתקדם */}
        <div className="flex items-center gap-3 p-4 bg-gold/10 rounded-xl border border-gold/30">
          <Info className="w-5 h-5 text-navy shrink-0" />
          <p className="text-sm text-navy">
            <span className="font-semibold">טיפ:</span> לחיפוש חכם עם כללים מתקדמים (גימטריא, ראשי תיבות, ועוד), עבור ל<span className="font-bold">מצב מתקדם</span>
          </p>
        </div>

        {/* Existing groups */}
        <div className="space-y-6">
          {groups.map((group) => {
            const config = groupConfig[group.type];
            return (
              <div
                key={group.id}
                className={cn(
                  'rounded-2xl border-2 overflow-hidden shadow-md transition-all duration-300',
                  config.bgColor,
                  config.borderColor
                )}
              >
                {/* Group header */}
                <div className={cn('px-6 py-4 flex items-center justify-between', config.headerBg)}>
                  <div className="flex items-center gap-4 text-right">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                      {config.icon}
                    </div>
                    <div>
                      <h3 className={cn('font-bold text-lg', config.headerText)}>{config.label}</h3>
                      <p className={cn('text-sm opacity-80', config.headerText)}>{config.sublabel}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className={cn('p-2 rounded-full hover:bg-white/20 transition-colors', config.headerText)}>
                          <HelpCircle className="w-5 h-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-right bg-navy text-white p-3 rounded-xl">
                        {groupHelp[group.type]}
                      </TooltipContent>
                    </Tooltip>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGroup(group.id)}
                      className={cn('rounded-full', config.headerText, 'hover:bg-white/20')}
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Words display */}
                <div className="p-6">
                  <div className="flex flex-wrap gap-3 mb-6 min-h-[52px] justify-start">
                    {group.words.length === 0 ? (
                      <span className="text-muted-foreground py-3">הוסף מילים לחיפוש...</span>
                    ) : (
                      group.words.map((word) => (
                        <Tooltip key={word}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => removeWordFromGroup(group.id, word)}
                              className={cn(
                                'px-5 py-3 rounded-xl text-base font-semibold transition-all duration-200',
                                'hover:scale-105 active:scale-95 shadow-sm',
                                'flex items-center gap-2 group cursor-pointer border',
                                config.badgeBg,
                                config.badgeText,
                                config.badgeHover
                              )}
                            >
                              <span>{word}</span>
                              <X className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="bg-destructive/90 text-white rounded-lg">
                            לחץ להסרה
                          </TooltipContent>
                        </Tooltip>
                      ))
                    )}
                  </div>

                  {/* Add word input */}
                  <div className="flex gap-3 flex-row-reverse">
                    <Input
                      value={newWords[group.id] || ''}
                      onChange={(e) => setNewWords(prev => ({ ...prev, [group.id]: e.target.value }))}
                      onKeyPress={(e) => handleKeyPress(e, group.id)}
                      placeholder="הקלד מילה ולחץ Enter..."
                      className="flex-1 text-lg h-14 rounded-xl bg-secondary/50 border-2 border-border focus:border-navy text-right"
                      dir="rtl"
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => addWordToGroup(group.id)}
                          className={cn('h-14 px-8 rounded-xl text-white font-semibold', config.buttonBg)}
                        >
                          <Plus className="w-6 h-6" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-navy text-white rounded-lg">
                        הוסף מילה
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add new group buttons */}
        {availableTypes.length > 0 && (
          <div className="space-y-4 py-4">
            <p className="text-center text-muted-foreground font-medium">הוסף קבוצת חיפוש נוספת:</p>
            <div className="flex flex-wrap justify-center gap-4">
              {availableTypes.map((type) => {
                const config = groupConfig[type];
                return (
                  <Tooltip key={type}>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => addGroup(type)}
                        variant="outline"
                        className={cn(
                          'h-16 px-8 rounded-xl border-2 transition-all duration-300 text-base font-semibold',
                          'hover:scale-105 active:scale-95 shadow-sm',
                          config.borderColor
                        )}
                      >
                        <span className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-lg ml-3', config.headerBg, config.headerText)}>
                          {config.icon}
                        </span>
                        {config.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="bg-navy text-white p-3 rounded-xl max-w-xs text-right">
                      {groupHelp[type]}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Search button */}
        <Button
          onClick={onSearch}
          size="lg"
          className="w-full h-18 text-xl rounded-2xl bg-navy hover:bg-navy-light text-white font-bold shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] py-6"
        >
          <Sparkles className="w-7 h-7 ml-3 text-gold" />
          חפש עכשיו
        </Button>
      </div>
    </TooltipProvider>
  );
}

export type { VisualWordGroup };
