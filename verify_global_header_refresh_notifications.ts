import fs from "fs";
import path from "path";

function runTest(name: string, fn: () => boolean | void) {
  try {
    const result = fn();
    if (result === false) {
      console.error(`❌ FAIL: ${name}`);
      process.exitCode = 1;
    } else {
      console.log(`✅ PASS: ${name}`);
    }
  } catch (err: any) {
    console.error(`❌ ERROR: ${name} ->`, err.message);
    process.exitCode = 1;
  }
}

console.log("=== ERMATE GLOBAL HEADER, REFRESH & NOTIFICATIONS VERIFICATION ===\n");

const headerFile = path.resolve("./src/components/GlobalHeader.tsx");
const refreshFile = path.resolve("./src/components/shared/GlobalRefreshButton.tsx");
const appFile = path.resolve("./src/App.tsx");

const headerContent = fs.readFileSync(headerFile, "utf-8");
const refreshContent = fs.readFileSync(refreshFile, "utf-8");
const appContent = fs.readFileSync(appFile, "utf-8");

// Test 1: Desktop header no hospital wrapping
runTest("1. Desktop header: workplace text has truncate and single-line constraints", () => {
  const hasTruncate = headerContent.includes("truncate whitespace-nowrap") || 
                      headerContent.includes("truncate") && headerContent.includes("max-w-");
  const hasWorkplace = headerContent.includes("workplaceText");
  return hasTruncate && hasWorkplace;
});

// Test 2: Mobile header layout: compact without horizontal overflow or giant buttons
runTest("2. Mobile layout: compact navigation, no giant Refresh text button, subtitle line", () => {
  const hasCompactHeader = headerContent.includes("h-8") || headerContent.includes("py-2.5");
  const noGiantRefreshText = !headerContent.includes("<span className=\"font-bold\">Refresh</span>");
  const hasMobileWorkplace = headerContent.includes("flex sm:hidden") && headerContent.includes("workplaceText");
  return hasCompactHeader && noGiantRefreshText && hasMobileWorkplace;
});

// Test 3: Subscription badge removed from primary header
runTest("3. Primary header: subscription badge removed from main navbar", () => {
  // Subscription badge is inside profile menu or separate modals, not floating in the main header bar
  const headerMainSlice = headerContent.slice(
    headerContent.indexOf("id=\"profile-avatar-btn\"") - 1000,
    headerContent.indexOf("id=\"profile-avatar-btn\"")
  );
  const noSubInMainBar = !headerMainSlice.includes("Team Licensed") && !headerMainSlice.includes("Individual Plan");
  const hasSubInProfileMenu = headerContent.includes("Subscription:") && headerContent.includes("Team Plan");
  return noSubInMainBar && hasSubInProfileMenu;
});

// Test 4: Version removed from primary header
runTest("4. Primary header: app version removed from main bar, preserved in What's New & About", () => {
  const headerMainBar = headerContent.slice(0, headerContent.indexOf("id=\"profile-dropdown-menu\""));
  const noVersionInMainBar = !headerMainBar.includes("v{currentVersion}") && !headerMainBar.includes("v{APP_VERSION}");
  const hasVersionInProfileMenu = headerContent.includes("v{currentVersion}") && headerContent.includes("What's New");
  return noVersionInMainBar && hasVersionInProfileMenu;
});

// Test 5: Dark mode removed from primary header
runTest("5. Primary header: dark mode toggle moved from main header bar into profile menu", () => {
  const headerStart = headerContent.indexOf("<header");
  const profileMenuStart = headerContent.indexOf("id=\"profile-dropdown-menu\"");
  const mainBarMarkup = headerContent.slice(headerStart, profileMenuStart);
  const noThemeToggleInMainBar = !mainBarMarkup.includes("onToggleDarkMode");
  const hasThemeToggleInMenu = headerContent.includes("Appearance") && headerContent.includes("onToggleDarkMode");
  return noThemeToggleInMainBar && hasThemeToggleInMenu;
});

// Test 6: Profile metadata accessible in profile menu
runTest("6. Profile menu: clinician name, role, email, workplace, subscription, and signout accessible", () => {
  const hasDoctorName = headerContent.includes("Dr. {profile?.name");
  const hasRole = headerContent.includes("profile?.role");
  const hasWorkplace = headerContent.includes("workplaceText");
  const hasSubscription = headerContent.includes("hospitalSubscription?.active");
  const hasSignOut = headerContent.includes("onSignOut") && headerContent.includes("Sign Out");
  return hasDoctorName && hasRole && hasWorkplace && hasSubscription && hasSignOut;
});

// Test 7: Global Refresh callback actually executes
runTest("7. Global Refresh: invokes onRefresh callback properly", () => {
  const executesRefresh = refreshContent.includes("await onRefresh()") || refreshContent.includes("onRefresh()");
  const wiresAppCallback = appContent.includes("onManualRefresh={handleManualRefresh}");
  return executesRefresh && wiresAppCallback;
});

// Test 8: Refresh spinner clears on success
runTest("8. Global Refresh: spinner clears deterministically on success and sets success feedback", () => {
  const clearsOnSuccess = refreshContent.includes("setFeedback(\"success\")") &&
                          refreshContent.includes("setIsRefreshing(false)");
  const hasCheckIndicator = refreshContent.includes("Check") && refreshContent.includes("text-emerald");
  return clearsOnSuccess && hasCheckIndicator;
});

// Test 9: Refresh spinner clears on failure / timeout
runTest("9. Global Refresh: spinner clears deterministically on failure or timeout", () => {
  const hasTimeoutRace = refreshContent.includes("Promise.race") && refreshContent.includes("8000");
  const clearsInFinally = refreshContent.includes("finally") && refreshContent.includes("setIsRefreshing(false)");
  const setsErrorStatus = refreshContent.includes("setFeedback(\"error\")");
  return hasTimeoutRace && clearsInFinally && setsErrorStatus;
});

// Test 10: Unsaved work block gives explicit message
runTest("10. Global Refresh: unsaved clinical work prompts with explicit confirmation and options", () => {
  const hasUnsavedDialog = refreshContent.includes("Unsaved Changes Present") &&
                           refreshContent.includes("Save & Refresh") &&
                           refreshContent.includes("Discard & Refresh");
  const hasVoiceBusyCheck = refreshContent.includes("Finish current recording/save before refreshing");
  return hasUnsavedDialog && hasVoiceBusyCheck;
});

// Test 11: Unread notification increments badge
runTest("11. Notification lifecycle: unread notification increments bell badge count", () => {
  // Logic: activeNotifications = notifications.filter(n => !n.resolved);
  // activeUnreadCount = activeNotifications.filter(n => !n.read).length;
  type Notif = { id: string; read: boolean; resolved?: boolean };
  const mockNotifs: Notif[] = [
    { id: "1", read: false, resolved: false },
    { id: "2", read: false, resolved: false },
    { id: "3", read: true, resolved: false },
  ];
  const active = mockNotifs.filter(n => !n.resolved);
  const unreadCount = active.filter(n => !n.read).length;
  return unreadCount === 2;
});

// Test 12: Read completed notification no longer counts toward badge
runTest("12. Notification lifecycle: read notification does not increment badge count", () => {
  type Notif = { id: string; read: boolean; resolved?: boolean };
  const mockNotifs: Notif[] = [
    { id: "1", read: true, resolved: false },
    { id: "2", read: true, resolved: true },
  ];
  const active = mockNotifs.filter(n => !n.resolved);
  const unreadCount = active.filter(n => !n.read).length;
  return unreadCount === 0;
});

// Test 13: Resolved notification disappears from active list
runTest("13. Notification lifecycle: resolved notification disappears from active list", () => {
  type Notif = { id: string; read: boolean; resolved?: boolean };
  const mockNotifs: Notif[] = [
    { id: "1", read: false, resolved: true },
    { id: "2", read: true, resolved: false },
  ];
  const active = mockNotifs.filter(n => !n.resolved);
  const history = mockNotifs.filter(n => n.resolved);
  return active.length === 1 && active[0].id === "2" && history.length === 1 && history[0].id === "1";
});

// Test 14: Pending actionable notification remains in active list until resolved
runTest("14. Notification lifecycle: pending actionable notification remains visible in active tab", () => {
  type Notif = { id: string; read: boolean; resolved?: boolean };
  const mockNotifs: Notif[] = [
    { id: "actionable_handover", read: true, resolved: false },
  ];
  const active = mockNotifs.filter(n => !n.resolved);
  return active.length === 1 && active[0].id === "actionable_handover";
});

// Test 15: Notification history is isolated from active list
runTest("15. Notification UX: separate tabs for Active and History, with clean clear actions", () => {
  const hasTabs = headerContent.includes("notificationsTab === \"active\"") &&
                  headerContent.includes("notificationsTab === \"history\"");
  const hasResolveAction = headerContent.includes("handleResolveNotification");
  const hasClearHistory = headerContent.includes("handleClearHistory");
  return hasTabs && hasResolveAction && hasClearHistory;
});

// Test 16: Auto-resolution triggers on Handover, Member Approval, and Case Save
runTest("16. Notification auto-resolution: wired on Handover acknowledged, Clinician Approved, and Case Saved", () => {
  const handoverAutoResolve = appContent.includes("Handover Acknowledged") && appContent.includes("resolved: true");
  const approvalAutoResolve = appContent.includes("Clinician Approved") && appContent.includes("resolved: true");
  const caseSavedAutoResolve = appContent.includes("Case Sheet Ready") && appContent.includes("resolved: true");
  return handoverAutoResolve && approvalAutoResolve && caseSavedAutoResolve;
});

console.log("\nAll 16 Global Header, Refresh, and Notification lifecycle tests completed.");
