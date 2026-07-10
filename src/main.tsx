import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { getRouter } from './router';
import './styles.css';

// ─── CLEAR STALE OFFLINE CACHE ON STARTUP ──────────────────────────────────
// Removes all cached margalla_ localStorage keys to prevent stale data from
// causing crashes after a clean database reset.
(function clearStaleCache() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('margalla_offline_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (keysToRemove.length > 0) {
      console.log(`[STARTUP] Cleared ${keysToRemove.length} stale offline cache keys`);
    }
  } catch (e) {
    // Ignore localStorage errors
  }
})();
// ───────────────────────────────────────────────────────────────────────────

const router = getRouter();

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}
