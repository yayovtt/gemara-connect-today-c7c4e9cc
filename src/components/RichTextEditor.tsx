import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignRight, AlignCenter, AlignLeft, AlignJustify,
  List, ListOrdered, Quote, Minus, Undo, Redo,
  Heading1, Heading2, Heading3, Link as LinkIcon, Unlink,
  Highlighter, Code, Pilcrow, RemoveFormatting, Palette, Type, ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editable?: boolean;
}

const HIGHLIGHT_COLORS = [
  { value: '#fef08a', label: 'צהוב', color: '#fef08a' },
  { value: '#86efac', label: 'ירוק', color: '#86efac' },
  { value: '#93c5fd', label: 'כחול', color: '#93c5fd' },
  { value: '#fca5a5', label: 'אדום', color: '#fca5a5' },
  { value: '#c4b5fd', label: 'סגול', color: '#c4b5fd' },
  { value: '#fdba74', label: 'כתום', color: '#fdba74' },
  { value: '#f9a8d4', label: 'ורוד', color: '#f9a8d4' },
  { value: '#a5f3fc', label: 'תכלת', color: '#a5f3fc' },
];

const TEXT_COLORS = [
  { value: 'inherit', label: 'ברירת מחדל', color: 'currentColor' },
  { value: '#000000', label: 'שחור', color: '#000000' },
  { value: '#374151', label: 'אפור כהה', color: '#374151' },
  { value: '#dc2626', label: 'אדום', color: '#dc2626' },
  { value: '#ea580c', label: 'כתום', color: '#ea580c' },
  { value: '#16a34a', label: 'ירוק', color: '#16a34a' },
  { value: '#2563eb', label: 'כחול', color: '#2563eb' },
  { value: '#7c3aed', label: 'סגול', color: '#7c3aed' },
  { value: '#db2777', label: 'ורוד', color: '#db2777' },
];

const MenuButton = ({ 
  onClick, 
  isActive = false, 
  disabled = false,
  children,
  title 
}: { 
  onClick: () => void; 
  isActive?: boolean; 
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) => (
  <Button
    type="button"
    variant={isActive ? 'secondary' : 'ghost'}
    size="icon"
    className="h-8 w-8"
    onClick={onClick}
    disabled={disabled}
    title={title}
  >
    {children}
  </Button>
);

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  const [linkUrl, setLinkUrl] = useState('');
  
  if (!editor) return null;

  const setLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-muted/30">
      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5 pl-2 border-l border-border/50">
        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="בטל"
        >
          <Undo className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="חזור"
        >
          <Redo className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Headings */}
      <div className="flex items-center gap-0.5 px-2 border-l border-border/50">
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="כותרת 1"
        >
          <Heading1 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="כותרת 2"
        >
          <Heading2 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="כותרת 3"
        >
          <Heading3 className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          isActive={editor.isActive('paragraph')}
          title="פסקה"
        >
          <Pilcrow className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Text Formatting */}
      <div className="flex items-center gap-0.5 px-2 border-l border-border/50">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="הדגשה"
        >
          <Bold className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="נטוי"
        >
          <Italic className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="קו תחתון"
        >
          <UnderlineIcon className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="קו חוצה"
        >
          <Strikethrough className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="קוד"
        >
          <Code className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Text Color */}
      <div className="flex items-center gap-0.5 px-2 border-l border-border/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2" title="צבע טקסט">
              <Type className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {TEXT_COLORS.map(color => (
              <DropdownMenuItem
                key={color.value}
                onClick={() => {
                  if (color.value === 'inherit') {
                    editor.chain().focus().unsetColor().run();
                  } else {
                    editor.chain().focus().setColor(color.value).run();
                  }
                }}
                className="gap-2 cursor-pointer"
              >
                <div 
                  className="w-4 h-4 rounded-full border border-border" 
                  style={{ backgroundColor: color.color }}
                />
                <span>{color.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Highlight Color */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant={editor.isActive('highlight') ? 'secondary' : 'ghost'} 
              size="sm" 
              className="h-8 gap-1 px-2" 
              title="הדגשה צבעונית"
            >
              <Highlighter className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem
              onClick={() => editor.chain().focus().unsetHighlight().run()}
              className="gap-2 cursor-pointer"
            >
              <div className="w-4 h-4 rounded border border-border bg-background" />
              <span>הסר הדגשה</span>
            </DropdownMenuItem>
            {HIGHLIGHT_COLORS.map(color => (
              <DropdownMenuItem
                key={color.value}
                onClick={() => editor.chain().focus().toggleHighlight({ color: color.value }).run()}
                className="gap-2 cursor-pointer"
              >
                <div 
                  className="w-4 h-4 rounded border border-border" 
                  style={{ backgroundColor: color.color }}
                />
                <span>{color.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Alignment */}
      <div className="flex items-center gap-0.5 px-2 border-l border-border/50">
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="יישור לימין"
        >
          <AlignRight className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="מרכז"
        >
          <AlignCenter className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          isActive={editor.isActive({ textAlign: 'justify' })}
          title="יישור מלא"
        >
          <AlignJustify className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="שמאל"
        >
          <AlignLeft className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-0.5 px-2 border-l border-border/50">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="רשימה"
        >
          <List className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="רשימה ממוספרת"
        >
          <ListOrdered className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="ציטוט"
        >
          <Quote className="w-4 h-4" />
        </MenuButton>
        <MenuButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="קו מפריד"
        >
          <Minus className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Link */}
      <div className="flex items-center gap-0.5 px-2 border-l border-border/50">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={editor.isActive('link') ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              title="הוסף קישור"
            >
              <LinkIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="flex-1"
                dir="ltr"
              />
              <Button size="sm" onClick={setLink}>
                הוסף
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <MenuButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          title="הסר קישור"
        >
          <Unlink className="w-4 h-4" />
        </MenuButton>
      </div>

      {/* Clear Formatting */}
      <MenuButton
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        title="נקה עיצוב"
      >
        <RemoveFormatting className="w-4 h-4" />
      </MenuButton>
    </div>
  );
};

const RichTextEditor = ({ 
  content, 
  onChange, 
  placeholder = 'התחל לכתוב...', 
  className,
  editable = true 
}: RichTextEditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        defaultAlignment: 'right',
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[300px] p-4 text-right',
        dir: 'rtl',
      },
    },
  });

  // Update content when it changes externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className={cn("border border-border rounded-lg overflow-hidden bg-background", className)}>
      {editable && <MenuBar editor={editor} />}
      <EditorContent editor={editor} className="min-h-[300px]" />
    </div>
  );
};

export default RichTextEditor;