import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GameProvider } from './hooks/useGameState';
import { INITIAL_GAME_STATE } from './initialGameState';
import './styles/tokens.css';
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(GameProvider, { initialGameState: INITIAL_GAME_STATE, children: _jsx(App, {}) }) }));
