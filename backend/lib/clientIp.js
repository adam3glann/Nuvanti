import { isIP } from "node:net";

function validIp(value) {
  const ip = String(value || "").trim();
  return isIP(ip) ? ip : null;
}

export function getClientIp(req) {
  if (req?.clientIpUnavailable) return null;
  return (
    validIp(req?.trustedClientIp) ||
    validIp(req?.railwayClientIp) ||
    validIp(req?.ip) ||
    validIp(req?.socket?.remoteAddress)
  );
}

export function trustRailwayClientIp(req, res, next) {
  if (req.trustedClientIp) return next();
  if (!process.env.RAILWAY_PUBLIC_DOMAIN) return next();

  // Storefront API calls pass through Cloudflare Pages. Their real client IP
  // is accepted only after the Pages Function's HMAC has been verified.
  // Railway's X-Real-IP is the correct source for requests made directly to
  // the Railway-hosted admin app.
  if (req.storefrontOriginRequest) {
    req.clientIpUnavailable = true;
    return next();
  }

  const ip = validIp(req.get("X-Real-IP"));
  if (ip) {
    req.railwayClientIp = ip;
    Object.defineProperty(req, "ip", {
      configurable: true,
      value: ip,
    });
  }
  next();
}
