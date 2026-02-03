import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GameProvider } from './hooks/useGameState';
import './styles/tokens.css';
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(GameProvider, { children: _jsx(App, {}) }) }));
