export type DocumentScanErrorCode =
  | "DOCUMENT_SCAN_EVENT_INVALID"
  | "DOCUMENT_SCAN_JOB_UNAVAILABLE"
  | "DOCUMENT_SCAN_JOB_INVALID"
  | "DOCUMENT_DOWNLOAD_FAILED"
  | "DOCUMENT_TOO_LARGE"
  | "DOCUMENT_MIME_UNSUPPORTED"
  | "DOCUMENT_EVIDENCE_MISMATCH"
  | "ANTIVIRUS_CONFIG_INVALID"
  | "ANTIVIRUS_UNAVAILABLE"
  | "ANTIVIRUS_RESPONSE_INVALID"
  | "ANTIVIRUS_VERSION_UNVERIFIED"
  | "ANTIVIRUS_DATABASE_STALE"
  | "ANTIVIRUS_SCAN_REPORTED_ERROR"
  | "DOCUMENT_SCAN_RECORD_FAILED";

export class DocumentScanError extends Error {
  readonly code: DocumentScanErrorCode;
  readonly retryable: boolean;

  constructor(code: DocumentScanErrorCode, retryable = false) {
    super(code);
    this.name = "DocumentScanError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function scanErrorCode(error: unknown): DocumentScanErrorCode {
  return error instanceof DocumentScanError ? error.code : "DOCUMENT_SCAN_RECORD_FAILED";
}

export function isRetryableScanError(error: unknown): boolean {
  return error instanceof DocumentScanError && error.retryable;
}
