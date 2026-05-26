import { useEffect, useState } from 'react';

export default function App() {
  const [pong, setPong] = useState<string>('...');

  useEffect(() => {
    window.api
      .ping()
      .then(setPong)
      .catch((err) => setPong(`error: ${String(err)}`));
  }, []);

  return (
    <div className="app">
      <h1>框译</h1>
      <p>
        Phase 0 scaffold is alive. IPC ping → <strong>{pong}</strong>
      </p>
      <p className="hint">
        Next: 阶段 1 will hide this window and put the app in the system tray.
      </p>
    </div>
  );
}
