const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const oldState = `
  // Shift & Team states
  const [isOnShift, setIsOnShift] = useState<boolean>(false);
  const [showShiftCheckIn, setShowShiftCheckIn] = useState<boolean>(true);
`;

const newState = `
  // Shift & Team states
  const [isOnShift, setIsOnShift] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ermate_isOnShift');
      const savedDate = localStorage.getItem('ermate_shiftDate');
      if (saved === 'true' && savedDate === new Date().toDateString()) {
        return true;
      }
    } catch(e) {}
    return false;
  });
  const [showShiftCheckIn, setShowShiftCheckIn] = useState<boolean>(() => {
    try {
      const savedDismissed = localStorage.getItem('ermate_shiftDismissed');
      const savedDate = localStorage.getItem('ermate_shiftDate');
      if (savedDismissed === 'true' && savedDate === new Date().toDateString()) {
        return false; // already dismissed today
      }
    } catch(e) {}
    return true; // show by default
  });

  useEffect(() => {
    try {
      localStorage.setItem('ermate_isOnShift', isOnShift ? 'true' : 'false');
      localStorage.setItem('ermate_shiftDate', new Date().toDateString());
    } catch(e) {}
  }, [isOnShift]);

  useEffect(() => {
    try {
      if (!showShiftCheckIn) {
        localStorage.setItem('ermate_shiftDismissed', 'true');
        localStorage.setItem('ermate_shiftDate', new Date().toDateString());
      }
    } catch(e) {}
  }, [showShiftCheckIn]);
`;

content = content.replace(oldState.trim(), newState.trim());
fs.writeFileSync('src/App.tsx', content);
