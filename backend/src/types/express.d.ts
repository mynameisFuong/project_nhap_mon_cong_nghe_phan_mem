import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: Role;
      sessionId?: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
