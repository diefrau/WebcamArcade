import type { ReactNode } from "react";

/** Preserve the route's entrance animations without a loading gate. */
export function RouteContent({ children }: { children: ReactNode }) {
  return (
    <div className="route-content" data-ready="true" data-state="ready">
      {children}
    </div>
  );
}
