import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "change-me-in-production";

export function signAdminToken(): string {
  return jwt.sign({ role: "admin" }, SECRET, { expiresIn: "7d" });
}

export function verifyAdminToken(token: string): boolean {
  try {
    console.log('jwt.ts', token)
    const p = jwt.verify(token, SECRET) as { role?: string };
    return p.role === "admin";
  } catch {
    return false;
  }
}
