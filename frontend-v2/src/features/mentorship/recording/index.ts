export { SessionRecordingConsentPanel } from "./components/SessionRecordingConsentPanel";
export {
  canStartRecording,
  currentParticipant,
  hasAllRequiredConsent,
  providerReferenceIsOpaque,
} from "./domain";
export {
  sessionRecordingService,
  RecordingConsentError,
  recordingErrorMessage,
} from "./service";
export type * from "./types";
