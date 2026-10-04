import { LocationClientProvider } from "@chaosity/location-client-react";
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "./render";

/**
 * render hands getConfig to the provider as it is (client-react#43).
 *
 * From @chaosity/location-client-react 0.10.0 the provider calls getConfig
 * with { refusedToken } after a 401. render.test.tsx holds the type that lets
 * a page's getConfig take that request; this holds the runtime half: a wrapper
 * here, such as `() => formProps.getConfig()`, would type-check and drop the
 * argument for every standalone page.
 */

vi.mock("@chaosity/location-client-react", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import("@chaosity/location-client-react")>();
  return { ...actual, LocationClientProvider: vi.fn(actual.LocationClientProvider) };
});

const getConfig = vi.fn(async () => ({
  apiUrl: "https://test-api.chaosity.cloud",
  token: "test-token",
  expiresAt: Date.now() + 900_000,
}));

describe("render's getConfig at runtime", () => {
  beforeEach(() => {
    document.body.innerHTML = '<form id="address-form"></form>';
    vi.clearAllMocks();
  });

  it("is the function the provider is given", () => {
    act(() => {
      render({ root: "#address-form", getConfig });
    });

    expect(vi.mocked(LocationClientProvider)).toHaveBeenCalled();
    expect(vi.mocked(LocationClientProvider).mock.calls[0][0].getConfig).toBe(getConfig);
  });
});
