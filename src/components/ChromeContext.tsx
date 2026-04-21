// ============================================================
// ChromeContext — Shared state bridge between persistent dock
// and the view components (ExperimentView, FlowFieldArticle)
// ============================================================

import { createContext, useContext, useState, useRef, type ReactNode, type MutableRefObject } from 'react';

export interface TocSection {
  id: string;
  label: string;
}

interface ChromeContextValue {
  /** Article TOC — reactive (triggers dock re-render when section changes) */
  activeSection: string;
  setActiveSection: (id: string) => void;

  /** TOC sections — reactive (articles register their sections on mount) */
  tocSections: TocSection[];
  setTocSections: (sections: TocSection[]) => void;

  /** Article scroll-to — imperative callback (no re-render needed) */
  scrollToSectionRef: MutableRefObject<((id: string) => void) | null>;

  /** Experiment share data — imperative (read at click time) */
  shareDataRef: MutableRefObject<{ slug: string; params: Record<string, unknown> } | null>;

  /** Vision debug overlay — toggled from dock, read by VisionView */
  visionDebugVisible: boolean;
  setVisionDebugVisible: (v: boolean) => void;

  /** Vision HUD pill — ChromeDock renders it, VisionView writes values into it. */
  visionHudRef: MutableRefObject<HTMLElement | null>;
}

const ChromeContext = createContext<ChromeContextValue | null>(null);

export function ChromeProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState('overview');
  const [tocSections, setTocSections] = useState<TocSection[]>([]);
  const [visionDebugVisible, setVisionDebugVisible] = useState(true);
  const scrollToSectionRef = useRef<((id: string) => void) | null>(null);
  const shareDataRef = useRef<{ slug: string; params: Record<string, unknown> } | null>(null);
  const visionHudRef = useRef<HTMLElement | null>(null);

  return (
    <ChromeContext.Provider value={{ activeSection, setActiveSection, tocSections, setTocSections, scrollToSectionRef, shareDataRef, visionDebugVisible, setVisionDebugVisible, visionHudRef }}>
      {children}
    </ChromeContext.Provider>
  );
}

export function useChrome() {
  const ctx = useContext(ChromeContext);
  if (!ctx) throw new Error('useChrome must be used within ChromeProvider');
  return ctx;
}
