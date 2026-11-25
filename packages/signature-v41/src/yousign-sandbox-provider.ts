import type {
  CreateEnvelopeInput,
  ProviderEnvelope,
  SignatureEvidence,
  SignatureLevel,
  SignatureProvider,
  VerifiedSignatureEvent,
} from "./provider";

export type YousignSandboxConfig = Readonly<{
  apiKey: string;
  apiBaseUrl?: string;
  webhookSecret: string;
}>;

/**
 * YouSign sandbox adapter scaffold (credentials gate only).
 * Canonical runtime sandbox is `YousignSandboxSignatureProvider` in `./yousign-provider`.
 * Kept for unit coverage of the scaffold refusals — not re-exported from the package index.
 */
export class YousignSandboxScaffoldProvider implements SignatureProvider {
  readonly code = "YOUSIGN";
  readonly developmentOnly = false;
  readonly sandboxOnly = true;
  readonly supportedLevels = ["SIMPLE", "ADVANCED"] as const satisfies readonly SignatureLevel[];
  private readonly apiBaseUrl: string;

  constructor(private readonly config: YousignSandboxConfig) {
    if (!config.apiKey.trim() || config.apiKey.length < 16) throw new Error("SIGNATURE_PROVIDER_NOT_CONFIGURED");
    if (!config.webhookSecret.trim() || config.webhookSecret.length < 16) throw new Error("SIGNATURE_PROVIDER_NOT_CONFIGURED");
    this.apiBaseUrl = (config.apiBaseUrl ?? "https://api-sandbox.yousign.app/v3").replace(/\/$/u, "");
    try {
      const url = new URL(this.apiBaseUrl);
      if (url.protocol !== "https:" || !url.hostname.endsWith("yousign.app")) throw new Error("invalid");
    } catch {
      throw new Error("SIGNATURE_PROVIDER_NOT_CONFIGURED");
    }
  }

  async createEnvelope(_input: CreateEnvelopeInput): Promise<ProviderEnvelope> {
    // Sandbox HTTP wiring is intentionally not completed until DR-001 credentials are provisioned.
    throw new Error("SIGNATURE_PROVIDER_SANDBOX_NOT_ACTIVATED");
  }

  async sendEnvelope(_providerEnvelopeId: string, _idempotencyKey: string): Promise<ProviderEnvelope> {
    throw new Error("SIGNATURE_PROVIDER_SANDBOX_NOT_ACTIVATED");
  }

  async voidEnvelope(_providerEnvelopeId: string, _idempotencyKey: string): Promise<ProviderEnvelope> {
    throw new Error("SIGNATURE_PROVIDER_SANDBOX_NOT_ACTIVATED");
  }

  async verifyWebhook(_rawBody: Uint8Array, _headers: Readonly<Record<string, string>>, _receivedAt: Date): Promise<VerifiedSignatureEvent> {
    throw new Error("SIGNATURE_PROVIDER_SANDBOX_NOT_ACTIVATED");
  }

  async fetchEvidencePackage(_providerEnvelopeId: string): Promise<SignatureEvidence> {
    throw new Error("SIGNATURE_PROVIDER_SANDBOX_NOT_ACTIVATED");
  }
}
