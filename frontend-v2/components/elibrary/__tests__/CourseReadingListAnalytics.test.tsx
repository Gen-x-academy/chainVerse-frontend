import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  CourseReadingListAnalytics,
  type AdoptionEntry,
  type DemandEntry,
  type AvailabilityGap,
  type ReserveUsage,
  type EngagementMetric,
} from "../CourseReadingListAnalytics";

const mockAdoption: AdoptionEntry[] = [
  {
    courseId: "c1",
    courseName: "Intro to Blockchain",
    enrolledCount: 120,
    activeReaders: 85,
    adoptionRate: 71,
  },
];

const mockDemand: DemandEntry[] = [
  {
    itemId: "item-1",
    title: "Mastering Ethereum",
    requestsCount: 34,
    holdsCount: 5,
    waitlistDepth: 12,
  },
];

const mockAvailabilityGaps: AvailabilityGap[] = [
  {
    itemId: "item-2",
    title: "Solidity Patterns",
    required: true,
    available: false,
    reason: "All copies on loan",
  },
];

const mockReserveUsage: ReserveUsage[] = [
  {
    itemId: "item-3",
    title: "DeFi Handbook",
    totalReserves: 20,
    activeReserves: 8,
    avgReservationDurationDays: 4.5,
  },
];

const mockEngagement: EngagementMetric[] = [
  {
    label: "Overall",
    totalSessions: 450,
    avgSessionMinutes: 22,
    completionRate: 68,
  },
];

describe("CourseReadingListAnalytics", () => {
  it("renders loading state with aria-busy", () => {
    render(
      <CourseReadingListAnalytics courseId="c1" courseName="Course" isLoading />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading analytics")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        error="Network timeout"
      />
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Error loading analytics")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
  });

  it("renders empty state when no data", () => {
    render(
      <CourseReadingListAnalytics courseId="c1" courseName="My Course" />
    );
    expect(
      screen.getByText(/No reading-list analytics available for My Course/)
    ).toBeInTheDocument();
  });

  it("renders adoption table with data", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Blockchain 101"
        adoption={mockAdoption}
      />
    );
    expect(screen.getByText("Blockchain 101")).toBeInTheDocument();
    expect(screen.getByText("Intro to Blockchain")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
  });

  it("renders demand table with data", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        demand={mockDemand}
      />
    );
    expect(screen.getByText("Mastering Ethereum")).toBeInTheDocument();
    expect(screen.getByText("34")).toBeInTheDocument();
  });

  it("renders availability gaps", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        availabilityGaps={mockAvailabilityGaps}
      />
    );
    expect(screen.getByText("Solidity Patterns")).toBeInTheDocument();
    expect(screen.getByText("All copies on loan")).toBeInTheDocument();
  });

  it("shows all-clear when no gaps but other data present", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        adoption={mockAdoption}
        availabilityGaps={[]}
      />
    );
    expect(
      screen.getByText("All required items are currently available.")
    ).toBeInTheDocument();
  });

  it("renders reserve usage table", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        reserveUsage={mockReserveUsage}
      />
    );
    expect(screen.getByText("DeFi Handbook")).toBeInTheDocument();
    expect(screen.getByText("4.5")).toBeInTheDocument();
  });

  it("renders engagement metrics", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        engagement={mockEngagement}
      />
    );
    expect(screen.getByText("450")).toBeInTheDocument();
    expect(screen.getByText("22 min avg")).toBeInTheDocument();
    expect(screen.getByText("68% completion")).toBeInTheDocument();
  });

  it("renders period label", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        adoption={mockAdoption}
        periodLabel="Fall 2026"
      />
    );
    expect(screen.getByText("Fall 2026")).toBeInTheDocument();
  });

  it("renders per-section empty states when some data arrays are empty but others have entries", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        adoption={mockAdoption}
        demand={[]}
        reserveUsage={[]}
        engagement={[]}
        availabilityGaps={[]}
      />
    );
    expect(
      screen.getByText("No demand data available.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No reserve usage data.")
    ).toBeInTheDocument();
  });

  it("renders overall empty state when all arrays are empty", () => {
    render(
      <CourseReadingListAnalytics
        courseId="c1"
        courseName="Course"
        adoption={[]}
        demand={[]}
        reserveUsage={[]}
        engagement={[]}
        availabilityGaps={[]}
      />
    );
    expect(
      screen.getByText(/No reading-list analytics available for Course/)
    ).toBeInTheDocument();
  });
});
