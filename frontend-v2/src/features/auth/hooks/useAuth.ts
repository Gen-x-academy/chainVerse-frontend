'use client';

import { useMutation } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import type { LoginPayload, RegisterPayload } from '../types/auth.types';

/**
 * useMutation wrapper for login.
 * Consumers can use `onSuccess` / `onError` callbacks or the returned
 * `isError` / `isPending` flags directly.
 */
export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
  });
}

/**
 * useMutation wrapper for registration.
 */
export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
  });
}
