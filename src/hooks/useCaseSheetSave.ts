import { useState, useRef, useCallback } from 'react';

const SAVE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number = SAVE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Save operation timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useCaseSheetSave(saveFn?: (fields: any) => Promise<any>) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const lastFieldsRef = useRef<any>(null);

  const saveToCaseSheet = useCallback(
    async (extractedFields: any) => {
      if (isSavingRef.current) return;
      isSavingRef.current = true;
      setSaveStatus('saving');
      setSaveError(null);

      // Store for retry
      lastFieldsRef.current = extractedFields;

      try {
        if (saveFn) {
          await withTimeout(saveFn(extractedFields), SAVE_TIMEOUT_MS);
        }
        setSaveStatus('saved');
        // Reset saved status after 3.5s back to idle
        setTimeout(() => {
          setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 3500);
      } catch (err: any) {
        console.error('[CaseSheetSave]', err);
        setSaveStatus('error');
        setSaveError(err.message || 'Unknown save error');
      } finally {
        isSavingRef.current = false;
      }
    },
    [saveFn]
  );

  const retrySave = useCallback(() => {
    if (lastFieldsRef.current) {
      saveToCaseSheet(lastFieldsRef.current);
    }
  }, [saveToCaseSheet]);

  return {
    saveToCaseSheet,
    retrySave,
    saveStatus,
    saveError,
  };
}
