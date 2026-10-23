import { ErrorEnvelopeSchema, type ErrorCode } from "@sonevibe/shared";

export class ApiError extends Error {
  readonly code: ErrorCode | "UNEXPECTED_RESPONSE" | "NETWORK";
  readonly retryable: boolean;
  readonly status: number;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;

  constructor(options: {
    message: string;
    code: ApiError["code"];
    retryable: boolean;
    status: number;
    requestId?: string;
    retryAfterSeconds?: number;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function toApiError(response: Response, payload: unknown): ApiError {
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
  const parsed = ErrorEnvelopeSchema.safeParse(payload);
  if (parsed.success) {
    return new ApiError({
      message: parsed.data.error.message,
      code: parsed.data.error.code,
      retryable: parsed.data.error.retryable,
      status: response.status,
      requestId: parsed.data.error.requestId,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
    });
  }
  return new ApiError({
    message: "Something went wrong. Please try again.",
    code: "UNEXPECTED_RESPONSE",
    retryable: true,
    status: response.status,
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
