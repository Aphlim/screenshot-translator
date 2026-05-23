import React from 'react';
import { createRoot } from 'react-dom/client';
import SelectorApp from './SelectorApp';
import './selector.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <SelectorApp />
  </React.StrictMode>,
);
