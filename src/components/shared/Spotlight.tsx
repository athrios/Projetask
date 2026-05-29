import * as React from "react";
import { cn } from "@/lib/utils";
import { useSpotlight } from "@/hooks/useSpotlight";

interface SpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "card" | "list";
  as?: "div" | "li";
}

/**
 * Drop-in wrapper that adds a theme-aware spotlight hover effect.
 * Use `variant="card"` (default) for cards and panels, `variant="list"`
 * for tighter list rows.
 */
export const Spotlight = React.forwardRef<HTMLDivElement, SpotlightProps>(
  ({ className, variant = "card", as = "div", ...props }, ref) => {
    const spotlightRef = useSpotlight<HTMLDivElement>();
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        spotlightRef(node);
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref, spotlightRef],
    );
    const Comp = as as "div";
    return (
      <Comp
        ref={setRefs as never}
        className={cn(variant === "list" ? "spotlight-sm" : "spotlight", className)}
        {...props}
      />
    );
  },
);
Spotlight.displayName = "Spotlight";
