import { useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { CameraManager, CameraError, type CameraErrorCode } from '../core/CameraManager';

interface CameraPermissionProps {
  onReady: (manager: CameraManager) => void;
}

const ERROR_MESSAGES: Record<CameraErrorCode, string> = {
  denied: 'Camera access was denied. Check your browser permissions and try again.',
  'in-use': 'Your camera is being used by another app. Close it and try again.',
  'not-found': 'No camera detected on this device.',
  unavailable: 'Your camera could not provide the requested settings.',
  unsupported: 'Camera access is not supported in this browser.',
  unknown: 'Something went wrong. Try again.',
};

export function CameraPermission({ onReady }: CameraPermissionProps) {
  const [requesting, setRequesting] = useState(false);
  const [errorCode, setErrorCode] = useState<CameraErrorCode | null>(null);
  const [stuck, setStuck] = useState(false);
  // Don't render anything until we've checked whether the browser already
  // has a live grant — avoids flashing the "Enable Camera" card on repeat visits.
  const [checked, setChecked] = useState(false);
  const [autoStarting, setAutoStarting] = useState(false);

  useEffect(() => {
    if (!requesting) {
      setStuck(false);
      return;
    }
    const t = setTimeout(() => setStuck(true), 4000);
    return () => clearTimeout(t);
  }, [requesting]);

  const handleEnable = useCallback(async () => {
    setRequesting(true);
    setErrorCode(null);
    const manager = new CameraManager();
    try {
      await manager.start();
      onReady(manager);
    } catch (err) {
      if (err instanceof CameraError) setErrorCode(err.code);
      else setErrorCode('unknown');
      manager.dispose();
      setRequesting(false);
      setAutoStarting(false);
    }
  }, [onReady]);

  // On mount, ask the Permissions API whether camera is already granted for
  // this origin. If it is, skip the button and start the camera silently.
  // Note: no external "did we already try" guard — StrictMode runs the effect
  // twice in dev, the first run's cleanup cancels its async, and the second
  // run is the one that actually sets state. A ref-guard here would block the
  // second run and leave the card hidden forever.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!('permissions' in navigator)) {
        if (!cancelled) setChecked(true);
        return;
      }
      try {
        const status = await navigator.permissions.query({
          name: 'camera' as PermissionName,
        });
        if (cancelled) return;
        if (status.state === 'granted') {
          setAutoStarting(true);
          handleEnable();
        } else {
          setChecked(true);
        }
      } catch {
        // Safari doesn't support querying 'camera' — show the button normally.
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleEnable]);

  // Skip the card entirely while we're checking or silently auto-starting.
  // VisionView will show its own loading spinner once stage flips to 'loading'.
  if (!checked || autoStarting) return null;

  return (
    <motion.div
      className="vision-permission"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="vision-permission-card">
        <h2>Enable Camera</h2>
        <p>
          This experiment uses your camera to detect hand position and gestures.
          Your video stays on your device — nothing is uploaded.
        </p>
        {errorCode && (
          <p className="vision-permission-error">{ERROR_MESSAGES[errorCode]}</p>
        )}
        {requesting && stuck && !errorCode && (
          <p className="vision-permission-hint">
            No prompt showing? Check the camera icon in your browser's address bar, or
            open site settings (the lock/tune icon next to the URL) and reset camera
            permission for this site, then reload.
          </p>
        )}
        <button
          className="vision-permission-btn"
          onClick={handleEnable}
          disabled={requesting}
        >
          {requesting ? 'Requesting…' : errorCode ? 'Try again' : 'Enable Camera'}
        </button>
      </div>
    </motion.div>
  );
}
