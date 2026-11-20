'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Flag,
  FolderOpen,
  ListChecks,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  Target,
  Trash2,
  Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Typed workspace services (thin client wrappers around the workspace API).
// These are intentionally colocated so the route has a single typed surface.
// ---------------------------------------------------------------------------

export type WorkspaceRole = 'owner' | 'admin' | 'contributor' | 'viewer';

export type WorkspaceTab =
  | 'overview'
  | 'members'
  | 'objectives'
  | 'milestones'
  | 'resources'
  | 'activity'
  | 'next-actions';

export interface WorkspaceMember {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
  version: number;
}

export interface WorkspaceObjective {
  id: string;
  title: string;
  status: 'draft' | 'active' | 'achieved' | 'archived';
  ownerName: string;
}

export interface WorkspaceMilestone {
  id: string;
  title: string;
  dueAt: string | null;
  status: 'pending' | 'in_progress' | 'complete' | 'blocked';
}

export interface WorkspaceResource {
  id: string;
  title: string;
  kind: 'document' | 'link' | 'dataset' | 'repository';
  url: string;
}

export interface WorkspaceActivityEntry {
  id: string;
  actorName: string;
  summary: string;
  occurredAt: string;
}

export interface WorkspaceNextAction {
  id: string;
  title: string;
  assigneeName: string | null;
  dueAt: string | null;
}

export interface WorkspaceOverview {
  projectId: string;
  name: string;
  description: string;
  lifecycle: 'planning' | 'active' | 'paused' | 'completed' | 'archived';
  memberCount: number;
  objectiveCount: number;
  milestoneCount: number;
  updatedAt: string;
  version: number;
}

export interface WorkspaceSnapshot {
  overview: WorkspaceOverview;
  members: WorkspaceMember[];
  objectives: WorkspaceObjective[];
  milestones: WorkspaceMilestone[];
  resources: WorkspaceResource[];
  activity: WorkspaceActivityEntry[];
  nextActions: WorkspaceNextAction[];
  role: WorkspaceRole;
  permissions: {
    canReadMembers: boolean;
    canManageMembers: boolean;
    canReadObjectives: boolean;
    canReadMilestones: boolean;
    canReadResources: boolean;
    canReadActivity: boolean;
    canReadNextActions: boolean;
  };
}

export class WorkspaceApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'WorkspaceApiError';
    this.code = code;
    this.status = status;
  }
}

export class WorkspaceConflictError extends WorkspaceApiError {
  currentVersion: number;
  constructor(message: string, currentVersion: number) {
    super('WORKSPACE_CONFLICT', message, 409);
    this.name = 'WorkspaceConflictError';
    this.currentVersion = currentVersion;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (res.status === 409) {
    const body = await safeJson(res);
    throw new WorkspaceConflictError(
      typeof body?.message === 'string' ? body.message : 'The workspace changed since you loaded it.',
      typeof body?.currentVersion === 'number' ? body.currentVersion : 0,
    );
  }

  if (!res.ok) {
    const body = await safeJson(res);
    throw new WorkspaceApiError(
      typeof body?.code === 'string' ? body.code : 'WORKSPACE_REQUEST_FAILED',
      typeof body?.message === 'string' ? body.message : 'Unable to complete the request.',
      res.status,
    );
  }

  return (await res.json()) as T;
}

async function safeJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export const workspaceService = {
  async getSnapshot(projectId: string): Promise<WorkspaceSnapshot> {
    return request<WorkspaceSnapshot>(
      `/api/v2/projects/${encodeURIComponent(projectId)}/workspace`,
    );
  },
  async addMember(
    projectId: string,
    input: { userId: string; role: WorkspaceRole; expectedVersion: number },
  ): Promise<WorkspaceMember> {
    return request<WorkspaceMember>(
      `/api/v2/projects/${encodeURIComponent(projectId)}/workspace/members`,
      {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Idempotency-Key': `${projectId}:member:${input.userId}:${input.role}` },
      },
    );
  },
  async removeMember(
    projectId: string,
    memberId: string,
    expectedVersion: number,
  ): Promise<void> {
    await request<{ ok: true }>(
      `/api/v2/projects/${encodeURIComponent(projectId)}/workspace/members/${encodeURIComponent(memberId)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ expectedVersion }),
        headers: { 'Idempotency-Key': `${projectId}:member-remove:${memberId}` },
      },
    );
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TAB_ORDER: WorkspaceTab[] = [
  'overview',
  'members',
  'objectives',
  'milestones',
  'resources',
  'activity',
  'next-actions',
];

const TAB_META: Record<WorkspaceTab, { label: string; icon: React.ReactNode }> = {
  overview: { label: 'Overview', icon: <FolderOpen className="h-4 w-4" aria-hidden="true" /> },
  members: { label: 'Members', icon: <Users className="h-4 w-4" aria-hidden="true" /> },
  objectives: { label: 'Objectives', icon: <Target className="h-4 w-4" aria-hidden="true" /> },
  milestones: { label: 'Milestones', icon: <Flag className="h-4 w-4" aria-hidden="true" /> },
  resources: { label: 'Resources', icon: <FolderOpen className="h-4 w-4" aria-hidden="true" /> },
  activity: { label: 'Activity', icon: <ListChecks className="h-4 w-4" aria-hidden="true" /> },
  'next-actions': { label: 'Next actions', icon: <ListChecks className="h-4 w-4" aria-hidden="true" /> },
};

function canReadTab(tab: WorkspaceTab, permissions: WorkspaceSnapshot['permissions']): boolean {
  switch (tab) {
    case 'overview':
      return true;
    case 'members':
      return permissions.canReadMembers;
    case 'objectives':
      return permissions.canReadObjectives;
    case 'milestones':
      return permissions.canReadMilestones;
    case 'resources':
      return permissions.canReadResources;
    case 'activity':
      return permissions.canReadActivity;
    case 'next-actions':
      return permissions.canReadNextActions;
    default:
      return false;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function roleBadgeVariant(role: WorkspaceRole): 'default' | 'secondary' | 'outline' {
  if (role === 'owner') return 'default';
  if (role === 'admin') return 'secondary';
  return 'outline';
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string; code: string }
  | { status: 'ready'; snapshot: WorkspaceSnapshot };

type MutationState =
  | { status: 'idle' }
  | { status: 'pending'; label: string }
  | { status: 'success'; message: string }
  | { status: 'conflict'; message: string }
  | { status: 'error'; message: string };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProjectWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = typeof params?.projectId === 'string' ? params.projectId : '';

  const [loadState, setLoadState] = React.useState<LoadState>({ status: 'loading' });
  const [mutationState, setMutationState] = React.useState<MutationState>({ status: 'idle' });
  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>('overview');
  const [reloadToken, setReloadToken] = React.useState(0);

  const load = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!projectId) {
        setLoadState({
          status: 'error',
          code: 'MISSING_PROJECT_ID',
          message: 'No project was specified in the URL.',
        });
        return;
      }
      setLoadState({ status: 'loading' });
      try {
        const snapshot = await workspaceService.getSnapshot(projectId);
        if (signal?.aborted) return;
        setLoadState({ status: 'ready', snapshot });
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof WorkspaceApiError) {
          setLoadState({ status: 'error', code: err.code, message: err.message });
        } else {
          setLoadState({
            status: 'error',
            code: 'NETWORK_ERROR',
            message: 'We could not reach the workspace service. Please retry.',
          });
        }
      }
    },
    [projectId],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, reloadToken]);

  // Keep the active tab valid for the current role.
  React.useEffect(() => {
    if (loadState.status !== 'ready') return;
    const { permissions } = loadState.snapshot;
    if (!canReadTab(activeTab, permissions)) {
      const fallback = TAB_ORDER.find((t) => canReadTab(t, permissions)) ?? 'overview';
      setActiveTab(fallback);
    }
  }, [loadState, activeTab]);

  const handleRetry = React.useCallback(() => {
    setMutationState({ status: 'idle' });
    setReloadToken((n) => n + 1);
  }, []);

  const handleRefresh = React.useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  if (loadState.status === 'loading') {
    return <WorkspaceLoadingSkeleton projectId={projectId} />;
  }

  if (loadState.status === 'error') {
    return (
      <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-labelledby="workspace-error-title">
        <Alert variant="destructive" role="alert">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle id="workspace-error-title">Unable to load workspace</AlertTitle>
          <AlertDescription>
            <p>{loadState.message}</p>
            <p className="mt-1 text-xs opacity-80">Error code: {loadState.code}</p>
          </AlertDescription>
        </Alert>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleRetry} variant="default">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
          <Button variant="outline" asChild>
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back to projects
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  const { snapshot } = loadState;
  const visibleTabs = TAB_ORDER.filter((t) => canReadTab(t, snapshot.permissions));

  return (
    <main
      className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
      aria-labelledby="workspace-title"
    >
      <WorkspaceHeader
        snapshot={snapshot}
        onRefresh={handleRefresh}
        onBack={() => router.push('/projects')}
      />

      <MutationBanner state={mutationState} onDismiss={() => setMutationState({ status: 'idle' })} />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as WorkspaceTab)}
        className="mt-6"
      >
        <TabsList
          aria-label="Project workspace sections"
          className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto"
        >
          {visibleTabs.map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="gap-2"
              aria-label={TAB_META[tab].label}
            >
              {TAB_META[tab].icon}
              <span>{TAB_META[tab].label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4 focus-visible:outline-none">
          <OverviewPanel overview={snapshot.overview} />
        </TabsContent>

        {snapshot.permissions.canReadMembers && (
          <TabsContent value="members" className="mt-4 focus-visible:outline-none">
            <MembersPanel
              projectId={projectId}
              members={snapshot.members}
              canManage={snapshot.permissions.canManageMembers}
              currentVersion={snapshot.overview.version}
              onMutationState={setMutationState}
              onReload={handleRefresh}
            />
          </TabsContent>
        )}

        {snapshot.permissions.canReadObjectives && (
          <TabsContent value="objectives" className="mt-4 focus-visible:outline-none">
            <ObjectivesPanel objectives={snapshot.objectives} />
          </TabsContent>
        )}

        {snapshot.permissions.canReadMilestones && (
          <TabsContent value="milestones" className="mt-4 focus-visible:outline-none">
            <MilestonesPanel milestones={snapshot.milestones} />
          </TabsContent>
        )}

        {snapshot.permissions.canReadResources && (
          <TabsContent value="resources" className="mt-4 focus-visible:outline-none">
            <ResourcesPanel resources={snapshot.resources} />
          </TabsContent>
        )}

        {snapshot.permissions.canReadActivity && (
          <TabsContent value="activity" className="mt-4 focus-visible:outline-none">
            <ActivityPanel activity={snapshot.activity} />
          </TabsContent>
        )}

        {snapshot.permissions.canReadNextActions && (
          <TabsContent value="next-actions" className="mt-4 focus-visible:outline-none">
            <NextActionsPanel actions={snapshot.nextActions} />
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function WorkspaceHeader({
  snapshot,
  onRefresh,
  onBack,
}: {
  snapshot: WorkspaceSnapshot;
  onRefresh: () => void;
  onBack: () => void;
}) {
  const { overview, role } = snapshot;
  return (
    <header className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to projects">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <h1 id="workspace-title" className="truncate text-2xl font-semibold tracking-tight">
            {overview.name}
          </h1>
          <Badge variant="outline" className="capitalize">
            {overview.lifecycle}
          </Badge>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{overview.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={roleBadgeVariant(role)} className="capitalize">
            {role}
          </Badge>
          <span aria-hidden="true">•</span>
          <span>Updated {formatDate(overview.updatedAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh} aria-label="Refresh workspace">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Mutation banner
// ---------------------------------------------------------------------------

function MutationBanner({
  state,
  onDismiss,
}: {
  state: MutationState;
  onDismiss: () => void;
}) {
  if (state.status === 'idle' || state.status === 'pending') return null;

  if (state.status === 'success') {
    return (
      <Alert className="mt-4 border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" role="status">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>{state.message}</span>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (state.status === 'conflict') {
    return (
      <Alert variant="destructive" className="mt-4" role="alert">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Conflict detected</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>{state.message}</span>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive" className="mt-4" role="alert">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>Action failed</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>{state.message}</span>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

function OverviewPanel({ overview }: { overview: WorkspaceOverview }) {
  const stats = [
    { label: 'Members', value: overview.memberCount },
    { label: 'Objectives', value: overview.objectiveCount },
    { label: 'Milestones', value: overview.milestoneCount },
  ];
  return (
    <section aria-labelledby="overview-heading" className="space-y-4">
      <h2 id="overview-heading" className="sr-only">
        Overview
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="text-3xl">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>About this project</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{overview.description || 'No description provided.'}</p>
          <Separator />
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Lifecycle</dt>
              <dd className="capitalize">{overview.lifecycle}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last updated</dt>
              <dd>{formatDate(overview.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </section>
  );
}

function MembersPanel({
  projectId,
  members,
  canManage,
  currentVersion,
  onMutationState,
  onReload,
}: {
  projectId: string;
  members: WorkspaceMember[];
  canManage: boolean;
  currentVersion: number;
  onMutationState: (state: MutationState) => void;
  onReload: () => void;
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newUserId, setNewUserId] = React.useState('');
  const [newRole, setNewRole] = React.useState<WorkspaceRole>('contributor');
  const [pendingMemberId, setPendingMemberId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim() || submitting) return;
    setSubmitting(true);
    onMutationState({ status: 'pending', label: 'Adding member' });
    try {
      await workspaceService.addMember(projectId, {
        userId: newUserId.trim(),
        role: newRole,
        expectedVersion: currentVersion,
      });
      onMutationState({ status: 'success', message: 'Member added to the workspace.' });
      setDialogOpen(false);
      setNewUserId('');
      setNewRole('contributor');
      onReload();
    } catch (err) {
      if (err instanceof WorkspaceConflictError) {
        onMutationState({
          status: 'conflict',
          message: 'The member list changed. Refreshing the latest state.',
        });
        onReload();
      } else if (err instanceof WorkspaceApiError) {
        onMutationState({ status: 'error', message: err.message });
      } else {
        onMutationState({ status: 'error', message: 'Unable to add member. Please retry.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (member: WorkspaceMember) => {
    if (pendingMemberId) return;
    setPendingMemberId(member.id);
    onMutationState({ status: 'pending', label: 'Removing member' });
    try {
      await workspaceService.removeMember(projectId, member.id, currentVersion);
      onMutationState({ status: 'success', message: `${member.displayName} removed.` });
      onReload();
    } catch (err) {
      if (err instanceof WorkspaceConflictError) {
        onMutationState({
          status: 'conflict',
          message: 'The member list changed. Refreshing the latest state.',
        });
        onReload();
      } else if (err instanceof WorkspaceApiError) {
        onMutationState({ status: 'error', message: err.message });
      } else {
        onMutationState({ status: 'error', message: 'Unable to remove member. Please retry.' });
      }
    } finally {
      setPendingMemberId(null);
    }
  };

  return (
    <section aria-labelledby="members-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 id="members-heading" className="text-lg font-semibold">
          Members
        </h2>
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Add member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleAdd}>
                <DialogHeader>
                  <DialogTitle>Add a member</DialogTitle>
                  <DialogDescription>
                    Invite a collaborator to this project workspace.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="member-user-id">User ID</Label>
                    <Input
                      id="member-user-id"
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      placeholder="user_123"
                      autoComplete="off"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="member-role">Role</Label>
                    <Select
                      value={newRole}
                      onValueChange={(v) => setNewRole(v as WorkspaceRole)}
                    >
                      <SelectTrigger id="member-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="contributor">Contributor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="mt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting || !newUserId.trim()}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Add member
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {members.length === 0 ? (
        <EmptyState
          title="No members yet"
          description="Add collaborators to start working together on this project."
        />
      ) : (
        <ul className="divide-y rounded-md border" aria-label="Project members">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{m.displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={roleBadgeVariant(m.role)} className="capitalize">
                  {m.role}
                </Badge>
                <span className="text-xs text-muted-foreground">Joined {formatDate(m.joinedAt)}</span>
                {canManage && m.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(m)}
                    disabled={pendingMemberId === m.id}
                    aria-label={`Remove ${m.displayName}`}
                  >
                    {pendingMemberId === m.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ObjectivesPanel({ objectives }: { objectives: WorkspaceObjective[] }) {
  return (
    <section aria-labelledby="objectives-heading" className="space-y-4">
      <h2 id="objectives-heading" className="text-lg font-semibold">
        Objectives
      </h2>
      {objectives.length === 0 ? (
        <EmptyState title="No objectives" description="This project has no objectives defined yet." />
      ) : (
        <ul className="space-y-2" aria-label="Project objectives">
          {objectives.map((o) => (
            <li key={o.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.title}</p>
                    <p className="text-xs text-muted-foreground">Owner: {o.ownerName}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {o.status}
                  </Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MilestonesPanel({ milestones }: { milestones: WorkspaceMilestone[] }) {
  return (
    <section aria-labelledby="milestones-heading" className="space-y-4">
      <h2 id="milestones-heading" className="text-lg font-semibold">
        Milestones
      </h2>
      {milestones.length === 0 ? (
        <EmptyState title="No milestones" description="No milestones have been scheduled." />
      ) : (
        <ul className="space-y-2" aria-label="Project milestones">
          {milestones.map((m) => (
            <li key={m.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">Due {formatDate(m.dueAt)}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {m.status.replace('_', ' ')}
                  </Badge>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ResourcesPanel({ resources }: { resources: WorkspaceResource[] }) {
  return (
    <section aria-labelledby="resources-heading" className="space-y-4">
      <h2 id="resources-heading" className="text-lg font-semibold">
        Resources
      </h2>
      {resources.length === 0 ? (
        <EmptyState title="No resources" description="No shared resources have been added." />
      ) : (
        <ul className="space-y-2" aria-label="Project resources">
          {resources.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">{r.kind}</p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      Open
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActivityPanel({ activity }: { activity: WorkspaceActivityEntry[] }) {
  return (
    <section aria-labelledby="activity-heading" className="space-y-4">
      <h2 id="activity-heading" className="text-lg font-semibold">
        Activity
      </h2>
      {activity.length === 0 ? (
        <EmptyState title="No activity" description="There is no recent activity to show." />
      ) : (
        <ol className="space-y-2" aria-label="Recent activity">
          {activity.map((a) => (
            <li key={a.id} className="rounded-md border p-3">
              <p className="text-sm">{a.summary}</p>
              <p className="text-xs text-muted-foreground">
                {a.actorName} • {formatDate(a.occurredAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function NextActionsPanel({ actions }: { actions: WorkspaceNextAction[] }) {
  return (
    <section aria-labelledby="next-actions-heading" className="space-y-4">
      <h2 id="next-actions-heading" className="text-lg font-semibold">
        Next actions
      </h2>
      {actions.length === 0 ? (
        <EmptyState title="No next actions" description="You're all caught up." />
      ) : (
        <ul className="space-y-2" aria-label="Next actions">
          {actions.map((a) => (
            <li key={a.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.assigneeName ?? 'Unassigned'} • Due {formatDate(a.dueAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Shared UI
// ---------------------------------------------------------------------------

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-md border border-dashed p-8 text-center"
      role="status"
    >
      <FolderOpen className="mb-2 h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function WorkspaceLoadingSkeleton({ projectId }: { projectId: string }) {
  return (
    <main
      className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading project workspace"
    >
      <div className="flex items-center justify-between border-b pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7