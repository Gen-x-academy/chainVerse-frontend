/**
 * #101 Refactor: Auth Types
 * Centralized interfaces for authentication and user sessions.
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'instructor' | 'student';
  avatarUrl?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  expiresIn: number; // Duration in seconds
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export type DecodedToken = {
  sub: string;    // Subject (User ID)
  exp: number;    // Expiration time
  iat: number;    // Issued at
  role: string;
};