import React from 'react';
import ReactDOM from 'react-dom/client';
import PaperdollScreen from './components/paperdoll/PaperdollScreen';
import './styles/tokens.css';

ReactDOM.createRoot(document.getElementById('paperdoll-root')!).render(
    <React.StrictMode>
        <PaperdollScreen />
    </React.StrictMode>
);
