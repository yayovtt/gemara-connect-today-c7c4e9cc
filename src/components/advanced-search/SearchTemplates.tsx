import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Plus, 
  Save, 
  Trash2, 
  Edit2,
  Copy,
  Download,
  Upload
} from 'lucide-react';
import { SearchCondition, FilterRules } from '@/types/search';
import { toast } from '@/hooks/use-toast';
import { SearchTemplate } from '@/hooks/useSearchTemplates';

interface SearchTemplatesProps {
  templates: SearchTemplate[];
  currentConditions: SearchCondition[];
  currentFilterRules: FilterRules;
  onApplyTemplate: (template: SearchTemplate) => void;
  onSaveTemplate: (template: Omit<SearchTemplate, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateTemplate: (id: string, updates: Partial<SearchTemplate>) => void;
  onDeleteTemplate: (id: string) => void;
}

export function SearchTemplates({
  templates,
  currentConditions,
  currentFilterRules,
  onApplyTemplate,
  onSaveTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
}: SearchTemplatesProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SearchTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  const resetForm = () => {
    setFormData({ name: '', description: '' });
  };

  const handleOpenSave = () => {
    resetForm();
    setEditingTemplate(null);
    setIsSaveDialogOpen(true);
  };

  const handleOpenEdit = (template: SearchTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || '',
    });
    setEditingTemplate(template);
    setIsSaveDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast({
        title: 'שגיאה',
        description: 'נא להזין שם לתבנית',
        variant: 'destructive',
      });
      return;
    }

    if (editingTemplate) {
      onUpdateTemplate(editingTemplate.id, {
        name: formData.name,
        description: formData.description || undefined,
      });
      toast({
        title: 'עודכן',
        description: 'התבנית עודכנה בהצלחה',
      });
    } else {
      onSaveTemplate({
        name: formData.name,
        description: formData.description || undefined,
        conditions: currentConditions,
        filterRules: currentFilterRules,
      });
      toast({
        title: 'נשמר',
        description: 'התבנית נשמרה בהצלחה',
      });
    }

    setIsSaveDialogOpen(false);
    resetForm();
    setEditingTemplate(null);
  };

  const exportTemplates = () => {
    const data = JSON.stringify(templates, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'search-templates.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'יוצא',
      description: 'התבניות יוצאו בהצלחה',
    });
  };

  const importTemplates = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as SearchTemplate[];
        imported.forEach(template => {
          onSaveTemplate({
            name: template.name,
            description: template.description,
            conditions: template.conditions,
            filterRules: template.filterRules,
          });
        });
        toast({
          title: 'יובא',
          description: `${imported.length} תבניות יובאו בהצלחה`,
        });
      } catch (error) {
        toast({
          title: 'שגיאה',
          description: 'לא ניתן לייבא את הקובץ',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const duplicateTemplate = (template: SearchTemplate) => {
    onSaveTemplate({
      name: `${template.name} (עותק)`,
      description: template.description,
      conditions: template.conditions,
      filterRules: template.filterRules,
    });
    toast({
      title: 'שוכפל',
      description: 'התבנית שוכפלה בהצלחה',
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <FileText className="h-5 w-5" />
            תבניות חיפוש
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{templates.length}</Badge>
            <Button size="sm" onClick={handleOpenSave} disabled={currentConditions.length === 0}>
              <Save className="h-4 w-4 mr-1" />
              שמור נוכחי
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Import/Export */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportTemplates} disabled={templates.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            ייצא
          </Button>
          <label>
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                ייבא
              </span>
            </Button>
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={importTemplates}
            />
          </label>
        </div>

        {/* Templates List */}
        <ScrollArea className="h-[300px]">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">אין תבניות שמורות</p>
              <p className="text-xs mt-1">שמור את הגדרות החיפוש הנוכחיות כתבנית</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onApply={() => onApplyTemplate(template)}
                  onEdit={() => handleOpenEdit(template)}
                  onDelete={() => onDeleteTemplate(template.id)}
                  onDuplicate={() => duplicateTemplate(template)}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Save/Edit Dialog */}
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'עריכת תבנית' : 'שמירת תבנית'}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate 
                  ? 'ערוך את פרטי התבנית'
                  : 'שמור את הגדרות החיפוש הנוכחיות כתבנית'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>שם התבנית</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="לדוגמה: חיפוש הלכות שבת"
                />
              </div>

              <div className="space-y-2">
                <Label>תיאור (אופציונלי)</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="תיאור קצר של התבנית"
                  rows={3}
                />
              </div>

              {!editingTemplate && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium mb-1">יכלול:</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li>• {currentConditions.length} תנאי חיפוש</li>
                    <li>• {Object.keys(currentFilterRules).filter(k => currentFilterRules[k as keyof FilterRules] !== undefined).length} כללי סינון</li>
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                ביטול
              </Button>
              <Button onClick={handleSave}>
                {editingTemplate ? 'עדכן' : 'שמור'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

interface TemplateCardProps {
  template: SearchTemplate;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function TemplateCard({ template, onApply, onEdit, onDelete, onDuplicate }: TemplateCardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('he-IL');
  };

  return (
    <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h5 className="font-medium truncate">{template.name}</h5>
          {template.description && (
            <p className="text-sm text-muted-foreground truncate">{template.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">
              {template.conditions.length} תנאים
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(template.updatedAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="default"
            size="sm"
            onClick={onApply}
          >
            החל
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDuplicate}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
