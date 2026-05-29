import { useCallback, useEffect, useRef } from "react";

/**
 * Tracks mouse position inside an element and writes it to CSS custom
 * properties --spotlight-x / --spotlight-y. Pair with the `.spotlight`
 * or `.spotlight-sm` utility class defined in index.css.
 */
export function useSpotlight<T extends HTMLElement = HTMLElement>() {
  const elRef = useRef<T | null>(null);
  const rafRef = useRef<number | null>(null);

  const setRef = useCallback((node: T | null) => {
    // Cleanup old listener
    const prev = elRef.current;
    if (prev) {
      const handler = (prev as unknown as { __spotlightHandler?: (e: MouseEvent) => void })
        .__spotlightHandler;
      if (handler) prev.removeEventListener("mousemove", handler);
    }
    elRef.current = node;
    if (!node) return;

    const handler = (e: MouseEvent) => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const rect = node.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        node.style.setProperty("--spotlight-x", `${x}px`);
        node.style.setProperty("--spotlight-y", `${y}px`);
      });
    };
    (node as unknown as { __spotlightHandler?: (e: MouseEvent) => void }).__spotlightHandler =
      handler;
    node.addEventListener("mousemove", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return setRef;
}
