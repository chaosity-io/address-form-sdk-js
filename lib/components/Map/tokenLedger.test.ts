import { afterEach, describe, expect, it, vi } from "vitest";
import { tokenLedger } from "./tokenLedger";

/** What a 401 says, read against the token its request carried (location-service-client#72). */

const API = "https://test-api.chaosity.cloud";

afterEach(() => vi.useRealTimers());

describe("tokenLedger", () => {
  it("is one per configuration: the same refreshToken, the same ledger", () => {
    const refreshToken = async () => "t";
    expect(tokenLedger(() => "t", refreshToken)).toBe(tokenLedger(() => "u", refreshToken));
    expect(
      tokenLedger(
        () => "t",
        async () => "t",
      ),
    ).not.toBe(tokenLedger(() => "t", refreshToken));
  });

  it("reads a request sent with a token since replaced as stale, and an unnoted one as new", async () => {
    let inHand = "token-1";
    const ledger = tokenLedger(
      () => inHand,
      async () => (inHand = "token-2"),
    );
    ledger.sent(`${API}/a`, "token-1");
    await ledger.tokens.refreshToken();

    expect(ledger.refusal(`${API}/a`)).toBe("stale");
    expect(ledger.refusal(`${API}/never-sent`)).toBe("new");
    expect(ledger.refusal(undefined)).toBe("new");
  });

  it("reads the token a refresh brought, refused within 30 seconds, as again, and later as new", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let inHand = "token-1";
    const ledger = tokenLedger(
      () => inHand,
      async () => (inHand = "token-2"),
    );
    await ledger.tokens.refreshToken();
    ledger.sent(`${API}/a`, "token-2");
    expect(ledger.refusal(`${API}/a`)).toBe("again");

    vi.setSystemTime(Date.now() + 30_001);
    expect(ledger.refusal(`${API}/a`)).toBe("new");
  });

  it("keeps the latest 256 requests' tokens: a refusal comes within seconds of its request", () => {
    const ledger = tokenLedger(
      () => "token-2",
      async () => "token-2",
    );
    ledger.sent(`${API}/0`, "token-1");
    for (let i = 1; i <= 256; i++) ledger.sent(`${API}/${i}`, "token-1");

    // The oldest is forgotten, so it reads as new rather than as stale.
    expect(ledger.refusal(`${API}/0`)).toBe("new");
    expect(ledger.refusal(`${API}/256`)).toBe("stale");
  });

  it("tells its listeners when a refresh brings no other token, or fails, until they stop listening", async () => {
    let fail = false;
    const ledger = tokenLedger(
      () => "token-1",
      async () => {
        if (fail) throw new Error("getConfig failed");
        return "token-1";
      },
    );
    const heard = vi.fn();
    const stop = ledger.onUnrecoverable(heard);

    await ledger.tokens.refreshToken();
    fail = true;
    await expect(ledger.tokens.refreshToken()).rejects.toThrow("getConfig failed");
    expect(heard).toHaveBeenCalledTimes(2);

    stop();
    await expect(ledger.tokens.refreshToken()).rejects.toThrow();
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
