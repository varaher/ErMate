import React from "react";
import ErGuideView from "./ErGuideView";

interface ToolsViewProps {
  onNavigateToTab: (tabId: string) => void;
  isDarkMode?: boolean;
}

// The old Clinical Tools hub is retired: everything lives in the ER Guide.
// The "tools" route is kept so the Tools nav tab and MATE commands still work.
export default function ToolsView({ onNavigateToTab, isDarkMode = false }: ToolsViewProps) {
  return <ErGuideView onBack={() => onNavigateToTab("dashboard")} isDarkMode={isDarkMode} />;
}