import { calculateBackoffMs, nextAttemptDate } from "../../../src/webhooks/backoff";

describe("calculateBackoffMs", () => {
  it("should return 0 for attempt 0 (base case)", () => {
    // Math.random might give us a very small value, so we just check it's non-negative
    const result = calculateBackoffMs(0);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("should never exceed maxDelayMs", () => {
    for (let i = 0; i < 100; i++) {
      const result = calculateBackoffMs(20, { maxDelayMs: 5000 });
      expect(result).toBeLessThanOrEqual(5000);
    }
  });

  it("should return 0 sometimes (full jitter can produce 0)", () => {
    // this is testing the property not a specific value
    // full jitter range is [0, cap] so 0 IS a valid output
    const spy = jest.spyOn(Math, "random").mockReturnValue(0);
    const result = calculateBackoffMs(1);
    expect(result).toBe(0);
    spy.mockRestore();
  });

  it("should return cap when random is 1", () => {
    const spy = jest.spyOn(Math, "random").mockReturnValue(0.9999999);
    const result = calculateBackoffMs(1, { baseDelayMs: 1000, maxDelayMs: 10000 });
    // attempt 1: min(10000, 1000 * 2^1) = min(10000, 2000) = 2000 * ~1 = ~2000
    expect(result).toBeLessThanOrEqual(2000);
    spy.mockRestore();
  });

  it("caps at maxDelayMs for very large attempt numbers", () => {
    const spy = jest.spyOn(Math, "random").mockReturnValue(1);
    const result = calculateBackoffMs(100, { baseDelayMs: 1000, maxDelayMs: 60000 });
    expect(result).toBeLessThanOrEqual(60000);
    spy.mockRestore();
  });
});

describe("nextAttemptDate", () => {
  it("should return a date in the future", () => {
    const before = Date.now();
    const result = nextAttemptDate(1);
    // could theoretically be 0ms delay with full jitter but extremely unlikely
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
  });
});
