export type ApiKeyScope =
  | "runs:read"
  | "runs:write"
  | "suites:read"
  | "suites:write"
  | "health:read"
  | "health:scan"
  | "admin:read"
  | "academy:read";

export interface ApiKey {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string; // e.g. "sct_live_a1b2..."
  scopes: ApiKeyScope[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
}

export interface CreateApiKeyRequest {
  workspaceId: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresInDays?: number;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  rawSecretKey: string; // Displayed ONCE to the user
}
