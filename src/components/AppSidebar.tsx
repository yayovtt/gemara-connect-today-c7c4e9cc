import { useState, useEffect, useRef } from "react";
import { BookOpen, Scale, Search, Upload, Pin, PinOff, ChevronDown, ChevronLeft, Download, FileJson, Library, X, Activity, Bot } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MASECHTOT, SEDARIM } from "@/lib/masechtotData";

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onMasechetSelect?: (masechetHebrewName: string) => void;
  isPinned?: boolean;
  onPinToggle?: () => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const menuItems = [
  {
    id: "gemara",
    title: "גמרא",
    icon: BookOpen,
    description: "לימוד מסכתות ודפים",
  },
  {
    id: "gemara-psak-index",
    title: "אינדקס גמרא-פסקים",
    icon: Library,
    description: "חיבורים בין סוגיות לפסקי דין",
  },
  {
    id: "psak-din",
    title: "פסקי דין",
    icon: Scale,
    description: "צפייה בפסקי דין",
  },
  {
    id: "search",
    title: "חיפוש פסקי דין",
    icon: Search,
    description: "חיפוש מתקדם בכל פסקי הדין",
  },
  {
    id: "upload",
    title: "העלאה",
    icon: Upload,
    description: "העלאת מסמכים",
  },
  {
    id: "download-psakim",
    title: "הורדה מהאתר",
    icon: Download,
    description: "הורדת פסקים מ-psakim.org",
  },
  {
    id: "import-index",
    title: "ייבוא אינדקס",
    icon: FileJson,
    description: "ייבוא חיבורים לגמרא מקובץ",
  },
  {
    id: "system-health",
    title: "בדיקת מערכת",
    icon: Activity,
    description: "בדיקת תקינות כל הרכיבים",
  },
  {
    id: "code-integration",
    title: "שילוב קוד",
    icon: Bot,
    description: "העלאת וניתוח קוד לשילוב",
  },
];

const AppSidebar = ({ 
  activeTab, 
  onTabChange, 
  onMasechetSelect,
  isPinned = true,
  onPinToggle,
  isMobileOpen = false,
  onMobileClose
}: AppSidebarProps) => {
  const isMobile = useIsMobile();
  const { setOpen, open: sidebarOpen } = useSidebar();
  const [expandedSedarim, setExpandedSedarim] = useState<Set<string>>(new Set());
  const [isHovered, setIsHovered] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle hover zone for opening sidebar when unpinned (autohide mode) - desktop only
  useEffect(() => {
    if (isPinned || isMobile) return;

    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const hoverZone = 50; // pixels from right edge - larger zone for easier access
      
      // Check if mouse is in the right edge zone
      if (windowWidth - e.clientX <= hoverZone) {
        if (!isHovered && !sidebarOpen) {
          // Clear any pending close timeout
          if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current);
            closeTimeoutRef.current = null;
          }
          setIsHovered(true);
          setOpen(true);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isPinned, isMobile, isHovered, sidebarOpen, setOpen]);

  // Handle closing sidebar after leaving hover - faster for autohide feel
  const handleMouseLeave = () => {
    if (isPinned || isMobile) return;
    
    // Close after 500ms delay for smoother autohide
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setOpen(false);
    }, 500);
  };

  const handleMouseEnter = () => {
    // Cancel close timeout if user returns to sidebar
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const toggleSeder = (seder: string) => {
    const newExpanded = new Set(expandedSedarim);
    if (newExpanded.has(seder)) {
      newExpanded.delete(seder);
    } else {
      newExpanded.add(seder);
    }
    setExpandedSedarim(newExpanded);
  };

  const handlePinToggle = () => {
    if (onPinToggle) {
      onPinToggle();
    }
    if (!isPinned) {
      setOpen(true);
    }
  };

  // קיבוץ מסכתות לפי סדר
  const groupedMasechtot = SEDARIM.map(seder => ({
    seder,
    masechtot: MASECHTOT.filter(m => m.seder === seder)
  }));

  // Desktop: When unpinned and not hovered, don't render the sidebar content
  // Mobile: Controlled by isMobileOpen
  if (isMobile) {
    if (!isMobileOpen) return null;
  } else {
    if (!isPinned && !sidebarOpen && !isHovered) return null;
  }

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onMobileClose}
        />
      )}
      
      <Sidebar 
        side="right" 
        className={cn(
          "border-l border-border/50 transition-all duration-300 bg-sidebar",
          isMobile 
            ? "fixed right-0 top-0 h-full z-50 w-72 shadow-2xl"
            : isPinned 
              ? "fixed right-0 top-0 h-full z-40" 
              : "fixed right-0 top-0 h-full z-50 shadow-2xl",
          isMobile && !isMobileOpen && "translate-x-full",
          !isMobile && !isPinned && !sidebarOpen && "translate-x-full opacity-0 pointer-events-none"
        )}
        collapsible="none"
        variant={isPinned ? "sidebar" : "floating"}
        onMouseEnter={isMobile ? undefined : handleMouseEnter}
        onMouseLeave={isMobile ? undefined : handleMouseLeave}
      >
        <SidebarHeader className="border-b border-border/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">ניווט ראשי</h2>
              <p className="text-xs text-muted-foreground">מסכתות ופסקי דין</p>
            </div>
            {isMobile ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMobileClose}
                className="h-8 w-8"
                title="סגור"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePinToggle}
                className="h-8 w-8"
                title={isPinned ? "בטל נעיצה" : "נעץ סיידבר"}
              >
                {isPinned ? (
                  <Pin className="h-4 w-4 text-accent" />
                ) : (
                  <PinOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            )}
          </div>
        </SidebarHeader>
      
        <SidebarContent className="px-2">
          {/* תפריט ניווט */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground text-xs mb-2 px-2">
              תפריט
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.id)}
                      isActive={activeTab === item.id}
                      tooltip={item.description}
                      className={cn(
                        "rounded-xl py-2.5 px-3 transition-all duration-200",
                        activeTab === item.id 
                          ? "bg-primary text-primary-foreground shadow-md" 
                          : "hover:bg-secondary/80 text-foreground"
                      )}
                    >
                      <item.icon className={cn(
                        "h-4 w-4",
                        activeTab === item.id ? "text-accent" : "text-muted-foreground"
                      )} />
                      <span className="font-medium text-sm">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* רשימת מסכתות מתקפלת */}
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-muted-foreground text-xs mb-2 px-2">
              מסכתות הגמרא
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="space-y-1">
                {groupedMasechtot.map((group) => (
                  <div key={group.seder} className="rounded-lg overflow-hidden">
                    {/* כותרת סדר */}
                    <button
                      type="button"
                      onClick={() => toggleSeder(group.seder)}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-sm font-medium transition-all",
                        "bg-secondary/50 hover:bg-secondary text-foreground rounded-lg",
                        expandedSedarim.has(group.seder) && "rounded-b-none"
                      )}
                    >
                      <span>סדר {group.seder}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {group.masechtot.length} מסכתות
                        </span>
                        {expandedSedarim.has(group.seder) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* רשימת מסכתות */}
                    {expandedSedarim.has(group.seder) && (
                      <div className="bg-muted/30 rounded-b-lg border-x border-b border-border/30">
                        {group.masechtot.map((masechet, index) => (
                          <button
                            key={masechet.englishName}
                            type="button"
                            onClick={() => {
                              if (onMasechetSelect) {
                                onMasechetSelect(masechet.hebrewName);
                              } else {
                                onTabChange("gemara");
                              }
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-4 py-2 text-sm transition-all",
                              "hover:bg-accent/10 text-foreground cursor-pointer",
                              index !== group.masechtot.length - 1 && "border-b border-border/20"
                            )}
                          >
                            <span>{masechet.hebrewName}</span>
                            <span className="text-xs text-muted-foreground">
                              {masechet.maxDaf - 1} דפים
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-border/50 p-3">
          <div className="text-center text-xs text-muted-foreground">
            גמרא להלכה © 2024
          </div>
        </SidebarFooter>
      </Sidebar>
    </>
  );
};

export default AppSidebar;