import { apiClient } from "@/src/lib/api-client";

export type ScholarshipInvitation = {
  id: string;
  applicationId: string;
  recipientId: string;
  nonce: string;
  expiresAt: string;
  consumedAt?: string;
};

export type InvitationUseDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "RECIPIENT_MISMATCH" | "EXPIRED" | "ALREADY_CONSUMED";
    };

export function decideInvitationUse(
  invitation: ScholarshipInvitation,
  recipientId: string,
  now: Date = new Date(),
): InvitationUseDecision {
  if (invitation.recipientId !== recipientId) {
    return { allowed: false, reason: "RECIPIENT_MISMATCH" };
  }
  if (invitation.consumedAt) {
    return { allowed: false, reason: "ALREADY_CONSUMED" };
  }
  if (Date.parse(invitation.expiresAt) <= now.getTime()) {
    return { allowed: false, reason: "EXPIRED" };
  }
  return { allowed: true };
}

export function isWalletBoundToRecipient(input: {
  requestedRecipientId: string;
  verifiedRecipientId: string;
  requestedWalletAddress: string;
  verifiedWalletAddress: string;
}): boolean {
  return (
    input.requestedRecipientId === input.verifiedRecipientId &&
    input.requestedWalletAddress === input.verifiedWalletAddress
  );
}

export const scholarshipSecurityService = {
  acceptInvitation: (
    invitationId: string,
    recipientId: string,
  ): Promise<ScholarshipInvitation> =>
    apiClient.post<ScholarshipInvitation>(
      `/scholarships/invitations/${encodeURIComponent(invitationId)}/accept`,
      { recipientId },
    ),
};
