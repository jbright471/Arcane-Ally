import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

const App = lazy(() => import('./App.tsx'));
const PlayerPreview = lazy(() => import('./pages/PlayerPreview.tsx'));

// Add fonts to document head
const link1 = document.createElement('link');
link1.rel = 'preconnect';
link1.href = 'https://fonts.googleapis.com';
document.head.appendChild(link1);

const link2 = document.createElement('link');
link2.rel = 'preconnect';
link2.href = 'https://fonts.gstatic.com';
link2.crossOrigin = 'anonymous';
document.head.appendChild(link2);

const link3 = document.createElement('link');
link3.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap';
link3.rel = 'stylesheet';
document.head.appendChild(link3);

const isPlayerPreview = window.location.pathname === '/player-preview';
createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<div className="min-h-screen bg-background" />}>
    {isPlayerPreview ? <PlayerPreview /> : <App />}
  </Suspense>,
);

// Register Service Worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('[SW] Registered:', reg.scope))
      .catch(err => console.warn('[SW] Registration failed:', err));
  });
}
