import React, { createContext, useContext, useRef } from 'react';
import { DESIGN_W, DESIGN_H } from '../hooks/useGameScale';

interface ScaleContextValue {
    scale: number;
    DESIGN_W: number;
    DESIGN_H: number;
    portalContainer: HTMLDivElement | null;
}

const ScaleContext = createContext<ScaleContextValue>({
    scale: 1,
    DESIGN_W,
    DESIGN_H,
    portalContainer: null,
});

export const ScaleProvider: React.FC<{
    scale: number;
    portalContainer: HTMLDivElement | null;
    children: React.ReactNode;
}> = ({ scale, portalContainer, children }) => (
    <ScaleContext.Provider value={{ scale, DESIGN_W, DESIGN_H, portalContainer }}>
        {children}
    </ScaleContext.Provider>
);

export function useScaleFactor() {
    return useContext(ScaleContext);
}
