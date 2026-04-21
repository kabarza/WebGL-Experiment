// ============================================================
// ChromeDock — Persistent floating toolbar shared across views
// Stays mounted across route transitions; buttons swap per route.
// ============================================================

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useChrome } from './ChromeContext.tsx';
import { FpsCounter } from './FpsCounter.tsx';
import { buildShareUrl } from '../lib/sharing.ts';
import { findExperiment } from '../experiments/registry.ts';
import { findVisionExperiment } from '../vision/registry.ts';

interface Route {
  type: 'gallery' | 'experiment' | 'article' | 'tuner' | 'vision';
  slug?: string;
}

interface ChromeDockProps {
  route: Route;
  onBack: () => void;
  onNavigateExperiment: (slug: string) => void;
  onNavigateArticle: (slug: string) => void;
  overlayVisible: boolean;
  setExportOpen: (open: boolean) => void;
}

export function ChromeDock({
  route,
  onBack,
  onNavigateExperiment,
  onNavigateArticle,
  overlayVisible,
  setExportOpen,
}: ChromeDockProps) {
  const {
    activeSection,
    tocSections,
    scrollToSectionRef,
    shareDataRef,
    visionDebugVisible,
    setVisionDebugVisible,
    visionHudRef,
  } = useChrome();
  const [copied, setCopied] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);

  const slug = route.slug ?? '';
  const isExperiment = route.type === 'experiment';
  const isArticle = route.type === 'article';
  const isVision = route.type === 'vision';
  const experiment = slug ? findExperiment(slug) : undefined;
  const visionExperiment = slug ? findVisionExperiment(slug) : undefined;
  const currentMeta = experiment?.meta ?? visionExperiment?.meta;
  const hasArticle = currentMeta?.hasArticle === true;

  // Reset transient states on route change
  useEffect(() => {
    setCopied(false);
    setTocOpen(false);
  }, [route.type, route.slug]);

  // Copy shareable URL
  const handleShare = useCallback(async () => {
    const data = shareDataRef.current;
    const url =
      isExperiment && data
        ? buildShareUrl(data.slug, data.params)
        : window.location.href;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this URL:', url);
    }
  }, [isExperiment, shareDataRef]);

  // Close TOC dropdown on outside click
  useEffect(() => {
    if (!tocOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.chrome-dock-wrapper')) setTocOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [tocOpen]);

  // Don't render on gallery
  if (route.type === 'gallery') return null;

  // Hide on experiment when overlay is toggled off (H key)
  if (isExperiment && !overlayVisible) return null;

  const showArticle = (isExperiment || isVision) && hasArticle;
  const showExport = isExperiment;
  const showFps = isExperiment || isVision;

  return (
    <>
    <div className="chrome-dock-wrapper">
      <nav className="chrome-dock">
        {/* Back */}
        <button className="dock-btn" onClick={onBack} title="Back to gallery">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-1px' }}>
            <path d="M10 3L5 8l5 5" />
          </svg>
        </button>

        {/* Share / Copy */}
        <button
          className={`dock-btn${copied ? ' dock-btn--active' : ''}`}
          onClick={handleShare}
          title={copied ? 'Copied!' : 'Copy shareable link'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            {copied ? (
              <path d="M4 8.5l2.5 2.5L12 5" />
            ) : (
              <>
                <rect x="6" y="6" width="7" height="7" rx="1.5" />
                <path d="M10 6V4.5A1.5 1.5 0 008.5 3h-5A1.5 1.5 0 002 4.5v5A1.5 1.5 0 004.5 11H6" />
              </>
            )}
          </svg>
        </button>

        {/* Article button */}
        {showArticle && (
          <button
            className="dock-btn"
            onClick={() => onNavigateArticle(slug)}
            title="How it works"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2h10v12H3z" />
              <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3" />
            </svg>
          </button>
        )}

        {/* Experiment: Export */}
        {showExport && (
          <button
            className="dock-btn"
            onClick={() => setExportOpen(true)}
            title="Export"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 10V2M5 5l3-3 3 3" />
              <path d="M3 11v2h10v-2" />
            </svg>
          </button>
        )}

        {/* Article: Diamond / View experiment */}
        {isArticle && (
          <button
            className="dock-btn"
            onClick={() => onNavigateExperiment(slug)}
            title="View experiment"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l4-4 4 4-4 8z" />
              <path d="M4 6h8" />
            </svg>
          </button>
        )}

        {/* Experiment / Vision: divider + FPS counter */}
        {showFps && (
          <>
            <div className="dock-divider" />
            <FpsCounter />
          </>
        )}

        {/* Vision: hand skeleton debug toggle */}
        {isVision && (
          <button
            className={`dock-btn${visionDebugVisible ? ' dock-btn--active' : ''}`}
            onClick={() => setVisionDebugVisible(!visionDebugVisible)}
            title={visionDebugVisible ? 'Hide hand skeleton' : 'Show hand skeleton'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="4" cy="4" r="1" fill="currentColor" />
              <circle cx="8" cy="3" r="1" fill="currentColor" />
              <circle cx="12" cy="5" r="1" fill="currentColor" />
              <circle cx="5" cy="9" r="1" fill="currentColor" />
              <circle cx="10" cy="10" r="1" fill="currentColor" />
              <circle cx="7" cy="13" r="1" fill="currentColor" />
              <path d="M4 4L8 3L12 5M5 9L10 10M8 3L7 13M4 4L5 9M12 5L10 10" opacity="0.6" />
            </svg>
          </button>
        )}

        {/* Article: TOC divider + toggle + dropdown (only if article has sections) */}
        {isArticle && tocSections.length > 0 && (
          <>
            <div className="dock-divider article-toc-divider" />
            <div className="article-toc-anchor">
              <button
                className={`dock-btn article-toc-toggle${tocOpen ? ' dock-btn--active' : ''}`}
                onClick={() => setTocOpen((v) => !v)}
                title="Table of contents"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3.5h10M3 6.5h6M3 9.5h8M3 12.5h5" />
                </svg>
              </button>
              <AnimatePresence>
                {tocOpen && (
                  <motion.div
                    key="toc-dropdown"
                    className="article-toc-dropdown"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.18, ease: [0.65, 0, 0.35, 1] }}
                    style={{ transformOrigin: 'top left' }}
                  >
                    <ul className="article-toc-list">
                      {tocSections.map(({ id, label }) => (
                        <li key={id} className="article-toc-item">
                          <button
                            className={`article-toc-link${activeSection === id ? ' active' : ''}`}
                            onClick={() => {
                              scrollToSectionRef.current?.(id);
                              setTocOpen(false);
                            }}
                          >
                            {label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </nav>
    </div>
    {/* Bottom-centered HUD pill — identical styling to the dock, values
        written imperatively by VisionView each frame via visionHudRef.
        Initial textContent is pre-padded with spaces so width stays stable
        as numbers change (paired with `white-space: pre` in CSS). */}
    {isVision && visionDebugVisible && (
      <div className="chrome-hud-wrapper">
        <nav className="chrome-dock chrome-dock--hud" ref={visionHudRef}>
          <HudChip label="HANDS" attr="hands" initial="0   " />
          <div className="dock-divider" />
          <HudChip label="CLAP" attr="clap" initial="idle   d·0.00 v· 0.00" />
          <div className="dock-divider" />
          <HudChip label="PINCH" attr="pinch" initial="open   off   p·0.00 min·   — x 0" />
          <div className="dock-divider" />
          <HudChip label="CLAPS" attr="claps" initial="  0" />
          <div className="dock-divider" />
          <HudChip label="TRK" attr="trk" initial="  0" suffix="fps" />
        </nav>
      </div>
    )}
    </>
  );
}

interface HudChipProps {
  label: string;
  attr: string;
  initial: string;
  suffix?: string;
}

function HudChip({ label, attr, initial, suffix }: HudChipProps) {
  return (
    <div className="hud-chip">
      <span className="hud-chip-label">{label}</span>
      <span className="hud-chip-value" data-vh={attr}>
        {initial}
      </span>
      {suffix && <span className="hud-chip-label hud-chip-suffix">{suffix}</span>}
    </div>
  );
}
