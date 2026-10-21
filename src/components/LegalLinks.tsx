import React from "react";
import { LEGAL_LINKS } from "../lib/legal";

/** Small row of public policy links (also required for payment-gateway and store review). */
export default function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav aria-label="Legal" data-testid="legal-links" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] ${className}`}>
      {LEGAL_LINKS.map(l => (
        <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700 dark:text-emerald-400">{l.label}</a>
      ))}
    </nav>
  );
}
