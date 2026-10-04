import { LocationClientProvider } from "@chaosity/location-client-react";
import { render, waitFor } from "@testing-library/react";
import { useEffect, useImperativeHandle, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationStore } from "../../stores/notificationStore";
import type { AddressFormContextType } from "./AddressFormContext";
import { AddressFormContext } from "./AddressFormContext";
import { AddressFormMap } from "./AddressFormMap";

/**
 * The form's map after the API refuses a token (location-service-client#72),
 * with the real provider, the real `Map` and the client library's helper.
 *
 * MapLibre's error event does not say which token the refused request
 * carried. The map notes the token of each request it sends, so the form can
 * tell a request sent with a token since replaced (the map reloads it) from
 * the token a refresh brought refused too (the API refuses every token, as it
 * does a map whose `apiUrl` its tokens are not for), and only the second, or a
 * provider with no other token, shows the banner.
 */

const API = "https://test-api.chaosity.cloud";
const STYLE = `${API}/maps/Standard/descriptor?color-scheme=Light`;
const jwt = (n: number) => `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900, n }))}.s`;

const listeners: ((event: unknown) => void)[] = [];
let onErrorProp: ((event: unknown) => void) | undefined;
let transform: ((url: string, type?: string) => { url: string; headers?: Record<string, string> }) | undefined;
const fakeMap = {
  on: (_: string, fn: (event: unknown) => void) => void listeners.push(fn),
  off: (_: string, fn: (event: unknown) => void) => void listeners.splice(listeners.indexOf(fn), 1),
  refreshTiles: vi.fn(),
  setStyle: vi.fn(),
};
const handle = { getMap: () => fakeMap };

vi.mock("@vis.gl/react-maplibre", () => ({
  default: function MockMap({
    ref,
    onError,
    transformRequest,
    children,
  }: {
    ref?: (handle: unknown) => void;
    onError?: (event: unknown) => void;
    transformRequest?: typeof transform;
    children?: React.ReactNode;
  }) {
    // As @vis.gl/react-maplibre: the ref once the map exists, every request
    // through transformRequest, and the onError prop, which hears an error
    // before the listeners added with `map.on`.
    const [instance, setInstance] = useState<unknown>(null);
    useEffect(() => setInstance(handle), []);
    useImperativeHandle(ref, () => instance as never, [instance]);
    onErrorProp = onError;
    transform = transformRequest;
    return <div data-testid="mock-maplibre-map">{children}</div>;
  },
  NavigationControl: () => null,
}));

vi.mock("../MapMarker", () => ({ MapMarker: () => null }));
vi.mock("../../icons/Logo.tsx", () => ({ Logo: () => null }));
vi.mock("../Map/styles.css.ts", () => ({ logo: "logo-class" }));

const context: AddressFormContextType = {
  data: {},
  setData: vi.fn(),
  setMapViewState: vi.fn(),
  isAutofill: false,
  setIsAutofill: vi.fn(),
  typeaheadApiName: "autocomplete",
  setTypeaheadApiName: vi.fn(),
};

const tileUrl = (x: number) => `${API}/maps/tiles/vector.basemap/3/${x}/4`;
/** A request MapLibre sends: through transformRequest, which attaches the token in hand. */
const send = (url: string) => transform?.(url, "Tile");
/** That request refused, as MapLibre reports it. */
const refuseTile = (x: number) => {
  const event = {
    error: { status: 401, url: tileUrl(x) },
    sourceId: "basemap",
    tile: { tileID: { canonical: { x, y: 4, z: 3 } } },
  };
  onErrorProp?.(event);
  [...listeners].forEach((fn) => fn(event));
};
const refuseStyle = () => {
  const event = { error: { status: 401, url: STYLE } };
  onErrorProp?.(event);
  [...listeners].forEach((fn) => fn(event));
};
const settle = () => new Promise((r) => setTimeout(r, 20));
const shown = () => useNotificationStore.getState().notifications.map((n) => n.message);
const BANNER = ["Map rendering is currently unavailable."];

const minting = () => {
  const issued: string[] = [];
  const getConfig = vi.fn(async () => {
    issued.push(jwt(issued.length + 1));
    return { apiUrl: API, token: issued.at(-1)! };
  });
  return { getConfig, issued };
};

const renderForm = (getConfig: () => Promise<{ apiUrl: string; token: string }>, shownMap = true) => (
  <LocationClientProvider getConfig={getConfig}>
    <AddressFormContext.Provider value={context}>
      {shownMap && <AddressFormMap mapStyle={["Standard", "Light"]} />}
    </AddressFormContext.Provider>
  </LocationClientProvider>
);

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  listeners.length = 0;
  transform = undefined;
  fakeMap.refreshTiles.mockClear();
  fakeMap.setStyle.mockClear();
  useNotificationStore.getState().clearNotifications();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AddressForm.Map, after the API refuses its token", () => {
  it("says nothing while the map recovers: one new token, the refused tile reloaded", async () => {
    const { getConfig, issued } = minting();
    render(renderForm(getConfig));
    await waitFor(() => expect(listeners).toHaveLength(2));

    send(tileUrl(1));
    refuseTile(1);
    await waitFor(() => expect(fakeMap.refreshTiles).toHaveBeenCalledTimes(1));
    send(tileUrl(1));
    await settle();

    expect(getConfig).toHaveBeenCalledTimes(2);
    expect(getConfig.mock.calls[1]).toEqual([{ refusedToken: issued[0] }]);
    expect(shown()).toEqual([]);
  });

  // A rotated secret while the map is panned: tiles sent with the old token
  // are refused after the new one arrived. That is not the new token refused.
  it("says nothing for a tile sent with the token before, refused after the new one arrived", async () => {
    const { getConfig } = minting();
    render(renderForm(getConfig));
    await waitFor(() => expect(listeners).toHaveLength(2));

    send(tileUrl(1));
    send(tileUrl(2));
    refuseTile(1);
    await waitFor(() => expect(fakeMap.refreshTiles).toHaveBeenCalledTimes(1));
    refuseTile(2);
    await settle();

    expect(shown()).toEqual([]);
    expect(getConfig).toHaveBeenCalledTimes(2);
    // The late tile reloaded once with the token in hand, nothing asked.
    expect(fakeMap.refreshTiles).toHaveBeenLastCalledWith("basemap", [{ x: 2, y: 4, z: 3 }]);
  });

  it("says so when the API refuses the token the refresh brought too, and asks no more", async () => {
    const { getConfig } = minting();
    render(renderForm(getConfig));
    await waitFor(() => expect(listeners).toHaveLength(2));

    send(tileUrl(1));
    refuseTile(1);
    await waitFor(() => expect(fakeMap.refreshTiles).toHaveBeenCalledTimes(1));
    // The reload, sent with the new token, refused in its turn.
    send(tileUrl(1));
    refuseTile(1);
    await waitFor(() => expect(shown()).toEqual(BANNER));
    expect(consoleError.mock.calls[0][1]).toEqual({ status: 401, url: tileUrl(1) });

    // Panning on: no more tokens.
    send(tileUrl(3));
    refuseTile(3);
    await settle();
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it("says nothing when the token the refresh brought is refused after the hold: the map asks again", async () => {
    const { getConfig } = minting();
    render(renderForm(getConfig));
    await waitFor(() => expect(listeners).toHaveLength(2));

    send(tileUrl(1));
    refuseTile(1);
    await waitFor(() => expect(fakeMap.refreshTiles).toHaveBeenCalledTimes(1));
    send(tileUrl(1));
    // Minutes later, the new token is revoked too: news, not the API refusing every token.
    vi.setSystemTime(Date.now() + 30_001);
    send(tileUrl(2));
    refuseTile(2);
    await waitFor(() => expect(getConfig).toHaveBeenCalledTimes(3));
    await settle();

    expect(shown()).toEqual([]);
    expect(fakeMap.refreshTiles).toHaveBeenCalledTimes(2);
  });

  it("says so when the provider has no other token", async () => {
    const token = jwt(1);
    const getConfig = vi.fn(async () => ({ apiUrl: API, token }));
    render(renderForm(getConfig));
    await waitFor(() => expect(listeners).toHaveLength(2));

    send(tileUrl(1));
    refuseTile(1);

    await waitFor(() => expect(shown()).toEqual(BANNER));
    expect(getConfig).toHaveBeenCalledTimes(2);
    expect(fakeMap.refreshTiles).not.toHaveBeenCalled();
  });

  it("asks once per hold, the form and the map together, however often the map is panned", async () => {
    const { getConfig, issued } = minting();
    render(renderForm(getConfig));
    await waitFor(() => expect(listeners).toHaveLength(2));

    send(tileUrl(1));
    refuseTile(1);
    await waitFor(() => expect(fakeMap.refreshTiles).toHaveBeenCalledTimes(1));
    send(tileUrl(1));
    refuseTile(1);
    await waitFor(() => expect(shown()).toEqual(BANNER));
    for (const x of [2, 3, 4]) {
      send(tileUrl(x));
      refuseTile(x);
      await settle();
    }
    expect(getConfig).toHaveBeenCalledTimes(2);

    // After the hold, a pan meets the refusal again: one ask.
    vi.setSystemTime(Date.now() + 30_001);
    send(tileUrl(5));
    refuseTile(5);
    await waitFor(() => expect(getConfig).toHaveBeenCalledTimes(3));
    expect(getConfig.mock.calls[2]).toEqual([{ refusedToken: issued[1] }]);
    for (const x of [5, 6, 7]) {
      send(tileUrl(x));
      refuseTile(x);
      await settle();
    }
    expect(getConfig).toHaveBeenCalledTimes(3);
  });

  it("says so when the style set again with the new token is refused too, and asks no more", async () => {
    const { getConfig } = minting();
    render(renderForm(getConfig));
    await waitFor(() => expect(listeners).toHaveLength(2));

    send(STYLE);
    refuseStyle();
    await waitFor(() => expect(fakeMap.setStyle).toHaveBeenCalledTimes(1));
    expect(shown()).toEqual([]);
    send(STYLE);
    refuseStyle();
    await waitFor(() => expect(shown()).toEqual(BANNER));
    await settle();

    expect(getConfig).toHaveBeenCalledTimes(2);
    expect(fakeMap.setStyle).toHaveBeenCalledTimes(1);
  });

  it("says nothing for a map that is gone before the refresh settles", async () => {
    const token = jwt(1);
    let release!: () => void;
    let calls = 0;
    const getConfig = vi.fn(async () => {
      // The refresh waits for the test, then brings no other token.
      if (++calls === 2) await new Promise<void>((r) => (release = r));
      return { apiUrl: API, token };
    });
    const { rerender } = render(renderForm(getConfig));
    await waitFor(() => expect(listeners).toHaveLength(2));

    send(tileUrl(1));
    refuseTile(1);
    await waitFor(() => expect(getConfig).toHaveBeenCalledTimes(2));
    // The map goes, the provider stays: its refresh still lands.
    rerender(renderForm(getConfig, false));
    release();
    await settle();

    expect(shown()).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
