import { Injectable } from "@nestjs/common";
import {
  createApiKey,
  deleteApiKey,
  listApiKeys,
  validateApiKey
} from "@sonofcotester/data";
import type { ApiKey, ApiKeyScope } from "@sonofcotester/sdk";

@Injectable()
export class ApiKeysService {
  async listKeys(workspaceId: string = "ws_internal"): Promise<ApiKey[]> {
    return listApiKeys(workspaceId);
  }

  async createKey(
    workspaceId: string = "ws_internal",
    name: string,
    scopes: ApiKeyScope[],
    expiresInDays?: number
  ): Promise<{ apiKey: ApiKey; rawSecretKey: string }> {
    return createApiKey(workspaceId, name, scopes, expiresInDays);
  }

  async validateKey(rawKey: string): Promise<{ valid: boolean; apiKey?: ApiKey }> {
    return validateApiKey(rawKey);
  }

  async deleteKey(keyId: string): Promise<{ deleted: boolean }> {
    return deleteApiKey(keyId);
  }
}
