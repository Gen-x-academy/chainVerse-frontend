import { apiClient } from '../../../lib/api-client';

export class AdminCourseService {
  /**
   * Deletes a course
   * Fix for #385: Replaced parameter signature to use tutorId for both roles
   * since adminId was not in scope
   */
  async delete(id: string, tutorId: string, isAdmin: boolean, reason: string): Promise<{ success: boolean }> {
    try {
      // Get course first
      const course = await apiClient.get<any>(`/api/courses/${id}`);
      
      // Fix: Use tutorId for both admin and tutor roles instead of undefined adminId
      // course.deletedBy = isAdmin ? `admin:${adminId}` : `tutor:${tutorId}`;
      course.deletedBy = isAdmin ? `admin:${tutorId}` : `tutor:${tutorId}`;
      
      // Update course with deletion info
      await apiClient.patch(`/api/courses/${id}`, {
        deleted: true,
        deletedBy: course.deletedBy,
        deletionReason: reason,
        deletedAt: new Date().toISOString()
      });
      
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete course: ${error}`);
    }
  }
}

export const adminCourseService = new AdminCourseService();