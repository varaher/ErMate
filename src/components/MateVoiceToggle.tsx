import React, { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isMateVoiceSupported, isMateVoiceEnabled, setMateVoiceEnabled } from "../mate/mateSpeech";

/**
 * Speaker button for MATE's spoken replies. OFF by default; remembered on this device.
 * Hidden when the browser has no speech engine. Only the doctor can switch it on.
 */
export function MateVoiceToggle() {
  const [on, setOn] = useState<boolean>(() => isMateVoiceEnabled());
  if (!isMateVoiceSupported()) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setMateVoiceEnabled(next);
        setOn(next);
      }}
      aria-pressed={on}
      aria-label={on ? "Turn MATE voice off" : "Turn MATE voice on"}
      title={on ? "MATE voice is on. Tap to turn off." : "MATE voice is off. Tap to turn on."}
      className={`min-w-[34px] min-h-[34px] w-[34px] h-[34px] rounded-[10px] border-[1.5px] border-violet-600 flex items-center justify-center transition-colors ${
        on
          ? "bg-violet-600 text-white"
          : "bg-transparent text-violet-600 dark:text-violet-400 dark:border-violet-400"
      }`}
    >
      {on ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}

export default MateVoiceToggle;