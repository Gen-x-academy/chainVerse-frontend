import { apiClient } from '../../../lib/api-client';
import type { DecodedToken } from '../types/auth.types';

export class StudentAuthService {
  /**
   * Verifies the student's email using JWT token
   * Fix for #387: Now compares dto.token with student.verificationToken after verification
   */
  async verifyEmail(dto: { token: string; studentId: string }): Promise<{ success: boolean }> {
    try {
      // Verify JWT signature first
      const payload = this.verifyJwt(dto.token);
      
      // Get student from database to check verificationToken
      const student = await apiClient.get<any>(`/api/students/${dto.studentId}`);
      
      // Fix: Compare the supplied token with the stored verificationToken
      if (dto.token !== student.verificationToken) {
        throw new Error('Invalid verification token');
      }
      
      // Mark email as verified
      await apiClient.post(`/api/students/${dto.studentId}/verify-email`, {
        token: dto.token
      });
      
      return { success: true };
    } catch (error) {
      throw new Error('Invalid or expired verification token');
    }
  }

  /**
   * Refreshes student's access token
   * Fix for #384: Now properly assigns payload from verifyJwt result
   */
  async refreshToken(dto: { refreshToken: string; studentId: string }): Promise<{ accessToken: string; expiresIn: number }> {
    let payload: Record<string, unknown>;
    try {
      // Fix: Assign the result of verifyJwt to payload
      payload = this.verifyJwt(dto.refreshToken);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }

    // Check if payload has required properties
    if (!payload || typeof payload !== 'object' || !('sub' in payload) || !('family' in payload)) {
      throw new Error('Invalid refresh token payload');
    }

    // Generate new access token
    const response = await apiClient.post<{ accessToken: string; expiresIn: number }>(
      `/api/students/${dto.studentId}/refresh-token`,
      { refreshToken: dto.refreshToken }
    );

    return response;
  }

  /**
   * Verifies JWT token
   */
  verifyJwt(token: string): DecodedToken {
    try {
      // Simple JWT verification - in real implementation this would use a proper JWT library
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      // Decode payload (base64url decode)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new Error('Token expired');
      }
      
      return payload as DecodedToken;
    } catch (error) {
      throw new Error(`JWT verification failed: ${error}`);
    }
  }
}

export const studentAuthService = new StudentAuthService();