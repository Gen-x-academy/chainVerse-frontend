import { create } from "zustand";
import type {
  ScholarshipProgram,
  ScholarshipApplication,
  ReviewItem,
  DisbursementRecord,
  ScholarshipFilters,
  ApplicationFilters,
  CreateProgramPayload,
  SubmitApplicationPayload,
  ReviewDecisionPayload,
  InitiateDisbursementPayload,
} from "@/types/scholarship.types";
import { scholarshipApi } from "@/lib/api/scholarship.api";

// ─── Async state helpers ───────────────────────────────────────────────────────

interface AsyncState {
  loading: boolean;
  error: string | null;
}

function idle(): AsyncState {
  return { loading: false, error: null };
}

// ─── Slice: Programs (public + sponsor) ───────────────────────────────────────

interface ProgramsSlice extends AsyncState {
  programs: ScholarshipProgram[];
  selectedProgram: ScholarshipProgram | null;
  filters: ScholarshipFilters;
  // actions
  fetchPrograms: (filters?: ScholarshipFilters) => Promise<void>;
  fetchProgramById: (id: string) => Promise<void>;
  createProgram: (payload: CreateProgramPayload) => Promise<ScholarshipProgram>;
  publishProgram: (id: string) => Promise<void>;
  closeProgram: (id: string) => Promise<void>;
  setFilters: (filters: ScholarshipFilters) => void;
  clearSelectedProgram: () => void;
}

// ─── Slice: Applications (student) ───────────────────────────────────────────

interface ApplicationsSlice extends AsyncState {
  myApplications: ScholarshipApplication[];
  selectedApplication: ScholarshipApplication | null;
  appFilters: ApplicationFilters;
  // actions
  fetchMyApplications: () => Promise<void>;
  fetchApplicationById: (id: string) => Promise<void>;
  submitApplication: (payload: SubmitApplicationPayload) => Promise<ScholarshipApplication>;
  withdrawApplication: (id: string) => Promise<void>;
  setAppFilters: (filters: ApplicationFilters) => void;
  clearSelectedApplication: () => void;
}

// ─── Slice: Review queue (reviewer) ──────────────────────────────────────────

interface ReviewSlice extends AsyncState {
  reviewQueue: ReviewItem[];
  // actions
  fetchReviewQueue: () => Promise<void>;
  submitReviewDecision: (payload: ReviewDecisionPayload) => Promise<void>;
}

// ─── Slice: Disbursements (finance) ──────────────────────────────────────────

interface DisbursementSlice extends AsyncState {
  disbursements: DisbursementRecord[];
  // actions
  fetchDisbursements: () => Promise<void>;
  initiateDisbursement: (payload: InitiateDisbursementPayload) => Promise<void>;
  markDisbursementPaid: (id: string, txHash: string) => Promise<void>;
}

// ─── Slice: Admin overview ───────────────────────────────────────────────────

export interface AdminStats {
  totalPrograms: number;
  openPrograms: number;
  totalApplications: number;
  pendingReview: number;
  totalDisbursed: number;
  currency: string;
}

interface AdminSlice extends AsyncState {
  adminStats: AdminStats | null;
  allApplications: ScholarshipApplication[];
  // actions
  fetchAdminStats: () => Promise<void>;
  fetchAllApplications: (filters?: ApplicationFilters) => Promise<void>;
  cancelProgram: (id: string) => Promise<void>;
}

// ─── Combined store type ──────────────────────────────────────────────────────

type ScholarshipStore = ProgramsSlice &
  ApplicationsSlice &
  ReviewSlice &
  DisbursementSlice &
  AdminSlice;

// ─── Store implementation ─────────────────────────────────────────────────────

export const useScholarshipStore = create<ScholarshipStore>((set, get) => ({
  // ── Programs slice ─────────────────────────────────────────────────────────
  programs: [],
  selectedProgram: null,
  filters: { status: "all", category: "all", search: "" },
  ...idle(),

  fetchPrograms: async (filters) => {
    set({ loading: true, error: null });
    try {
      const activeFilters = filters ?? get().filters;
      const programs = await scholarshipApi.getPrograms(activeFilters);
      set({ programs, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  fetchProgramById: async (id) => {
    set({ loading: true, error: null });
    try {
      const program = await scholarshipApi.getProgramById(id);
      set({ selectedProgram: program, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  createProgram: async (payload) => {
    set({ loading: true, error: null });
    try {
      const program = await scholarshipApi.createProgram(payload);
      set((state) => ({
        programs: [program, ...state.programs],
        loading: false,
      }));
      return program;
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  publishProgram: async (id) => {
    set({ loading: true, error: null });
    try {
      const updated = await scholarshipApi.updateProgramStatus(id, "open");
      set((state) => ({
        programs: state.programs.map((p) => (p.id === id ? updated : p)),
        selectedProgram: state.selectedProgram?.id === id ? updated : state.selectedProgram,
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  closeProgram: async (id) => {
    set({ loading: true, error: null });
    try {
      const updated = await scholarshipApi.updateProgramStatus(id, "closed");
      set((state) => ({
        programs: state.programs.map((p) => (p.id === id ? updated : p)),
        selectedProgram: state.selectedProgram?.id === id ? updated : state.selectedProgram,
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  setFilters: (filters) => set({ filters }),
  clearSelectedProgram: () => set({ selectedProgram: null }),

  // ── Applications slice ─────────────────────────────────────────────────────
  myApplications: [],
  selectedApplication: null,
  appFilters: { status: "all", search: "" },

  fetchMyApplications: async () => {
    set({ loading: true, error: null });
    try {
      const apps = await scholarshipApi.getMyApplications();
      set({ myApplications: apps, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  fetchApplicationById: async (id) => {
    set({ loading: true, error: null });
    try {
      const app = await scholarshipApi.getApplicationById(id);
      set({ selectedApplication: app, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  submitApplication: async (payload) => {
    set({ loading: true, error: null });
    try {
      const app = await scholarshipApi.submitApplication(payload);
      set((state) => ({
        myApplications: [app, ...state.myApplications],
        loading: false,
      }));
      return app;
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  withdrawApplication: async (id) => {
    set({ loading: true, error: null });
    try {
      await scholarshipApi.withdrawApplication(id);
      set((state) => ({
        myApplications: state.myApplications.filter((a) => a.id !== id),
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  setAppFilters: (filters) => set({ appFilters: filters }),
  clearSelectedApplication: () => set({ selectedApplication: null }),

  // ── Review slice ───────────────────────────────────────────────────────────
  reviewQueue: [],

  fetchReviewQueue: async () => {
    set({ loading: true, error: null });
    try {
      const queue = await scholarshipApi.getReviewQueue();
      set({ reviewQueue: queue, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  submitReviewDecision: async (payload) => {
    set({ loading: true, error: null });
    try {
      await scholarshipApi.submitReviewDecision(payload);
      set((state) => ({
        reviewQueue: state.reviewQueue.filter(
          (r) => r.applicationId !== payload.applicationId
        ),
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  // ── Disbursement slice ────────────────────────────────────────────────────
  disbursements: [],

  fetchDisbursements: async () => {
    set({ loading: true, error: null });
    try {
      const disbursements = await scholarshipApi.getDisbursements();
      set({ disbursements, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  initiateDisbursement: async (payload) => {
    set({ loading: true, error: null });
    try {
      const record = await scholarshipApi.initiateDisbursement(payload);
      set((state) => ({
        disbursements: [record, ...state.disbursements],
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  markDisbursementPaid: async (id, txHash) => {
    set({ loading: true, error: null });
    try {
      const updated = await scholarshipApi.markDisbursementPaid(id, txHash);
      set((state) => ({
        disbursements: state.disbursements.map((d) =>
          d.id === id ? updated : d
        ),
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  // ── Admin slice ───────────────────────────────────────────────────────────
  adminStats: null,
  allApplications: [],

  fetchAdminStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await scholarshipApi.getAdminStats();
      set({ adminStats: stats, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  fetchAllApplications: async (filters) => {
    set({ loading: true, error: null });
    try {
      const apps = await scholarshipApi.getAllApplications(filters);
      set({ allApplications: apps, loading: false });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  cancelProgram: async (id) => {
    set({ loading: true, error: null });
    try {
      const updated = await scholarshipApi.updateProgramStatus(id, "cancelled");
      set((state) => ({
        programs: state.programs.map((p) => (p.id === id ? updated : p)),
        loading: false,
      }));
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },
}));
