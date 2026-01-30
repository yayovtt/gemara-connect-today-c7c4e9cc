import { lazy, Suspense } from "react";
import SedarimNavigator from "@/components/SedarimNavigator";
import { useAppContext } from "@/contexts/AppContext";
import { Loader2 } from "lucide-react";

// Lazy load heavy components for better initial load time
const PsakDinTab = lazy(() => import("@/components/PsakDinTab"));
const UploadPsakDinTab = lazy(() => import("@/components/UploadPsakDinTab"));
const SmartIndexTab = lazy(() => import("@/components/SmartIndexTab"));
const GemaraTab = lazy(() => import("@/components/GemaraTab"));
const DownloadPsakimTab = lazy(() => import("@/components/DownloadPsakimTab").then(m => ({ default: m.DownloadPsakimTab })));
const ImportExternalIndexTab = lazy(() => import("@/components/ImportExternalIndexTab"));
const GemaraPsakDinIndex = lazy(() => import("@/components/GemaraPsakDinIndex"));
const SmartSearchPage = lazy(() => import("@/components/SmartSearchPage"));
const SystemHealthCheck = lazy(() => import("@/components/SystemHealthCheck").then(m => ({ default: m.SystemHealthCheck })));
const CodeIntegrationTab = lazy(() => import("@/components/CodeIntegrationTab"));

// Loading component for suspense fallback
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-muted-foreground text-sm">טוען...</span>
    </div>
  </div>
);

const Index = () => {
  const { activeTab, selectedMasechet, setSelectedMasechet } = useAppContext();

  return (
    <div className="p-2 md:p-6 space-y-3 md:space-y-4 overflow-x-hidden max-w-full">
      {/* Sedarim Navigator - 6 frames at top (always visible in gemara tab) */}
      {activeTab === "gemara" && (
        <>
          <SedarimNavigator />
          {/* Show GemaraTab only when masechet is selected from sidebar */}
          {selectedMasechet && (
            <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
              <Suspense fallback={<LoadingFallback />}>
                <GemaraTab 
                  selectedMasechet={selectedMasechet} 
                  onMasechetChange={setSelectedMasechet} 
                />
              </Suspense>
            </div>
          )}
        </>
      )}

      {/* Gemara-Psak Index - Full page view */}
      {activeTab === "gemara-psak-index" && (
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
          <Suspense fallback={<LoadingFallback />}>
            <GemaraPsakDinIndex />
          </Suspense>
        </div>
      )}

      {/* Content cards - show for other tabs */}
      {activeTab !== "gemara" && activeTab !== "gemara-psak-index" && (
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
          <Suspense fallback={<LoadingFallback />}>
            {activeTab === "psak-din" && <PsakDinTab />}
            {activeTab === "smart-index" && <SmartIndexTab />}
            {activeTab === "search" && <SmartSearchPage />}
            {activeTab === "upload" && <UploadPsakDinTab />}
            {activeTab === "download-psakim" && <DownloadPsakimTab />}
            {activeTab === "import-index" && <ImportExternalIndexTab />}
            {activeTab === "system-health" && <SystemHealthCheck />}
            {activeTab === "code-integration" && <CodeIntegrationTab />}
          </Suspense>
        </div>
      )}
    </div>
  );
};

export default Index;
