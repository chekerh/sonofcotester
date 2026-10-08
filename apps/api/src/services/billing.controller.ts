import { Body, Controller, Headers, Inject, Post } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { PlanTier } from "@sonofcotester/sdk";
import { BillingService } from "./billing.service.js";

class CreateCheckoutDto {
  @IsString()
  workspaceId!: string;

  @IsIn(["student_free", "pro", "team", "enterprise"])
  tier!: PlanTier;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  successUrl?: string;

  @IsOptional()
  @IsString()
  cancelUrl?: string;
}

class CustomerPortalDto {
  @IsString()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}

@Controller("billing")
export class BillingController {
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  @Post("create-checkout-session")
  async createCheckoutSession(@Body() body: CreateCheckoutDto) {
    return this.billingService.createCheckoutSession(
      body.workspaceId,
      body.tier,
      body.currency || "usd",
      body.successUrl,
      body.cancelUrl
    );
  }

  @Post("customer-portal")
  async createCustomerPortal(@Body() body: CustomerPortalDto) {
    return this.billingService.createCustomerPortalSession(body.workspaceId, body.returnUrl);
  }

  @Post("webhook")
  @SkipThrottle()
  async handleWebhook(@Body() event: any, @Headers("stripe-signature") signature?: string) {
    return this.billingService.handleWebhook(event, signature);
  }
}
