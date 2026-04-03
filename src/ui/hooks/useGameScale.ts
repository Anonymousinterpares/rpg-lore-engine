import { useEffect, useRef, useState } from 'react';

export const DESIGN_W = 1920;
export const DESIGN_H = 1080;
const MIN_SCALE = 0.5;

export function useGameScale() {
    const ref = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        const calc = () => {
            if (!ref.current) return;
            const w = ref.current.clientWidth;
            const h = ref.current.clientHeight;
            setScale(Math.max(MIN_SCALE, Math.min(w / DESIGN_W, h / DESIGN_H)));
        };
        calc();
        const obs = new ResizeObserver(calc);
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    return { scale, ref };
}
