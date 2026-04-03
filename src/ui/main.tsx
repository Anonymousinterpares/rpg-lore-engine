import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GameProvider } from './hooks/useGameState';
import './styles/tokens.css';

// Inject custom cursor overrides with maximum specificity
const cursorStyle = document.createElement('style');
cursorStyle.textContent = `
    html, body, * { cursor: url('/assets/icons/NORMAL.cur'), default !important; }
    a, button, [role="button"], select, option, label,
    input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], input[type="range"],
    summary, [tabindex]:not([tabindex="-1"]),
    [style*="cursor: pointer"], [style*="cursor:pointer"] {
        cursor: url('/assets/icons/LINK-SELECT.cur'), pointer !important;
    }
`;
document.head.appendChild(cursorStyle);

// Also override any future inline cursor:pointer via MutationObserver
const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'style') {
            const el = m.target as HTMLElement;
            if (el.style.cursor === 'pointer') {
                el.style.cursor = "url('/assets/icons/LINK-SELECT.cur'), pointer";
            }
        }
    }
});
observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] });

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GameProvider>
            <App />
        </GameProvider>
    </React.StrictMode>
);
