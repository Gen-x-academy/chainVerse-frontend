import { apiClient } from '../../../lib/api-client';

export type RegisterStudentDto = {
  name: string;
  email: string;
  password: string;
};

export type RegisterStudentResponse = {
  id: string;
  email: string;
  message: string;
};

export const studentRegisterService = {
  register: (dto: RegisterStudentDto) =>
    apiClient.post<RegisterStudentResponse>('/student/register', dto),
};
