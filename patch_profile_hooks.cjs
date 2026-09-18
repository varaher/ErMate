const fs = require('fs');

let content = fs.readFileSync('src/components/ProfileSettingsView.tsx', 'utf8');

const newCode = `  const [logbookEntries, setLogbookEntries] = useState<LogbookEntry[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "users", auth.currentUser.uid, "logbook"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries: LogbookEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push(doc.data() as LogbookEntry);
      });
      // Sort by updatedAt descending
      entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setLogbookEntries(entries);
    });
    return () => unsubscribe();
  }, []);

  const [workplaceName`;

content = content.replace('  const [workplaceName', newCode);
fs.writeFileSync('src/components/ProfileSettingsView.tsx', content);
