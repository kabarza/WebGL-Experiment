// ============================================================
// Right panel shell — hosts the DialKit panel, which carries *all*
// controls including the frame's geometry.
// ============================================================

import type { ReactNode } from 'react';

interface SidebarProps {
  hasFrame: boolean;
  frameCount: number;
  children: ReactNode;
}

export function Sidebar({ hasFrame, frameCount, children }: SidebarProps) {
  return (
    <aside className="bt-sidebar bt-ui">
      {!hasFrame && (
        <div className="bt-side-hint">
          {frameCount === 0 ? 'No frames yet — press F or pick a size from the frame tool.' : 'Select a frame to edit it.'}
        </div>
      )}
      <div className="bt-side-panel">{children}</div>
    </aside>
  );
}
