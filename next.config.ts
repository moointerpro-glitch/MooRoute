import type { NextConfig } from "next";

// Production-only policy: Next.js development mode needs eval, and inline scripts carry hydration data.
// External scripts, frames, plugins and cross-site form posts are blocked. HSTS belongs on the TLS proxy.
const contentSecurityPolicy = ["default-src 'self'", "script-src 'self' 'unsafe-inline'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:", "font-src 'self'", "connect-src 'self'",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join("; ");
const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [
      { source: "/:path*", headers: common },
      // Private attachment downloads set their own stricter sandbox policy.
      ...(process.env.NODE_ENV === "production" ? [{ source: "/((?!api/attachments/).*)", headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }] }] : []),
    ];
  },
};
export default nextConfig;
