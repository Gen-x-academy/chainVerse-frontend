import { vi, describe, it, expect, beforeEach } from 'vitest';

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
}

// Email service that sends real transactional emails
class EmailService {
  constructor(private transport: { sendMail: (payload: EmailPayload) => Promise<void> }) {}

  async sendCourseApproval(tutorEmail: string, courseTitle: string): Promise<void> {
    await this.transport.sendMail({
      to: tutorEmail,
      subject: `Course Approved: ${courseTitle}`,
      body: `Your course "${courseTitle}" has been approved.`,
    });
  }

  async sendCourseRejection(tutorEmail: string, courseTitle: string, reason: string): Promise<void> {
    await this.transport.sendMail({
      to: tutorEmail,
      subject: `Course Rejected: ${courseTitle}`,
      body: `Your course "${courseTitle}" was rejected. Reason: ${reason}`,
    });
  }
}

describe('EmailService', () => {
  const mockTransport = { sendMail: vi.fn() };
  let service: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new EmailService(mockTransport);
  });

  it('sends approval email to tutor', async () => {
    mockTransport.sendMail.mockResolvedValueOnce(undefined);
    await service.sendCourseApproval('tutor@test.com', 'Intro to Blockchain');
    expect(mockTransport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'tutor@test.com', subject: expect.stringContaining('Approved') })
    );
  });

  it('sends rejection email with reason', async () => {
    mockTransport.sendMail.mockResolvedValueOnce(undefined);
    await service.sendCourseRejection('tutor@test.com', 'DeFi 101', 'Incomplete content');
    expect(mockTransport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining('Incomplete content') })
    );
  });
});