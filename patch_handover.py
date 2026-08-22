import re

with open("src/components/HandoverView.tsx", "r") as f:
    content = f.read()

# 1. Replace the mount useEffect (lines ~1028-1053)
# We find: "// Restore saved handover state on mount\n  useEffect(() => {"
# Until "}, []);"
# And we replace it with the new onSnapshot logic.

pattern_use_effect = r"// Restore saved handover state on mount\s*useEffect\(\(\) => \{.*?\n  \}, \[\]\);"

new_use_effect = """// Restore saved handover state on mount
  useEffect(() => {
    const activeDocRef = doc(db, "handover_sheets", "active_shift");
    let hasReceivedFirstSnapshot = false;

    const unsubscribe = onSnapshot(
      activeDocRef,
      (snapshot) => {
        hasReceivedFirstSnapshot = true;
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data) {
            // Support legacy array format for seamless migration
            if (Array.isArray(data.rows)) {
              setEditableRows(data.rows);
              localStorage.setItem("ermate_refined_handover_rows_v2", JSON.stringify(data.rows));
            } else if (data.rows && Array.isArray(data.rowOrder)) {
              const orderedRows = data.rowOrder
                .map((id: string) => data.rows[id])
                .filter(Boolean);
              setEditableRows(orderedRows);
              localStorage.setItem("ermate_refined_handover_rows_v2", JSON.stringify(orderedRows));
            }
            if (data.meta) {
              setHandoverMeta(prev => ({ ...prev, ...data.meta }));
              localStorage.setItem("ermate_refined_handover_meta_v2", JSON.stringify(data.meta));
            }
          }
        }
      },
      (error) => {
        console.warn("[HandoverView] onSnapshot failed, falling back to localStorage cache:", error);
        try {
          const savedStr = localStorage.getItem("ermate_refined_handover_rows_v2");
          const savedMetaStr = localStorage.getItem("ermate_refined_handover_meta_v2");
          if (savedStr) {
            const parsed = JSON.parse(savedStr);
            if (Array.isArray(parsed) && parsed.length > 0) setEditableRows(parsed);
          }
          if (savedMetaStr) {
            const parsedMeta = JSON.parse(savedMetaStr);
            if (parsedMeta && typeof parsedMeta === "object") setHandoverMeta(prev => ({ ...prev, ...parsedMeta }));
          }
        } catch (e) {
          console.warn("[HandoverView] localStorage fallback parse error:", e);
        }
      }
    );

    return () => unsubscribe();
  }, []);"""

content = re.sub(pattern_use_effect, new_use_effect, content, flags=re.DOTALL)

# 2. Modify saveRefinedHandoverSheet for full replacement (e.g. initial loads, AI refine)
# We change it to write the map and order.
pattern_save = r"const saveRefinedHandoverSheet = useCallback\(\(rows: HandoverTableRow\[\], meta: typeof handoverMeta\) => \{.*?\n  \}, \[profile\?\.name, hospitalName\]\);"

new_save = """const saveRefinedHandoverSheet = useCallback((rows: HandoverTableRow[], meta: typeof handoverMeta) => {
    if (!rows || rows.length === 0) return;
    setAutoSaveStatus("saving");
    try {
      localStorage.setItem("ermate_refined_handover_rows_v2", JSON.stringify(rows));
      localStorage.setItem("ermate_refined_handover_meta_v2", JSON.stringify(meta));
    } catch (err) {
      console.warn("Failed to write handover to localStorage:", err);
    }

    const activeDocRef = doc(db, "handover_sheets", "active_shift");
    
    const rowsMap: Record<string, any> = {};
    const rowOrder: string[] = [];
    rows.forEach(r => {
      rowsMap[r.id] = r;
      rowOrder.push(r.id);
    });

    setDoc(activeDocRef, {
      rows: rowsMap,
      rowOrder,
      meta,
      hospitalName,
      updatedAt: new Date().toISOString(),
      updatedBy: profile?.name || "Doctor"
    }, { merge: true }).then(() => {
      setAutoSaveStatus("saved");
    }).catch(err => {
      console.warn("Firestore handover sheet save warning:", err);
      setAutoSaveStatus("saved");
    });
  }, [profile?.name, hospitalName]);"""

content = re.sub(pattern_save, new_save, content, flags=re.DOTALL)


# 3. Replace handleUpdateCell
pattern_handle_update = r"const handleUpdateCell = \(id: string, field: keyof HandoverTableRow, value: string\) => \{.*?  \};"

new_handle_update = """const handleUpdateCell = (id: string, field: keyof HandoverTableRow, value: string) => {
    setEditableRows(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));

    const activeDocRef = doc(db, "handover_sheets", "active_shift");
    updateDoc(activeDocRef, {
      [`rows.${id}.${field}`]: value,
      updatedAt: new Date().toISOString(),
      updatedBy: profile?.name || "Doctor"
    }).catch((e) => {
      console.warn("[HandoverView] Row update failed:", e);
    });
  };"""

content = re.sub(pattern_handle_update, new_handle_update, content, flags=re.DOTALL)


with open("src/components/HandoverView.tsx", "w") as f:
    f.write(content)

