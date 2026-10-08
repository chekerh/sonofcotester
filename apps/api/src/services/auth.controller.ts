import { Body, Controller, Get, Headers, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { AuthService, type UserRole } from "./auth.service.js";

class LoginDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  password?: string;
}

class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(["ADMIN", "ENGINEER", "STUDENT", "VIEWER"])
  role?: UserRole;

  @IsOptional()
  @IsString()
  workspaceName?: string;
}

class SwitchWorkspaceDto {
  @IsString()
  userId!: string;

  @IsString()
  workspaceId!: string;
}

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Post("login")
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Post("register")
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.name, body.email, body.role || "ENGINEER", body.workspaceName);
  }

  @Get("me")
  @SkipThrottle()
  async me(@Headers("authorization") authHeader?: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    return this.authService.getCurrentUser(token);
  }

  @Get("users")
  async listUsers(@Headers("authorization") authHeader?: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    const user = await this.authService.getCurrentUser(token);
    if (user.role !== "ADMIN") {
      throw new UnauthorizedException("Only workspace administrators can view team members");
    }
    return this.authService.listUsers(user.workspaceId);
  }

  @Post("switch-workspace")
  async switchWorkspace(@Body() body: SwitchWorkspaceDto) {
    return this.authService.switchWorkspace(body.userId, body.workspaceId);
  }

  @Post("logout")
  async logout() {
    return { success: true, message: "Logged out successfully" };
  }
}
