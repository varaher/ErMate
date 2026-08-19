// src/utils/crossOriginGuard.ts
// Global cross-origin frame error interceptor for container iframe boundaries

if (typeof window !== 'undefined') {
  const isCrossOriginFrameError = (err: unknown): boolean => {
    if (!err) return false;
    const str = String(
      (err as any)?.message ||
      (err as any)?.reason?.message ||
      (err as any)?.reason ||
      err ||
      ''
    ).toLowerCase();

    return (
      str.includes('$$typeof') ||
      str.includes('cross-origin frame') ||
      str.includes('failed to read a named property') ||
      str.includes('blocked a frame with origin') ||
      (str.includes('securityerror') && str.includes('frame')) ||
      str.includes('database is closing') ||
      str.includes('database is hidden')
    );
  };

  const originalOnError = window.onerror;
  window.onerror = function (msg, url, line, col, error) {
    if (isCrossOriginFrameError(msg) || isCrossOriginFrameError(error)) {
      return true; // Prevents the error from propagating as an uncaught exception
    }
    if (typeof originalOnError === 'function') {
      return originalOnError.apply(this, arguments as any);
    }
    return false;
  };

  window.addEventListener(
    'error',
    (e) => {
      if (isCrossOriginFrameError(e.message) || isCrossOriginFrameError(e.error)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (e) => {
      if (isCrossOriginFrameError(e.reason) || isCrossOriginFrameError(e.reason?.message)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
}
