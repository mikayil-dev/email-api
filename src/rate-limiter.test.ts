import { describe, expect, test } from "bun:test";

import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  test("bounds stored keys and recovers after expiry", () => {
    const limiter = new RateLimiter(2, 1000, 2);
    expect(limiter.isLimited("a", 0)).toBeFalse();
    expect(limiter.isLimited("b", 0)).toBeFalse();
    expect(limiter.isLimited("c", 1)).toBeTrue();
    expect(limiter.isLimited("a", 2)).toBeFalse();
    expect(limiter.isLimited("c", 1000)).toBeFalse();
  });

  test("a shared recipient budget is independent of sender IP", () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.isLimited("recipient@example.com", 0)).toBeFalse();
    expect(limiter.isLimited("recipient@example.com", 1)).toBeFalse();
    expect(limiter.isLimited("recipient@example.com", 2)).toBeTrue();
    expect(limiter.isLimited("other@example.com", 2)).toBeFalse();
  });
  test("limits a key within the window and resets afterwards", () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.isLimited("client", 0)).toBeFalse();
    expect(limiter.isLimited("client", 1)).toBeFalse();
    expect(limiter.isLimited("client", 2)).toBeTrue();
    expect(limiter.isLimited("client", 1000)).toBeFalse();
  });
});
