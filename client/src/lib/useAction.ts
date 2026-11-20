import { useCallback, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { errorMessage } from './hooks';

/**
 * Small helper for portal mutations: tracks which action is in flight and
 * surfaces API errors through the global toast stack.
 */
export function useAction() {
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(key: string, operation: () => Promise<T>, success?: string): Promise<T | undefined> => {
      setBusy(key);
      try {
        const result = await operation();
        if (success) notify(success, 'success');
        return result;
      } catch (error) {
        notify(errorMessage(error), 'error');
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [notify]
  );

  return { busy, run };
}
