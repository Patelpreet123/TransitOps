import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";
import type { Role } from "../types/roles.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: Role;
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requireRoles(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: "You do not have permission to access this resource" });
      return;
    }

    next();
  };
}
