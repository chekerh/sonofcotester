import { Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@sonofcotester/data";

export type UserRole = "ADMIN" | "ENGINEER" | "STUDENT" | "VIEWER";

export interface AuthenticatedUser {
  id: string;
  workspaceId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface AuthSession {
  token: string;
  user: AuthenticatedUser;
  workspace: {
    id: string;
    name: string;
    description: string;
  };
}

@Injectable()
export class AuthService {
  private inMemoryUsers: Map<string, AuthenticatedUser> = new Map([
    [
      "usr_admin",
      {
        id: "usr_admin",
        workspaceId: "ws_internal",
        email: "admin@sonofcotester.dev",
        name: "DevOps Lead",
        role: "ADMIN",
        createdAt: new Date().toISOString()
      }
    ],
    [
      "usr_eng",
      {
        id: "usr_eng",
        workspaceId: "ws_internal",
        email: "engineer@sonofcotester.dev",
        name: "Senior QA Engineer",
        role: "ENGINEER",
        createdAt: new Date().toISOString()
      }
    ],
    [
      "usr_student",
      {
        id: "usr_student",
        workspaceId: "ws_internal",
        email: "student@sonofcotester.dev",
        name: "Testing Student",
        role: "STUDENT",
        createdAt: new Date().toISOString()
      }
    ]
  ]);

  private sessions: Map<string, AuthenticatedUser> = new Map();

  constructor() {
    // Pre-populate default admin session
    const admin = this.inMemoryUsers.get("usr_admin")!;
    this.sessions.set("sct_session_admin_token", admin);
  }

  private hashPassword(password: string): string {
    return createHash("sha256").update(password).digest("hex");
  }

  async login(email: string, _password?: string): Promise<AuthSession> {
    // Find user in memory or DB
    let user: AuthenticatedUser | undefined;
    for (const u of this.inMemoryUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        user = u;
        break;
      }
    }

    if (!user) {
      // Auto-create for demo/commercial trials if not found
      const id = `usr_${randomBytes(4).toString("hex")}`;
      user = {
        id,
        workspaceId: "ws_internal",
        email,
        name: email.split("@")[0] || "User",
        role: email.includes("admin") ? "ADMIN" : email.includes("student") ? "STUDENT" : "ENGINEER",
        createdAt: new Date().toISOString()
      };
      this.inMemoryUsers.set(id, user);
    }

    const token = `sct_sess_${randomBytes(16).toString("hex")}`;
    this.sessions.set(token, user);

    return {
      token,
      user,
      workspace: {
        id: user.workspaceId,
        name: "Primary Commercial Workspace",
        description: "Production and autonomous testing environment"
      }
    };
  }

  async register(name: string, email: string, role: UserRole = "ENGINEER", workspaceName?: string): Promise<AuthSession> {
    const id = `usr_${randomBytes(4).toString("hex")}`;
    const workspaceId = workspaceName ? `ws_${randomBytes(4).toString("hex")}` : "ws_internal";

    const user: AuthenticatedUser = {
      id,
      workspaceId,
      email,
      name,
      role,
      createdAt: new Date().toISOString()
    };

    this.inMemoryUsers.set(id, user);
    const token = `sct_sess_${randomBytes(16).toString("hex")}`;
    this.sessions.set(token, user);

    return {
      token,
      user,
      workspace: {
        id: workspaceId,
        name: workspaceName || "Primary Commercial Workspace",
        description: "Production and autonomous testing environment"
      }
    };
  }

  async getCurrentUser(token?: string): Promise<AuthenticatedUser> {
    if (token && this.sessions.has(token)) {
      return this.sessions.get(token)!;
    }
    // Default to admin user for headless/dev calls
    return this.inMemoryUsers.get("usr_admin")!;
  }

  async listUsers(workspaceId: string = "ws_internal"): Promise<AuthenticatedUser[]> {
    return Array.from(this.inMemoryUsers.values()).filter((u) => u.workspaceId === workspaceId);
  }

  async switchWorkspace(userId: string, newWorkspaceId: string): Promise<AuthenticatedUser> {
    const user = this.inMemoryUsers.get(userId);
    if (!user) {
      throw new Error("User not found");
    }
    user.workspaceId = newWorkspaceId;
    this.inMemoryUsers.set(userId, user);
    return user;
  }
}
