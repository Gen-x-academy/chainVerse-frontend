/**
 * MENTOR-061: scoped session workspace.
 *
 * One workspace per booked session that brings together the agenda, shared
 * goals, permitted resources, attendance state and follow-up actions. Only
 * participants and staff scoped to the session may enter. Cancelled sessions,
 * expired (past retention) workspaces and staff views are read-only. Private
 * mentor/mentee notes are deliberately NOT part of this model: the workspace
 * only exposes a separate slot for them.
 */

export type WorkspaceStatus = 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
export type WorkspaceSection =
  | 'overview'
  | 'agenda'
  | 'goals'
  | 'resources'
  | 'attendance'
  | 'follow-ups'
  | 'private-notes';

export type WorkspaceErrorCode =
  | 'NOT_AUTHORIZED'
  | 'READ_ONLY'
  | 'EXPIRED'
  | 'VERSION_CONFLICT'
  | 'UNSAFE_CONTENT'
  | 'INVALID_ITEM'
  | 'NOT_FOUND';

/** Stable, actionable messages. They never include workspace text. */
export const WORKSPACE_ERROR_MESSAGES: Record<WorkspaceErrorCode, string> = {
  NOT_AUTHORIZED: 'You do not have access to this session workspace.',
  READ_ONLY: 'This workspace is read-only, so it cannot be changed.',
  EXPIRED: 'This workspace is past its retention period and its contents are no longer available.',
  VERSION_CONFLICT: 'Someone else changed the workspace. Reload it and try again.',
  UNSAFE_CONTENT: 'Text cannot contain markup, links to scripts or control characters.',
  INVALID_ITEM: 'Check the follow-up action and try again.',
  NOT_FOUND: 'That item no longer exists. Reload the workspace.',
};

export class WorkspaceError extends Error {
  readonly code: WorkspaceErrorCode;
  constructor(code: WorkspaceErrorCode) {
    super(WORKSPACE_ERROR_MESSAGES[code]);
    this.name = 'WorkspaceError';
    this.code = code;
  }
}

export interface WorkspaceGoal {
  id: string;
  title: string;
  done: boolean;
}

export interface WorkspaceAgendaItem {
  id: string;
  title: string;
  state: 'open' | 'resolved' | 'withdrawn';
}

export interface WorkspaceResource {
  id: string;
  title: string;
  /** Only https links are rendered as links. */
  url?: string;
  /** Who may see this resource. */
  audience: 'participants' | 'participants-and-staff';
}

export interface WorkspaceAttendance {
  participantId: string;
  status: 'attended' | 'partial' | 'absent' | 'pending-corroboration' | 'not-started';
}

export interface WorkspaceFollowUp {
  id: string;
  title: string;
  ownerId: string;
  dueDate?: string;
  done: boolean;
  createdBy: string;
}

export interface SessionWorkspaceData {
  sessionId: string;
  engagementId: string;
  status: WorkspaceStatus;
  scheduledStart: string;
  scheduledEnd: string;
  participantIds: readonly string[];
  /** Staff explicitly scoped to this session (e.g. a program coordinator). */
  scopedStaffIds: readonly string[];
  /** From the engagement agreement; after this date content is not available. */
  retainUntil?: string;
  /** Incremented per applied command. */
  version: number;
  agenda: readonly WorkspaceAgendaItem[];
  goals: readonly WorkspaceGoal[];
  resources: readonly WorkspaceResource[];
  attendance: readonly WorkspaceAttendance[];
  followUps: readonly WorkspaceFollowUp[];
  /** Append-only ids of applied commands, for idempotent retries. */
  appliedCommandIds: readonly string[];
}

export interface WorkspaceViewer {
  userId: string | null | undefined;
}

export type WorkspaceRole = 'participant' | 'staff' | 'none';

export function workspaceRole(viewer: WorkspaceViewer, ws: SessionWorkspaceData): WorkspaceRole {
  if (!viewer.userId) return 'none';
  if (ws.participantIds.includes(viewer.userId)) return 'participant';
  if (ws.scopedStaffIds.includes(viewer.userId)) return 'staff';
  return 'none';
}

export function isWorkspaceExpired(ws: Pick<SessionWorkspaceData, 'retainUntil'>, now: Date): boolean {
  return ws.retainUntil !== undefined && Date.parse(ws.retainUntil) <= now.getTime();
}

export interface WorkspacePermissions {
  role: WorkspaceRole;
  canEnter: boolean;
  /** True when contents are withheld because retention has ended. */
  expired: boolean;
  readOnly: boolean;
  readOnlyReason?: 'cancelled' | 'expired' | 'staff';
  canEditFollowUps: boolean;
}

/** Deny-by-default access and write permissions. */
export function workspacePermissions(
  viewer: WorkspaceViewer,
  ws: SessionWorkspaceData,
  now: Date,
): WorkspacePermissions {
  const role = workspaceRole(viewer, ws);
  if (role === 'none') {
    return { role, canEnter: false, expired: false, readOnly: true, canEditFollowUps: false };
  }
  const expired = isWorkspaceExpired(ws, now);
  const readOnlyReason: WorkspacePermissions['readOnlyReason'] = expired
    ? 'expired'
    : ws.status === 'cancelled'
      ? 'cancelled'
      : role === 'staff'
        ? 'staff'
        : undefined;
  return {
    role,
    canEnter: true,
    expired,
    readOnly: readOnlyReason !== undefined,
    ...(readOnlyReason ? { readOnlyReason } : {}),
    canEditFollowUps: readOnlyReason === undefined,
  };
}

/** Sections the viewer can navigate to; private notes only for participants. */
export function workspaceSections(
  viewer: WorkspaceViewer,
  ws: SessionWorkspaceData,
  now: Date,
): WorkspaceSection[] {
  const perms = workspacePermissions(viewer, ws, now);
  if (!perms.canEnter) return [];
  if (perms.expired) return ['overview'];
  const sections: WorkspaceSection[] = ['overview', 'agenda', 'goals', 'resources', 'attendance', 'follow-ups'];
  if (perms.role === 'participant') sections.push('private-notes');
  return sections;
}

/** Resources the viewer may see, and only https links keep their URL. */
export function visibleResources(
  viewer: WorkspaceViewer,
  ws: SessionWorkspaceData,
): WorkspaceResource[] {
  const role = workspaceRole(viewer, ws);
  if (role === 'none') return [];
  return ws.resources
    .filter((r) => r.audience === 'participants-and-staff' || role === 'participant')
    .map((r) => {
      const { url, ...rest } = r;
      return url && /^https:\/\//i.test(url) ? { ...rest, url } : rest;
    });
}

/**
 * Returns the workspace as the viewer may see it: nothing for outsiders, an
 * empty shell once retention has ended, resources filtered by audience.
 */
export function viewWorkspace(
  viewer: WorkspaceViewer,
  ws: SessionWorkspaceData,
  now: Date,
): SessionWorkspaceData | null {
  const perms = workspacePermissions(viewer, ws, now);
  if (!perms.canEnter) return null;
  if (perms.expired) {
    return { ...ws, agenda: [], goals: [], resources: [], attendance: [], followUps: [], appliedCommandIds: [] };
  }
  return { ...ws, resources: visibleResources(viewer, ws) };
}

export type WorkspaceCommand =
  | { type: 'add-follow-up'; title: string; ownerId: string; dueDate?: string }
  | { type: 'set-follow-up-done'; followUpId: string; done: boolean };

export interface WorkspaceCommandEnvelope {
  commandId: string;
  baseVersion: number;
  command: WorkspaceCommand;
}

export const FOLLOW_UP_TITLE_MAX_LENGTH = 200;

const MARKUP = /[<>]/;
const SCRIPT_URL = /(javascript|data|vbscript)\s*:/i;
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/;

export function sanitizeWorkspaceText(value: unknown, max: number): string {
  if (typeof value !== 'string') throw new WorkspaceError('INVALID_ITEM');
  const text = value.trim();
  if (text.length === 0 || text.length > max) throw new WorkspaceError('INVALID_ITEM');
  if (MARKUP.test(text) || SCRIPT_URL.test(text) || CONTROL.test(text)) {
    throw new WorkspaceError('UNSAFE_CONTENT');
  }
  return text;
}

/**
 * Applies a follow-up command. Order of checks: access, retention, replay,
 * read-only, version conflict, rules. Replaying a `commandId` is a no-op.
 */
export function applyWorkspaceCommand(
  ws: SessionWorkspaceData,
  viewer: WorkspaceViewer,
  envelope: WorkspaceCommandEnvelope,
  now: Date,
): SessionWorkspaceData {
  const perms = workspacePermissions(viewer, ws, now);
  if (!perms.canEnter) throw new WorkspaceError('NOT_AUTHORIZED');
  if (perms.expired) throw new WorkspaceError('EXPIRED');
  if (ws.appliedCommandIds.includes(envelope.commandId)) return ws;
  if (!perms.canEditFollowUps) throw new WorkspaceError('READ_ONLY');
  if (envelope.baseVersion !== ws.version) throw new WorkspaceError('VERSION_CONFLICT');

  const { command } = envelope;
  let followUps = [...ws.followUps];
  if (command.type === 'add-follow-up') {
    const title = sanitizeWorkspaceText(command.title, FOLLOW_UP_TITLE_MAX_LENGTH);
    if (!ws.participantIds.includes(command.ownerId)) throw new WorkspaceError('INVALID_ITEM');
    if (command.dueDate !== undefined && Number.isNaN(Date.parse(command.dueDate))) {
      throw new WorkspaceError('INVALID_ITEM');
    }
    followUps.push({
      id: `fu_${envelope.commandId}`,
      title,
      ownerId: command.ownerId,
      ...(command.dueDate ? { dueDate: command.dueDate } : {}),
      done: false,
      createdBy: viewer.userId!,
    });
  } else if (command.type === 'set-follow-up-done') {
    const index = followUps.findIndex((f) => f.id === command.followUpId);
    if (index === -1) throw new WorkspaceError('NOT_FOUND');
    followUps[index] = { ...followUps[index], done: Boolean(command.done) };
  } else {
    throw new WorkspaceError('INVALID_ITEM');
  }
  return {
    ...ws,
    version: ws.version + 1,
    followUps,
    appliedCommandIds: [...ws.appliedCommandIds, envelope.commandId],
  };
}

/** Log-safe view: ids, status and counts only. */
export function redactWorkspaceForLog(ws: SessionWorkspaceData): {
  sessionId: string;
  status: WorkspaceStatus;
  version: number;
  followUpCount: number;
} {
  return { sessionId: ws.sessionId, status: ws.status, version: ws.version, followUpCount: ws.followUps.length };
}

export function toWorkspaceError(error: unknown): WorkspaceError {
  if (error instanceof WorkspaceError) return error;
  const status = (error as { status?: number } | null)?.status;
  if (status === 404) return new WorkspaceError('NOT_FOUND');
  if (status === 409) return new WorkspaceError('VERSION_CONFLICT');
  if (status === 410) return new WorkspaceError('EXPIRED');
  if (status === 423) return new WorkspaceError('READ_ONLY');
  if (status === 400 || status === 422) return new WorkspaceError('INVALID_ITEM');
  return new WorkspaceError('NOT_AUTHORIZED');
}
