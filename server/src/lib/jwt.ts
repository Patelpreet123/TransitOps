import jwt from "jsonwebtoken";
import type { Role } from "../types/roles.js";

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: Role;
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}
