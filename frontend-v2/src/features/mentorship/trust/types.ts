/**
 * Trust indicators for issue MENTOR-014.
 */

/** Indicator families tracked for every student. */
export type TrustIndicatorKey =
  | 'completion'
  | 'verification'
  | 'response'
  | 'delivery'
  | 'safety';

export interface TrustIndicator {
  /** Relational key used by the API; never exposed in public endpoints. */
  internalId: string;
  /** Stable, collision-resistant identifier that is safe to expose. */
  publicId: string;
  /** Correlation identifier used to group retries and event logs. */
  correlationId: string;
  key: TrustIndicatorKey;
  /** Computed score from 0 to 100; never self-awarded. */
  score: number;
  /** Human-readable explanation of what the score means. */
  explanation: string;
  /** Internal records the score was derived from. */
  sourceIds: string[];
  /** Whether the derived activity was too sparse to trust. */
  sparseData: boolean;
}

export interface StudentTrustProfile {
  internalId: string;
  publicId: string;
  correlationId: string;
  studentId: string;
  completion: TrustIndicator;
  verification: TrustIndicator;
  response: TrustIndicator;
  delivery: TrustIndicator;
  safety: TrustIndicator;
  /** Derived completion percentage, from 0 to 100. */
  completionPercent: number;
}
