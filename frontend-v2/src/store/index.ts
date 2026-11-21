/**
 * #108 Refactor: Global Store Index
 * Central entry point for application-wide state management.
 *
 * CAPSTONE-063 / CAPSTONE-065 / CAPSTONE-068:
 * Adds a project-scoped UI slice for the capstone & research-project workspace.
 * This slice is intentionally UI-only and non-persisted:
 *  - No resource contents, member PII, or audit payloads are stored here.
 *  - It is reset on tenant/identity change so state cannot leak across tenants.
 */

import { create } from 'zustand';

// 1. Exporting types for Global State
export interface GlobalState {
  isSidebarOpen: boolean;
  theme: 'light' | 'dark';
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const INITIAL_STATE: GlobalState = {
  isSidebarOpen: true,
  theme: 'light',
  notifications: [],
};

export const useGlobalStore = create<GlobalState>(() => INITIAL_STATE);

// ---------------------------------------------------------------------------
// 2. Project-scoped UI slice (CAPSTONE-063 / CAPSTONE-065 / CAPSTONE-068)
// ---------------------------------------------------------------------------

/** Workspace tabs available within an active project. */
export type WorkspaceTab =
  | 'overview'
  | 'members'
  | 'objectives'
  | 'milestones'
  | 'resources'
  | 'activity';

/** Timeline grouping preferences (CAPSTONE-063). */
export type TimelineGrouping = 'none' | 'objective' | 'milestone' | 'owner';

/** Timeline entry kinds surfaced by the roadmap (CAPSTONE-063). */
export type TimelineEntryKind =
  | 'objective'
  | 'task'
  | 'milestone'
  | 'decision'
  | 'review'
  | 'funding'
  | 'charter';

/** Resource-library filter state (CAPSTONE-068). UI-only, no contents. */
export interface ResourceLibraryFilters {
  /** Free-text query; never persisted, never logged. */
  query: string;
  /** Selected resource kinds (file, dataset, link, citation). */
  kinds: Array<'file' | 'dataset' | 'link' | 'citation'>;
  /** Selected license identifiers. */
  licenses: string[];
  /** Whether to show only resources the current user can access. */
  accessibleOnly: boolean;
}

export interface ProjectUiState {
  /** Active project id, or null when no project is selected. */
  activeProjectId: string | null;
  /** Currently selected workspace tab. */
  selectedTab: WorkspaceTab;
  /** Timeline filter: which entry kinds are visible. */
  timelineKinds: TimelineEntryKind[];
  /** Timeline grouping preference. */
  timelineGrouping: TimelineGrouping;
  /** Resource-library filter state. */
  resourceFilters: ResourceLibraryFilters;
}

export const INITIAL_PROJECT_UI_STATE: ProjectUiState = {
  activeProjectId: null,
  selectedTab: 'overview',
  timelineKinds: [
    'objective',
    'task',
    'milestone',
    'decision',
    'review',
    'funding',
    'charter',
  ],
  timelineGrouping: 'none',
  resourceFilters: {
    query: '',
    kinds: [],
    licenses: [],
    accessibleOnly: true,
  },
};

export interface ProjectUiActions {
  /** Set the active project; resets tab/filters to avoid cross-project bleed. */
  setActiveProject: (projectId: string | null) => void;
  /** Select a workspace tab. */
  setSelectedTab: (tab: WorkspaceTab) => void;
  /** Toggle a timeline entry kind on/off. */
  toggleTimelineKind: (kind: TimelineEntryKind) => void;
  /** Replace the visible timeline entry kinds. */
  setTimelineKinds: (kinds: TimelineEntryKind[]) => void;
  /** Set the timeline grouping preference. */
  setTimelineGrouping: (grouping: TimelineGrouping) => void;
  /** Merge a partial update into the resource-library filters. */
  setResourceFilters: (filters: Partial<ResourceLibraryFilters>) => void;
  /** Reset the entire project UI slice (e.g. on tenant/identity change). */
  resetProjectUi: () => void;
}

export type ProjectUiStore = ProjectUiState & ProjectUiActions;

export const useProjectUiStore = create<ProjectUiStore>((set) => ({
  ...INITIAL_PROJECT_UI_STATE,

  setActiveProject: (projectId) =>
    set((state) => {
      if (state.activeProjectId === projectId) {
        return state;
      }
      // Switching projects resets tab and filters so stale UI state from a
      // previous project cannot carry over.
      return {
        ...state,
        activeProjectId: projectId,
        selectedTab: INITIAL_PROJECT_UI_STATE.selectedTab,
        timelineKinds: [...INITIAL_PROJECT_UI_STATE.timelineKinds],
        timelineGrouping: INITIAL_PROJECT_UI_STATE.timelineGrouping,
        resourceFilters: { ...INITIAL_PROJECT_UI_STATE.resourceFilters },
      };
    }),

  setSelectedTab: (tab) => set({ selectedTab: tab }),

  toggleTimelineKind: (kind) =>
    set((state) => {
      const has = state.timelineKinds.includes(kind);
      return {
        timelineKinds: has
          ? state.timelineKinds.filter((k) => k !== kind)
          : [...state.timelineKinds, kind],
      };
    }),

  setTimelineKinds: (kinds) => set({ timelineKinds: [...kinds] }),

  setTimelineGrouping: (grouping) => set({ timelineGrouping: grouping }),

  setResourceFilters: (filters) =>
    set((state) => ({
      resourceFilters: { ...state.resourceFilters, ...filters },
    })),

  resetProjectUi: () =>
    set({
      ...INITIAL_PROJECT_UI_STATE,
      timelineKinds: [...INITIAL_PROJECT_UI_STATE.timelineKinds],
      resourceFilters: { ...INITIAL_PROJECT_UI_STATE.resourceFilters },
    }),
}));

/**
 * Reset the project-scoped UI slice. Call this whenever the tenant or
 * authenticated identity changes so no project UI state leaks across tenants.
 */
export function resetProjectUiOnTenantChange(): void {
  useProjectUiStore.getState().resetProjectUi();
}
</｜｜DSML｜｜ parameter>
</｜｜DSML｜｜ invoke>
</｜｜DSML｜｜ calls>