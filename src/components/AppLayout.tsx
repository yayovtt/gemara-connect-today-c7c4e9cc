import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import FloatingGemaraNav from "./FloatingGemaraNav";
import { useAppContext } from "@/contexts/AppContext";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { 
    activeTab, 
    setActiveTab, 
    setSelectedMasechet, 
    isPinned, 
    setIsPinned 
  } = useAppContext();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Navigate to home if on a detail page
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const handleMasechetSelect = (masechetHebrewName: string) => {
    setSelectedMasechet(masechetHebrewName);
    setActiveTab("gemara");
    if (location.pathname !== '/') {
      navigate('/');
    }
  };

  const handlePinToggle = () => {
    setIsPinned(!(isPinned ?? false));
  };

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleMobileClose = () => {
    setMobileMenuOpen(false);
  };

  // When sidebar is not pinned (autohide mode), main content takes full width
  // Default to autohide (unpinned) for cleaner UX
  const sidebarIsPinned = isPinned ?? false;

  return (
    <SidebarProvider defaultOpen={sidebarIsPinned}>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        {/* Main content - takes full width when sidebar is unpinned */}
        <div className={cn(
          "flex-1 flex flex-col min-h-screen overflow-x-hidden transition-all duration-300",
          sidebarIsPinned ? "md:mr-[--sidebar-width]" : "w-full"
        )}>
          <AppHeader 
            activeTab={activeTab} 
            onTabChange={handleTabChange}
            onMobileMenuToggle={handleMobileMenuToggle}
          />
          
          <main className="flex-1 overflow-x-hidden">
            {children}
          </main>
        </div>

        {/* Sidebar - fixed position when pinned, floating when unpinned */}
        <AppSidebar 
          activeTab={activeTab} 
          onTabChange={(tab) => {
            handleTabChange(tab);
            if (isMobile) handleMobileClose();
          }}
          onMasechetSelect={(masechet) => {
            handleMasechetSelect(masechet);
            if (isMobile) handleMobileClose();
          }}
          isPinned={sidebarIsPinned}
          onPinToggle={handlePinToggle}
          isMobileOpen={mobileMenuOpen}
          onMobileClose={handleMobileClose}
        />

        {/* Floating Navigation Button - appears on all pages */}
        <FloatingGemaraNav />
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;