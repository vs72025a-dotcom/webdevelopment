import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/app.css';

const host = document.getElementById('root');
if (!host) throw new Error('#root is missing from index.html');

createRoot(host).render(<App />);

/*
 * Install the service worker so the app can be added to the home screen and
 * opened offline. Production only: during development it would cache module
 * URLs and make hot reload lie about what is on disk.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.info('[aurora] service worker not registered:', err?.message ?? err);
    });
  });
}
