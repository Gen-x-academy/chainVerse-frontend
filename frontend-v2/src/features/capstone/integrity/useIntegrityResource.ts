'use client';

import { useCallback, useEffect, useState } from 'react';
import { IntegrityApiError, IntegrityConflictError, integrityApi } from './shared';

export type ResourceStatus = 'loading' | 'empty' | 'ready' | 'error' | 'conflict';

export interface ResourceState<T> {
  status: ResourceStatus;
  data?: T;
  message?: string;
  currentVersion?: string | number;
}

/** Typed read state with explicit loading/empty/error/conflict/success states. */
export function useIntegrityResource<T>(path: string | null) {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!path) {
      setState({ status: 'loading' });
      return;
    }
    let active = true;
    setState({ status: 'loading' });
    integrityApi
      .get<T>(path)
      .then((data) => {
        if (!active) return;
        const empty = Array.isArray(data) ? data.length === 0 : data === null || data === undefined;
        setState(empty ? { status: 'empty' } : { status: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof IntegrityConflictError) {
          setState({ status: 'conflict', message: error.message, currentVersion: error.currentVersion });
        } else {
          setState({
            status: 'error',
            message: error instanceof IntegrityApiError ? error.message : 'Unable to load this view. Try again.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, [path, nonce]);

  return { ...state, refresh };
}
