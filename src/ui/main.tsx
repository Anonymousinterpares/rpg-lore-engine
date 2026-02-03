import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GameProvider } from './hooks/useGameState';
import { INITIAL_GAME_STATE } from './initialGameState';
import './styles/tokens.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GameProvider initialGameState={INITIAL_GAME_STATE}>
            <App />
        </GameProvider>
    </React.StrictMode>
);
