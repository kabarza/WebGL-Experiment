// ============================================================
// Main — React entry point
// ============================================================

import './styles/reset.css';
import 'dialkit/styles.css';
import './styles/global.css';
import './gallery/gallery.css';
import './styles/components.css';
import './styles/article.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
