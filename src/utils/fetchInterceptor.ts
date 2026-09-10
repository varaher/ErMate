const originalFetch = window.fetch;

try {
  Object.defineProperty(window, 'fetch', {
    configurable: true,
    writable: true,
    value: async function (...args: any[]) {
      const response = await originalFetch.apply(window, args as any);
      
      const url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof Request ? args[0].url : '');
      
      if (response.status === 200 && url.includes('/api/')) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          const clonedResponse = response.clone();
          const text = await clonedResponse.text().catch(() => "");
          
          if (text.includes("<title>Cookie check</title>") || text.includes("Cookie check")) {
            console.warn("[fetchInterceptor] Intercepted Cookie check page. Reloading window to refresh session...");
            window.location.reload();
            return new Promise(() => {});
          }
        }
      }
      
      return response;
    }
  });
} catch (e) {
  console.warn("[fetchInterceptor] Failed to intercept fetch:", e);
}
