import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

// ── PWA Install Banner ─────────────────────────────────────────────────────────
// Shows a native "Add to Home Screen" prompt on Android Chrome and
// a manual instruction banner on iOS Safari.
//
// On Android/Desktop Chrome: catches the 'beforeinstallprompt' event and
// shows a banner. Clicking install triggers the native browser install dialog.
//
// On iOS Safari: the beforeinstallprompt event doesn't fire (Apple restriction),
// so we show a manual instruction banner instead (Share → Add to Home Screen).
//
// Usage: Mount this once in App.tsx or your root layout.
// It renders nothing until the install is possible and hasn't been dismissed.

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show,           setShow]           = useState(false);
  const [isIOS,          setIsIOS]          = useState(false);
  const [installing,     setInstalling]     = useState(false);

  useEffect(() => {
    // Check if already installed (running as standalone PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return; // already installed — don't show banner

    // Check if user dismissed previously (24h cooldown)
    const dismissed = localStorage.getItem('pwa-dismiss-ts');
    if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) return;

    // iOS detection
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const safari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (ios && safari) {
      setIsIOS(true);
      // Show iOS banner after 3 seconds
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }

    // Android / Desktop Chrome: wait for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Also check if appinstalled fired (hide banner if app was installed elsewhere)
    const installed = () => { setShow(false); setDeferredPrompt(null); };
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
        setDeferredPrompt(null);
      }
    } catch {}
    setInstalling(false);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa-dismiss-ts', String(Date.now()));
  };

  if (!show) return null;

  // ── iOS manual instructions ──
  if (isIOS) {
    return (
      <div className="fixed bottom-0 inset-x-0 z-50 p-4 pointer-events-none flex justify-center">
        <div
          className="pointer-events-auto w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl px-4 py-4"
          style={{ animation: 'slideUp 0.3s ease both' }}
        >
          <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-lg">
              🎓
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm mb-0.5">Install Attende-x</p>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Tap <span className="text-zinc-200 font-semibold">Share</span>{' '}
                <span className="inline-block text-base leading-none">⎙</span>{' '}
                then <span className="text-zinc-200 font-semibold">"Add to Home Screen"</span>{' '}
                <span className="inline-block text-base leading-none">＋</span>{' '}
                to install this app
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Android / Desktop Chrome install prompt ──
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pointer-events-none flex justify-center">
      <div
        className="pointer-events-auto w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl px-4 py-4"
        style={{ animation: 'slideUp 0.3s ease both' }}
      >
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-lg">
            🎓
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Install Attende-x</p>
            <p className="text-zinc-400 text-xs">Add to home screen for the best experience</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="p-2 text-zinc-500 hover:text-zinc-300 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleInstall}
              disabled={installing}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-colors"
            >
              <Download size={13} />
              {installing ? 'Installing…' : 'Install'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}