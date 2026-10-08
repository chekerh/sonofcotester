import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { IsArray, IsInt, IsOptional, IsString } from "class-validator";
import type { ApiKeyScope } from "@sonofcotester/sdk";
import { ApiKeysService } from "./api-keys.service.js";

class CreateApiKeyDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsArray()
  scopes!: ApiKeyScope[];

  @IsOptional()
  @IsInt()
  expiresInDays?: number;
}

@Controller("workspace/api-keys")
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  listKeys(@Query("workspaceId") workspaceId?: string) {
    return this.apiKeysService.listKeys(workspaceId || "ws_internal");
  }

  @Post()
  createKey(@Body() body: CreateApiKeyDto) {
    return this.apiKeysService.createKey(
      body.workspaceId || "ws_internal",
      body.name,
      body.scopes,
      body.expiresInDays
    );
  }

  @Delete(":id")
  deleteKey(@Param("id") keyId: string) {
    return this.apiKeysService.deleteKey(keyId);
  }
}
