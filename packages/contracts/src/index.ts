export type ApiError = Readonly<{ code: string; message: string; correlationId: string; fieldErrors?: Readonly<Record<string, readonly string[]>> }>;

export * from "./command-result";
