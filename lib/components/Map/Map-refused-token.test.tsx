import { LocationClientProvider } from "@chaosity/location-client-react";
import { render, waitFor } from "@testing-library/react";
import { createRef, useEffect, useImperativeHandle, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Map } from "./index";

/**
 * The map recovers from a token the API refuses before its `exp`
 * (location-service-client#72, location-service-client-react#47).
 *
 * The core's `refreshTokenOnUnauthorized` reloads the tiles the API refused
 * once `getToken` returns a new token, and under the provider only the
 * provider's `refreshToken` can give it one. A refused style is not a tile,
 * so the map sets its style again itself. Here the map hands its instance to
 * the component through the callback ref @vis.gl/react-maplibre sets once it
 * has made one, a request is refused, and the provider's getConfig is asked
 * with the refused token.
 */

const API = "https://test-api.chaosity.cloud";
const STYLE = `${API}/maps/Standard/descriptor?color-scheme=Light`;
const jwt = (n: number) => `h.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900, n }))}.s`;

const listeners: ((event: unknown) => void)[] = [];
let attached = 0;
const fakeMap = {
  on: (_: string, fn: (event: unknown) => void) => void (attached++, listeners.push(fn)),
  off: (_: string, fn: (event: unknown) => void) => void listeners.splice(listeners.indexOf(fn), 1),
  refreshTiles: vi.fn(),
  setStyle: vi.fn(),
};
const handle = { getMap: () => fakeMap };
let transform: ((url: string, type?: string) => unknown) | undefined;

vi.mock("@vis.gl/react-maplibre", () => ({
  default: function MockMap({
    ref,
    transformRequest,
    children,
  }: {
    ref?: (handle: unknown) => void;
    transformRequest?: typeof transform;
    children?: React.ReactNode;
  }) {
    // @vis.gl/react-maplibre sets its ref once its map exists, after its own
    // first render, as here: `useImperativeHandle(ref, () => map, [mapInstance])`.
    // The callback ref is how the component hears of it. Every request goes
    // through transformRequest.
    const [instance, setInstance] = useState<unknown>(null);
    useEffect(() => setInstance(handle), []);
    useImperativeHandle(ref, () => instance as never, [instance]);
    transform = transformRequest;
    return <div data-testid="mock-maplibre-map">{children}</div>;
  },
  NavigationControl: () => null,
}));

vi.mock("../../icons/Logo.tsx", () => ({ Logo: () => null }));
vi.mock("./styles.css.ts", () => ({ logo: "logo-class" }));

const minting = () => {
  const issued: string[] = [];
  const getConfig = vi.fn(async () => {
    issued.push(jwt(issued.length + 1));
    return { apiUrl: API, token: issued.at(-1)! };
  });
  return { getConfig, issued };
};

/** A request MapLibre sends: through transformRequest, which attaches the token in hand. */
const send = (url: string) => transform?.(url);
const refuse = (url: string, tile?: { x: number; y: number; z: number }) =>
  [...listeners].forEach((fn) =>
    fn({
      error: { status: 401, url },
      ...(tile && { sourceId: "basemap", tile: { tileID: { canonical: tile } } }),
    }),
  );

beforeEach(() => {
  listeners.length = 0;
  attached = 0;
  transform = undefined;
  fakeMap.refreshTiles.mockClear();
  fakeMap.setStyle.mockClear();
});

describe("Map, after the API refuses its token", () => {
  it("asks the provider for a new token, naming the refused one, and reloads the refused tile", async () => {
    const { getConfig, issued } = minting();
    const { unmount } = render(
      <LocationClientProvider getConfig={getConfig}>
        <Map mapStyle={["Standard", "Light"]} />
      </LocationClientProvider>,
    );
    // One listener for the tiles, one for the style.
    await waitFor(() => expect(listeners).toHaveLength(2));

    refuse(`${API}/maps/tiles/vector.basemap/3/6/4`, { x: 6, y: 4, z: 3 });

    await waitFor(() => expect(fakeMap.refreshTiles).toHaveBeenCalledWith("basemap", [{ x: 6, y: 4, z: 3 }]));
    expect(getConfig.mock.calls[1]).toEqual([{ refusedToken: issued[0] }]);
    // A tile is not the style: it is not set again.
    expect(fakeMap.setStyle).not.toHaveBeenCalled();
    // The refresh re-attaches nothing, and unmounting leaves nothing listening.
    expect(listeners).toHaveLength(2);
    unmount();
    expect(listeners).toHaveLength(0);
  });

  it("sets a refused style again once the provider has a new token, asking once per refused token", async () => {
    const { getConfig, issued } = minting();
    render(
      <LocationClientProvider getConfig={getConfig}>
        <Map mapStyle={["Standard", "Light"]} />
      </LocationClientProvider>,
    );
    await waitFor(() => expect(listeners).toHaveLength(2));

    refuse(STYLE);
    refuse(STYLE);

    await waitFor(() => expect(fakeMap.setStyle).toHaveBeenCalledWith(STYLE, { diff: false }));
    expect(fakeMap.setStyle).toHaveBeenCalledTimes(1);
    expect(getConfig).toHaveBeenCalledTimes(2);
    expect(getConfig.mock.calls[1]).toEqual([{ refusedToken: issued[0] }]);
  });

  it("asks no more when the API refuses the token the refresh brought too, until the hold lapses", async () => {
    // An API that refuses every token (an `apiUrl` the tokens are not for):
    // each refusal asked for another token, several times a second.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const { getConfig, issued } = minting();
      render(
        <LocationClientProvider getConfig={getConfig}>
          <Map mapStyle={["Standard", "Light"]} />
        </LocationClientProvider>,
      );
      await waitFor(() => expect(listeners).toHaveLength(2));
      const TILE = `${API}/maps/tiles/vector.basemap/3/6/4`;

      send(STYLE);
      refuse(STYLE);
      await waitFor(() => expect(fakeMap.setStyle).toHaveBeenCalledTimes(1));
      // The style set again, sent with the new token, refused too.
      send(STYLE);
      refuse(STYLE);
      // A tile on the new token: reloaded once, then refused again and held.
      send(TILE);
      refuse(TILE, { x: 6, y: 4, z: 3 });
      send(TILE);
      refuse(TILE, { x: 6, y: 4, z: 3 });
      await new Promise((r) => setTimeout(r, 20));

      expect(getConfig).toHaveBeenCalledTimes(2);
      expect(fakeMap.setStyle).toHaveBeenCalledTimes(1);
      expect(fakeMap.refreshTiles).toHaveBeenCalledTimes(1);

      // A map that is panned later meets the refusal again, and asks again.
      // The style is not asked for again: MapLibre requests it only when set.
      vi.setSystemTime(Date.now() + 30_001);
      send(`${API}/maps/tiles/vector.basemap/3/7/4`);
      refuse(`${API}/maps/tiles/vector.basemap/3/7/4`, { x: 7, y: 4, z: 3 });
      await waitFor(() => expect(getConfig).toHaveBeenCalledTimes(3));
      expect(getConfig.mock.calls[2]).toEqual([{ refusedToken: issued[1] }]);
      expect(fakeMap.setStyle).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sets a style sent with the token before again, asking nothing", async () => {
    // A rotated secret: the style was sent with the old token, and its 401
    // landed after a refused tile had already brought a new one.
    const { getConfig } = minting();
    render(
      <LocationClientProvider getConfig={getConfig}>
        <Map mapStyle={["Standard", "Light"]} />
      </LocationClientProvider>,
    );
    await waitFor(() => expect(listeners).toHaveLength(2));
    const TILE = `${API}/maps/tiles/vector.basemap/3/6/4`;

    send(STYLE);
    send(TILE);
    refuse(TILE, { x: 6, y: 4, z: 3 });
    await waitFor(() => expect(fakeMap.refreshTiles).toHaveBeenCalledTimes(1));
    refuse(STYLE);
    await new Promise((r) => setTimeout(r, 20));

    expect(fakeMap.setStyle).toHaveBeenCalledWith(STYLE, { diff: false });
    expect(getConfig).toHaveBeenCalledTimes(2);
  });

  it("sets nothing on a map that is gone before the refresh settles", async () => {
    const issued: string[] = [];
    let release!: () => void;
    const getConfig = vi.fn(async () => {
      // The second answer, the refresh, waits for the test.
      if (issued.length === 1) await new Promise<void>((r) => (release = r));
      issued.push(jwt(issued.length + 1));
      return { apiUrl: API, token: issued.at(-1)! };
    });
    const tree = (shown: boolean) => (
      <LocationClientProvider getConfig={getConfig}>
        {shown && <Map mapStyle={["Standard", "Light"]} />}
      </LocationClientProvider>
    );
    const { rerender } = render(tree(true));
    await waitFor(() => expect(listeners).toHaveLength(2));

    refuse(STYLE);
    await waitFor(() => expect(getConfig).toHaveBeenCalledTimes(2));
    // The map goes, the provider stays: its refresh still lands.
    rerender(tree(false));
    expect(listeners).toHaveLength(0);
    release();
    await waitFor(() => expect(issued).toHaveLength(2));
    await new Promise((r) => setTimeout(r, 20));

    expect(fakeMap.setStyle).not.toHaveBeenCalled();
  });

  it("leaves the style when the provider brings no other token", async () => {
    const token = jwt(1);
    const getConfig = vi.fn(async () => ({ apiUrl: API, token }));
    render(
      <LocationClientProvider getConfig={getConfig}>
        <Map mapStyle={["Standard", "Light"]} />
      </LocationClientProvider>,
    );
    await waitFor(() => expect(listeners).toHaveLength(2));

    refuse(STYLE);

    await waitFor(() => expect(getConfig).toHaveBeenCalledTimes(2));
    await new Promise((r) => setTimeout(r, 20));
    expect(fakeMap.setStyle).not.toHaveBeenCalled();
  });

  it("still hands the map to a ref the caller passes", async () => {
    const { getConfig } = minting();
    const callerRef = createRef<unknown>();
    const props = { mapStyle: ["Standard", "Light"], ref: callerRef } as unknown as Parameters<typeof Map>[0];
    render(
      <LocationClientProvider getConfig={getConfig}>
        <Map {...props} />
      </LocationClientProvider>,
    );

    await waitFor(() => expect(callerRef.current).toBe(handle));
    expect(listeners).toHaveLength(2);
  });

  it("keeps its listeners when the caller passes a new ref each render", async () => {
    const { getConfig } = minting();
    const handed: unknown[] = [];
    const tree = () => {
      const props = { mapStyle: ["Standard", "Light"], ref: (h: unknown) => void handed.push(h) };
      return (
        <LocationClientProvider getConfig={getConfig}>
          <Map {...(props as unknown as Parameters<typeof Map>[0])} />
        </LocationClientProvider>
      );
    };
    const { rerender } = render(tree());
    await waitFor(() => expect(listeners).toHaveLength(2));

    rerender(tree());
    rerender(tree());

    await waitFor(() => expect(handed.at(-1)).toBe(handle));
    expect(listeners).toHaveLength(2);
    // Attached once: re-attaching would also forget the token already asked for.
    expect(attached).toBe(2);
  });
});
