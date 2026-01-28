import PsakDinTab from "@/components/PsakDinTab";
import UploadPsakDinTab from "@/components/UploadPsakDinTab";
import SmartIndexTab from "@/components/SmartIndexTab";
import SedarimNavigator from "@/components/SedarimNavigator";
import GemaraTab from "@/components/GemaraTab";
import { DownloadPsakimTab } from "@/components/DownloadPsakimTab";
import ImportExternalIndexTab from "@/components/ImportExternalIndexTab";
import GemaraPsakDinIndex from "@/components/GemaraPsakDinIndex";
import SmartSearchPage from "@/components/SmartSearchPage";
import { SystemHealthCheck } from "@/components/SystemHealthCheck";
import CodeIntegrationTab from "@/components/CodeIntegrationTab";
import { useAppContext } from "@/contexts/AppContext";

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
              <GemaraTab 
                selectedMasechet={selectedMasechet} 
                onMasechetChange={setSelectedMasechet} 
              />
            </div>
          )}
        </>
      )}

      {/* Gemara-Psak Index - Full page view */}
      {activeTab === "gemara-psak-index" && (
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
          <GemaraPsakDinIndex />
        </div>
      )}

      {/* Content cards - show for other tabs */}
      {activeTab !== "gemara" && activeTab !== "gemara-psak-index" && (
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 overflow-hidden">
          {activeTab === "psak-din" && <PsakDinTab />}
          {activeTab === "smart-index" && <SmartIndexTab />}
          {activeTab === "search" && <SmartSearchPage />}
          {activeTab === "upload" && <UploadPsakDinTab />}
          {activeTab === "download-psakim" && <DownloadPsakimTab />}
          {activeTab === "import-index" && <ImportExternalIndexTab />}
          {activeTab === "system-health" && <SystemHealthCheck />}
          {activeTab === "code-integration" && <CodeIntegrationTab />}
        </div>
      )}
    </div>
  );
};

export default Index;
