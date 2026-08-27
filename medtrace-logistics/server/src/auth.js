import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "medtrace-dev-secret-change-me";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Mirrors the RLS on the Company entity: only the platform admin may create companies.
export function requirePlatformAdmin(req, res, next) {
  if (req.auth?.role !== "admin") {
    return res.status(403).json({ error: "Platform admin only" });
  }
  next();
}
