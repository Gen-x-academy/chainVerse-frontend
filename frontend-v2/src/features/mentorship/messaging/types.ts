/**
 * Engagement-scoped messaging (MENTOR-101).
 */

export type Message = {
  id: string;
  engagementId: string;
  senderId: string;
  content: string;
  attachments: string[];
  createdAt: string;
  read: boolean;
};
