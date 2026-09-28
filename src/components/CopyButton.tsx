'use client';

import { useEffect } from 'react';
import { useClipboard } from '@/hooks/useClipboard';
import { useToast } from '@/contexts/NotificationProvider';
import { Icon } from '@/components/Icon';

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  /** Optional keyboard shortcut (e.g. "c" triggers on Ctrl+Shift+C / Cmd+Shift+C) */
  keyboardShortcut?: string;
}

export function CopyButton({
  text,
  label = 'Copy',
  className = '',
  keyboardShortcut,
}: CopyButtonProps) {
  const { isCopied, copy } = useClipboard();
  const { showToast } = useToast();

  const handleCopy = async () => {
    const success = await copy(text);
    if (success) {
      showToast('Copied to clipboard', 'success');
    } else {
      showToast('Failed to copy — please copy manually', 'error');
    }
  };

  // Register optional keyboard shortcut (Ctrl/Cmd + Shift + key)
  useEffect(() => {
    if (!keyboardShortcut) return;

    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.shiftKey && e.key.toLowerCase() === keyboardShortcut.toLowerCase()) {
        e.preventDefault();
        handleCopy();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardShortcut, text]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs border border-line hover:border-accent transition-colors rounded ${className}`}
      aria-label={isCopied ? 'Copied!' : `${label}: ${text}`}
      title={
        isCopied
          ? 'Copied!'
          : keyboardShortcut
            ? `Copy to clipboard (Ctrl+Shift+${keyboardShortcut.toUpperCase()})`
            : 'Copy to clipboard'
      }
    >
      {isCopied ? (
        <Icon name="copy-check" size={14} className="text-accent" />
      ) : (
        <Icon name="copy" size={14} />
      )}
      {label && <span>{isCopied ? 'Copied' : label}</span>}
    </button>
  );
}
