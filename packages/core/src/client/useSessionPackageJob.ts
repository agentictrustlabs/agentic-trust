'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type UseSessionPackageJobOptions = {
  progressDurationMs?: number;
};

export function useSessionPackageJob(
  options: UseSessionPackageJobOptions = {},
) {
  const progressDurationMs = options.progressDurationMs ?? 60000;
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgressState] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setProgress = useCallback((value: number) => {
    const next = Math.max(0, Math.min(100, value));
    setProgressState((current) => (next > current ? next : current));
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setLoading(false);
    setError(null);
    setProgressState(0);
    setConfirmOpen(false);
  }, [clearTimer]);

  const begin = useCallback(() => {
    setError(null);
    setText(null);
    setProgressState(0);
    setLoading(true);
  }, []);

  const fail = useCallback((message: string) => {
    clearTimer();
    setError(message);
    setLoading(false);
    setProgressState(0);
  }, [clearTimer]);

  const complete = useCallback((params?: { text?: string | null; resetAfterMs?: number }) => {
    clearTimer();
    if (params && 'text' in params) {
      setText(params.text ?? null);
    }
    setProgressState(100);
    const resetAfterMs = params?.resetAfterMs ?? 0;
    if (resetAfterMs > 0) {
      setTimeout(() => {
        setLoading(false);
        setProgressState(0);
      }, resetAfterMs);
      return;
    }
    setLoading(false);
  }, [clearTimer]);

  useEffect(() => {
    if (!loading) {
      clearTimer();
      return;
    }

    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / progressDurationMs) * 100, 100);
      setProgressState((current) => (pct > current ? pct : current));
      if (pct >= 100) {
        clearTimer();
      }
    }, 500);

    return () => {
      clearTimer();
    };
  }, [loading, progressDurationMs, clearTimer]);

  return {
    text,
    setText,
    loading,
    setLoading,
    error,
    setError,
    progress,
    setProgress,
    confirmOpen,
    openConfirm: () => setConfirmOpen(true),
    closeConfirm: () => setConfirmOpen(false),
    begin,
    complete,
    fail,
    reset,
  };
}
