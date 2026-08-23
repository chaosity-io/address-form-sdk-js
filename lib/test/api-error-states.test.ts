import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationStore } from "../stores/notificationStore";
import { autocomplete, suggest } from "../utils/api";

/**
 * What the user is told when a request fails (#2).
 *
 * Every failure used to produce the same line — "… is currently unavailable" —
 * which was wrong in both directions: it told someone with a bad API key to wait,
 * and it told someone whose network blipped that our service was down.
 *
 * The cancellation case matters most. The client now aborts a superseded request
 * on every keystroke, so a notification per abort would fire a stream of errors
 * at someone who is simply still typing.
 */

const clientThatThrows = (error: unknown) =>
  ({
    send: vi.fn(async () => {
      throw error;
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const clientError = (code: string, statusCode?: number) =>
  Object.assign(new Error(code), {
    name: "LocationServiceException",
    code,
    statusCode,
  });

let added: { id: string; message: string; type: string }[];

beforeEach(() => {
  added = [];
  vi.spyOn(useNotificationStore, "getState").mockReturnValue({
    addNotification: (n: { id: string; message: string; type: string }) => added.push(n),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cancellation is not a failure", () => {
  it("says nothing at all when a request is aborted", async () => {
    const client = clientThatThrows(clientError("AbortedException"));

    await expect(autocomplete(client, { QueryText: "mart" })).rejects.toBeTruthy();
    expect(added).toHaveLength(0);
  });
});

describe("each failure class says something different and true", () => {
  it("tells the user to check their connection on a timeout", async () => {
    const client = clientThatThrows(clientError("TimeoutException"));
    await expect(autocomplete(client, { QueryText: "a" })).rejects.toBeTruthy();
    expect(added[0].message).toContain("Check your connection");
  });

  it("says to wait a moment when throttled, not that we are broken", async () => {
    const client = clientThatThrows(clientError("ThrottlingException", 429));
    await expect(suggest(client, { QueryText: "a" })).rejects.toBeTruthy();
    expect(added[0].message).toContain("Too many requests");
    expect(added[0].message).not.toContain("currently unavailable");
  });

  it("points at application configuration on 403, not at our uptime", async () => {
    const client = clientThatThrows(clientError("ForbiddenException", 403));
    await expect(autocomplete(client, { QueryText: "a" })).rejects.toBeTruthy();
    expect(added[0].message).toContain("Check its configuration");
  });

  it("falls back to the generic message for an unrecognised error", async () => {
    const client = clientThatThrows(new Error("something odd"));
    await expect(autocomplete(client, { QueryText: "a" })).rejects.toBeTruthy();
    expect(added[0].message).toContain("currently unavailable");
  });
});

describe("transport options reach the client", () => {
  it("forwards the AbortSignal into send", async () => {
    const send = vi.fn(async () => ({ ResultItems: [] }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = { send } as any;
    const controller = new AbortController();

    await autocomplete(client, { QueryText: "a" }, { signal: controller.signal });

    expect(send).toHaveBeenCalledWith(expect.anything(), { signal: controller.signal });
  });
});
