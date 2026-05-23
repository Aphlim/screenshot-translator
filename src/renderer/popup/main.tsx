import React from 'react';
import { createRoot } from 'react-dom/client';
import PopupApp from './PopupApp';
import './popup.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
);
