import { describe, expect, test } from "bun:test";

import { RateLimiter } from "./rate-limiter";

describe("RateLimiter", () => {
  test("limits a key within the window and resets afterwards", () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.isLimited("client", 0)).toBeFalse();
    expect(limiter.isLimited("client", 1)).toBeFalse();
    expect(limiter.isLimited("client", 2)).toBeTrue();
    expect(limiter.isLimited("client", 1000)).toBeFalse();
  });
});
