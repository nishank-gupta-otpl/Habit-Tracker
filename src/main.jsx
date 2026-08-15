import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { applyTheme } from './lib/themes';

// Paint the last-used theme before React mounts so there's no colour flash on
// launch — the real value arrives from Firestore a moment later.
applyTheme(localStorage.getItem('momentum.theme') || 'nebula');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
