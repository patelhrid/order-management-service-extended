import axios from "axios";
import { dispatchWebhook } from "../../../src/webhooks/dispatcher";
import { IWebhookJob } from "../../../src/models/WebhookJob";

jest.mock("axios");
jest.mock("../../../src/utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockAxiosPost = axios.post as jest.MockedFunction<typeof axios.post>;

function makeJob(overrides: Partial<IWebhookJob> = {}): IWebhookJob {
  return {
    _id: "abc123",
    url: "https://example.com/webhook",
    payload: { orderId: "ord_1" },
    eventType: "order.created",
    attemptCount: 0,
    maxAttempts: 8,
    correlationId: "corr-001",
    headers: {},
    ...overrides,
  } as unknown as IWebhookJob;
}

describe("dispatchWebhook", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns success=true for 200 response", async () => {
    mockAxiosPost.mockResolvedValue({ status: 200, data: {} });
    const result = await dispatchWebhook(makeJob());
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it("returns success=false and retryable for 503", async () => {
    mockAxiosPost.mockResolvedValue({ status: 503, data: "service unavailable" });
    const result = await dispatchWebhook(makeJob());
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("503");
  });

  it("marks non-retryable for 400", async () => {
    mockAxiosPost.mockResolvedValue({ status: 400, data: "bad request" });
    const result = await dispatchWebhook(makeJob());
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("Non-retryable");
  });

  it("returns success=false on network error", async () => {
    mockAxiosPost.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await dispatchWebhook(makeJob());
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("ECONNREFUSED");
  });

  it("includes attempt number in headers", async () => {
    mockAxiosPost.mockResolvedValue({ status: 200, data: {} });
    await dispatchWebhook(makeJob({ attemptCount: 3 } as Partial<IWebhookJob>));
    const callArgs = mockAxiosPost.mock.calls[0];
    // headers are the 3rd argument options object
    expect((callArgs[2] as any).headers["X-Attempt-Number"]).toBe("4");
  });
});
