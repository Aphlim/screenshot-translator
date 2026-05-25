import React from 'react';
import { createRoot } from 'react-dom/client';
import SettingsApp from './SettingsApp';
import './settings.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>,
);
