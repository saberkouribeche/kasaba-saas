import { useLayoutEffect, useEffect } from 'react';

// Safe for SSR
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useLockBodyScroll(isLocked = true) {
    useIsomorphicLayoutEffect(() => {
        if (!isLocked) return;

        // Save current scroll position
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        // Get original styles
        const body = document.body;
        const html = document.documentElement;
        const originalBodyOverflow = body.style.overflow;
        const originalBodyPosition = body.style.position;
        const originalBodyTop = body.style.top;
        const originalBodyLeft = body.style.left;
        const originalBodyWidth = body.style.width;
        const originalHtmlOverflow = html.style.overflow;

        // Apply robust scroll lock
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.left = `-${scrollX}px`;
        body.style.width = '100%';
        html.style.overflow = 'hidden';

        return () => {
            // Restore original styles
            body.style.overflow = originalBodyOverflow;
            body.style.position = originalBodyPosition;
            body.style.top = originalBodyTop;
            body.style.left = originalBodyLeft;
            body.style.width = originalBodyWidth;
            html.style.overflow = originalHtmlOverflow;

            // Restore scroll position
            window.scrollTo(scrollX, scrollY);
        };
    }, [isLocked]);
}
