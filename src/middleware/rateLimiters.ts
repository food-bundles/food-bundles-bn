import rateLimit from "express-rate-limit";

/**
 * Rate limiter for public, unauthenticated payment-link routes.
 * Scoped narrowly to these routes only — not applied globally.
 */
export const paymentLinkRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests. Please try again in a minute.",
  },
});
