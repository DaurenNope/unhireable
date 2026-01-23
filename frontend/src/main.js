import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
console.log('main.tsx: Starting app initialization...');
const rootElement = document.getElementById('root');
if (!rootElement) {
    console.error('main.tsx: Root element not found!');
    document.body.innerHTML = '<div style="padding: 20px; font-family: monospace; color: red;"><h1>Error: Root element not found</h1><p>Please check index.html for a div with id="root"</p></div>';
}
else {
    console.log('main.tsx: Root element found, creating React root...');
    try {
        const root = createRoot(rootElement);
        console.log('main.tsx: Rendering App component...');
        root.render(_jsx(StrictMode, { children: _jsx(App, {}) }));
        console.log('main.tsx: App component rendered successfully');
    }
    catch (error) {
        console.error('main.tsx: Error rendering app:', error);
        rootElement.innerHTML = `
      <div style="padding: 20px; font-family: monospace; color: red;">
        <h1>Error Loading App</h1>
        <pre style="background: #f0f0f0; padding: 10px; border-radius: 4px; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
      </div>
    `;
    }
}
