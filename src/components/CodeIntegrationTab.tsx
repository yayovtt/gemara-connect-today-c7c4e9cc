import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Upload, 
  FileCode, 
  Trash2, 
  Send, 
  Bot, 
  User, 
  Loader2,
  FolderOpen,
  FileJson,
  FileText,
  FileArchive
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import JSZip from "jszip";

interface UploadedFile {
  name: string;
  content: string;
  size: number;
  type: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const CodeIntegrationTab = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.json')) return <FileJson className="w-4 h-4 text-yellow-500" />;
    if (fileName.endsWith('.tsx') || fileName.endsWith('.ts')) return <FileCode className="w-4 h-4 text-blue-500" />;
    if (fileName.endsWith('.css')) return <FileCode className="w-4 h-4 text-pink-500" />;
    return <FileText className="w-4 h-4 text-muted-foreground" />;
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const extractZipFile = async (file: File): Promise<UploadedFile[]> => {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    const extractedFiles: UploadedFile[] = [];
    
    const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.txt'];
    
    for (const [path, zipEntry] of Object.entries(contents.files)) {
      // Skip directories, node_modules, and hidden files
      if (zipEntry.dir) continue;
      if (path.includes('node_modules/')) continue;
      if (path.includes('/.') || path.startsWith('.')) continue;
      
      const hasValidExt = validExtensions.some(ext => path.endsWith(ext));
      if (!hasValidExt) continue;
      
      try {
        const content = await zipEntry.async('string');
        const fileName = path.split('/').pop() || path;
        extractedFiles.push({
          name: path, // Keep full path for context
          content,
          size: content.length,
          type: 'text/plain'
        });
      } catch (err) {
        console.error(`Failed to extract ${path}:`, err);
      }
    }
    
    return extractedFiles;
  };

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newFiles: UploadedFile[] = [];
    let zipCount = 0;

    for (const file of fileArray) {
      // Handle ZIP files
      if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
        toast.info(`פותח ZIP: ${file.name}...`);
        try {
          const extractedFiles = await extractZipFile(file);
          newFiles.push(...extractedFiles);
          zipCount++;
          toast.success(`חולצו ${extractedFiles.length} קבצים מ-${file.name}`);
        } catch (err) {
          console.error(`Failed to extract ZIP ${file.name}:`, err);
          toast.error(`שגיאה בפתיחת ${file.name}`);
        }
        continue;
      }

      // Skip non-text files and node_modules
      if (file.name.includes('node_modules')) continue;
      
      const validExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.txt'];
      const hasValidExt = validExtensions.some(ext => file.name.endsWith(ext));
      
      if (!hasValidExt && file.type !== 'application/json' && !file.type.startsWith('text/')) {
        continue;
      }

      try {
        const content = await readFileContent(file);
        newFiles.push({
          name: file.name,
          content,
          size: file.size,
          type: file.type || 'text/plain'
        });
      } catch (err) {
        console.error(`Failed to read ${file.name}:`, err);
      }
    }

    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles]);
      if (zipCount === 0) {
        toast.success(`נוספו ${newFiles.length} קבצים`);
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
    setMessages([]);
  };

  const startAnalysis = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("יש להעלות קבצים קודם");
      return;
    }

    setIsAnalyzing(true);
    
    // Build file summary for AI
    const fileSummary = uploadedFiles.map(f => ({
      name: f.name,
      size: f.size,
      preview: f.content.slice(0, 500) + (f.content.length > 500 ? '...' : '')
    }));

    const systemMessage = `אתה מנתח קוד מומחה. המשתמש העלה ${uploadedFiles.length} קבצים מפרויקט React/TypeScript.
הנה סיכום הקבצים:
${JSON.stringify(fileSummary, null, 2)}

תפקידך:
1. לנתח את מבנה הקוד
2. לזהות את הפונקציונליות העיקרית
3. לשאול שאלות ממוקדות על מה המשתמש רוצה לשלב בפרויקט הנוכחי
4. להציע דרכים לשילוב הקוד

ענה בעברית. התחל בסיכום קצר של מה שזיהית ואז שאל 2-3 שאלות ממוקדות.`;

    try {
      const response = await supabase.functions.invoke('analyze-code-integration', {
        body: { 
          messages: [{ role: "user", content: "נתח את הקבצים שהעליתי ושאל אותי שאלות" }],
          systemPrompt: systemMessage
        }
      });

      if (response.error) throw response.error;

      const aiMessage = response.data?.content || "לא הצלחתי לנתח את הקבצים. נסה שוב.";
      
      setMessages([
        { role: "user", content: `העליתי ${uploadedFiles.length} קבצים לניתוח` },
        { role: "assistant", content: aiMessage }
      ]);
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error("שגיאה בניתוח הקבצים");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isAnalyzing) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsAnalyzing(true);

    // Include relevant file contents in context
    const fileContext = uploadedFiles.map(f => 
      `--- ${f.name} ---\n${f.content.slice(0, 2000)}`
    ).join('\n\n');

    try {
      const response = await supabase.functions.invoke('analyze-code-integration', {
        body: { 
          messages: [
            ...messages,
            { role: "user", content: userMessage }
          ],
          fileContext
        }
      });

      if (response.error) throw response.error;

      const aiMessage = response.data?.content || "לא הצלחתי לעבד את הבקשה.";
      setMessages(prev => [...prev, { role: "assistant", content: aiMessage }]);
    } catch (err) {
      console.error("Chat error:", err);
      toast.error("שגיאה בשליחת ההודעה");
    } finally {
      setIsAnalyzing(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">שילוב קוד חכם</h2>
        </div>
        {uploadedFiles.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearAllFiles}>
            <Trash2 className="w-4 h-4 ml-1" />
            נקה הכל
          </Button>
        )}
      </div>

      {/* Upload Area */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="flex gap-4 mb-3">
            <Upload className={cn("w-10 h-10", isDragging ? "text-primary" : "text-muted-foreground")} />
            <FileArchive className={cn("w-10 h-10", isDragging ? "text-primary" : "text-muted-foreground")} />
          </div>
          <p className="text-sm text-muted-foreground text-center">
            גרור קבצים או קובץ ZIP לכאן, או לחץ לבחירה
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            תומך ב: .ts, .tsx, .js, .jsx, .json, .css, .html, .md, .zip
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            accept=".ts,.tsx,.js,.jsx,.json,.css,.html,.md,.txt,.zip"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </CardContent>
      </Card>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              קבצים שהועלו ({uploadedFiles.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <ScrollArea className="h-40">
              <div className="space-y-1">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 group"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getFileIcon(file.name)}
                      <span className="text-sm truncate">{file.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {formatFileSize(file.size)}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(file.name);
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            {messages.length === 0 && (
              <Button 
                className="w-full mt-3" 
                onClick={startAnalysis}
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    מנתח...
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 ml-2" />
                    התחל ניתוח AI
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chat Area */}
      {messages.length > 0 && (
        <Card className="flex-1">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              שיחה עם AI
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-64 px-4">
              <div className="space-y-3 pb-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex gap-2",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
                {isAnalyzing && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    </div>
                    <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                      מעבד...
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            
            {/* Input */}
            <div className="p-3 border-t">
              <div className="flex gap-2">
                <Textarea
                  placeholder="שאל שאלה או תן הנחיות..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  className="min-h-[40px] max-h-24 resize-none"
                />
                <Button 
                  onClick={sendMessage} 
                  disabled={!inputMessage.trim() || isAnalyzing}
                  size="icon"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CodeIntegrationTab;
