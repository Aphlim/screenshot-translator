import React from 'react';
import { createRoot } from 'react-dom/client';
import HistoryApp from './HistoryApp';
import './history.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <HistoryApp />
  </React.StrictMode>,
);
