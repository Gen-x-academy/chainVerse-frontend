import { apiClient } from '@/lib/api-client'
import type {
	Instructor,
	InstructorListResponse,
	InstructorPayload,
} from '../types/instructor.types'

export const instructorService = {
	list: (page = 1, pageSize = 10) =>
		apiClient.get<InstructorListResponse>(
			`/instructors?page=${page}&pageSize=${pageSize}`
		),
	getById: (id: string) => apiClient.get<Instructor>(`/instructors/${id}`),
	create: (payload: InstructorPayload) =>
		apiClient.post<Instructor>('/instructors', payload),
	update: (id: string, payload: Partial<InstructorPayload>) =>
		apiClient.patch<Instructor>(`/instructors/${id}`, payload),
	remove: (id: string) =>
		apiClient.delete<{ success: boolean }>(`/instructors/${id}`),
}
