/**
 * Typed API boundary for CAPSTONE-085. Amounts cross the wire as decimal
 * strings of minor units so they never lose precision to JSON floats, and
 * private payloads are not part of the contract.
 */
import {
  viewStateForResult,
  type ConfirmFundingResult,
  type EscrowFunding,
  type FundingViewState,
  type ProviderObservation,
} from "./escrow-confirmation";

export interface FundingApiResponse {
  projectId: string;
  tenantId: string;
  agreementId: string;
  asset: string;
  destination: string;
  /** Decimal string, minor units. */
  expectedAmount: string;
  state: EscrowFunding["state"];
  revision: number;
  observation?: {
    provider: string;
    reference: string;
    finality: ProviderObservation["finality"];
    asset: string;
    destination: string;
    amount: string;
    observedAt: string;
  };
}

function minorUnits(value: string): bigint {
  if (!/^\d+$/.test(value)) throw new Error("Invalid amount format");
  return BigInt(value);
}

export function fromFundingApi(response: FundingApiResponse): EscrowFunding {
  return {
    projectId: response.projectId,
    tenantId: response.tenantId,
    agreementId: response.agreementId,
    asset: response.asset,
    destination: response.destination,
    expectedAmount: minorUnits(response.expectedAmount),
    state: response.state,
    revision: response.revision,
    ...(response.observation
      ? {
          observation: {
            ...response.observation,
            amount: minorUnits(response.observation.amount),
          },
        }
      : {}),
  };
}

export interface FundingPanelModel {
  state: FundingViewState;
  message: string;
  canConfirm: boolean;
  retryable: boolean;
}

const MESSAGES: Record<FundingViewState, string> = {
  loading: "Loading escrow funding status…",
  empty: "No funding has been recorded for this project yet.",
  error: "Funding could not be confirmed. Review the message and try again.",
  conflict: "This funding changed elsewhere. Reload before retrying.",
  success: "Funding is confirmed and available for this project.",
};

/** Single source of truth for the five explicit UI states. */
export function fundingPanelModel(
  result: ConfirmFundingResult | undefined,
  options: { pending?: boolean; canConfirm?: boolean } = {},
): FundingPanelModel {
  const state = viewStateForResult(result, options.pending);
  const detail = result && !result.ok ? ` ${result.message}` : "";
  return {
    state,
    message: `${MESSAGES[state]}${detail}`,
    canConfirm: Boolean(options.canConfirm) && (state === "empty" || state === "error" || state === "conflict"),
    retryable: state === "error" || state === "conflict",
  };
}
