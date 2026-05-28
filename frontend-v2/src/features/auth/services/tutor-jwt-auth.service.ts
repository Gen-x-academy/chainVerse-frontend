import { apiClient } from '../../../lib/api-client';
import type { DecodedToken } from '../types/auth.types';

export class TutorJwtAuthService {
  /**
   * Fix for #386: Removed in-memory array and replaced with database calls
   * All operations now use API calls to backend MongoDB service
   */
  
  /**
   * Creates a new tutor auth record in the database
   */
  async create(dto: { tutorId: string; accessToken: string; refreshToken: string; expiresIn: number }): Promise<{ id: string }> {
    return apiClient.post<{ id: string }>(
      '/api/tutors/auth', 
      dto
    );
  }

  /**
   * Finds tutor auth record by tutor ID
   */
  async findByTutorId(tutorId: string): Promise<{ id: string; tutorId: string; accessToken: string; refreshToken: string; expiresIn: number; createdAt: string; updatedAt: string } | null> {
    try {
      const response = await apiClient.get<any>(`/api/tutors/auth/${tutorId}`);
      return response;
    } catch (error) {
      return null;
    }
  }

  /**
   * Updates tutor auth record in the database
   */
  async update(id: string, dto: { accessToken?: string; refreshToken?: string; expiresIn?: number }): Promise<{ success: boolean }> {
    return apiClient.patch<{ success: boolean }>(
      `/api/tutors/auth/${id}`, 
      dto
    );
  }

  /**
   * Deletes tutor auth record from the database
   */
  async delete(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/api/tutors/auth/${id}`);
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

export const tutorJwtAuthService = new TutorJwtAuthService();