import { render, screen, waitFor } from "@testing-library/react";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationStore } from "../../stores/notificationStore";
import { Map } from "../Map";
import type { AddressFormContextType } from "./AddressFormContext";
import { AddressFormContext } from "./AddressFormContext";
import { AddressFormMap } from "./AddressFormMap";

vi.mock("../Map", () => ({
  Map: vi.fn(({ children, mapStyle, ...props }) => (
    <div data-testid="mock-map" data-map-style={mapStyle?.toString()} {...props}>
      {children}
    </div>
  )),
}));

vi.mock("../MapMarker", () => ({
  MapMarker: vi.fn((props) => (
    <div
      data-testid="mock-map-marker"
      data-marker-position={props.markerPosition?.toString()}
      data-adjustable-position={props.adjustablePosition?.toString()}
    />
  )),
}));

const mockContextValue: AddressFormContextType = {
  data: { city: "Seattle" },
  setData: vi.fn(),
  setMapViewState: vi.fn(),
  isAutofill: false,
  setIsAutofill: vi.fn(),
  typeaheadApiName: "autocomplete",
  setTypeaheadApiName: vi.fn(),
};

describe("AddressFormMap", () => {
  it("renders Map component with MapMarker", () => {
    render(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormMap mapStyle={["Standard", "Light"]} />
      </AddressFormContext.Provider>,
    );

    expect(screen.getByTestId("mock-map")).toBeInTheDocument();
    expect(screen.getByTestId("mock-map-marker")).toBeInTheDocument();
  });

  it("passes mapStyle to Map component", () => {
    render(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormMap mapStyle={["Standard", "Dark"]} />
      </AddressFormContext.Provider>,
    );

    const mapElement = screen.getByTestId("mock-map");
    expect(mapElement).toHaveAttribute("data-map-style", "Standard,Dark");
  });
});

/**
 * A refused map says why (#22).
 *
 * Every 403 used to read as "Map rendering is currently unavailable" plus an
 * "insufficient permissions" log line — the same words for a disallowed
 * Origin, a plan without the map routes, and a plan without the chosen style,
 * which have three different fixes. The service tells the last one apart:
 * `code: "FeatureNotEntitledException"` and a message naming the feature, in a
 * body MapLibre hands over as a Blob on the error.
 */
describe("AddressFormMap — a refused map", () => {
  const refusal = (code: string, message: string) => ({
    error: {
      status: 403,
      url: "https://api.example.com/maps/Satellite/descriptor",
      body: new Blob([JSON.stringify({ message, code, requestId: "r" })], { type: "application/json" }),
    },
  });

  const SATELLITE_REFUSED = "This application's plan does not include the map feature satellite (mapStyle=Satellite).";

  let consoleError: MockInstance<typeof console.error>;
  beforeEach(() => {
    useNotificationStore.getState().clearNotifications();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  const renderWith = (props: Partial<Parameters<typeof AddressFormMap>[0]>) => {
    render(
      <AddressFormContext.Provider value={mockContextValue}>
        <AddressFormMap mapStyle={["Standard", "Light"]} {...props} />
      </AddressFormContext.Provider>,
    );
    const onError = vi.mocked(Map).mock.calls.at(-1)![0].onError as (e: unknown) => void;
    return { onError };
  };

  const shown = () => useNotificationStore.getState().notifications.map((n) => n.message);
  const logged = () => consoleError.mock.calls.map((c) => String(c[0]));

  it("names the refused feature, not permissions, for a plan refusal", async () => {
    const { onError } = renderWith({ mapStyle: ["Satellite", "Light"] });
    onError(refusal("FeatureNotEntitledException", SATELLITE_REFUSED));

    await waitFor(() => expect(shown()).toHaveLength(1));
    expect(shown()[0]).toContain(SATELLITE_REFUSED);
    expect(shown()[0]).toContain("Standard and Monochrome");
    expect(logged().join("\n")).not.toMatch(/permission/i);
    expect(logged().join("\n")).toContain("satellite");
  });

  it("points at the map's politicalView when that is the only gated thing asked for", async () => {
    const { onError } = renderWith({ mapStyle: ["Standard", "Light"], politicalView: "IND" });
    onError(
      refusal(
        "FeatureNotEntitledException",
        "This application's plan does not include the map feature political-view (politicalView=IND).",
      ),
    );

    await waitFor(() => expect(shown()).toHaveLength(1));
    expect(shown()[0]).toContain("political-view");
    expect(shown()[0]).not.toContain("Standard and Monochrome");
  });

  it.each([
    ["a disallowed Origin", "OriginNotAllowedException", "Origin not allowed"],
    ["a route outside the plan", "ForbiddenException", "This application is not entitled to the requested resource."],
  ])("keeps the permissions wording for %s", async (_, code, message) => {
    const { onError } = renderWith({ mapStyle: ["Standard", "Light"] });
    onError(refusal(code, message));

    await waitFor(() => expect(shown()).toEqual(["Map rendering is currently unavailable."]));
    expect(logged().join("\n")).toMatch(/insufficient permissions/);
  });

  it("keeps the permissions wording when the body cannot be read", async () => {
    const { onError } = renderWith({ mapStyle: ["Satellite", "Light"] });
    onError({ error: { status: 403, body: new Blob(["<html>"]) } });

    await waitFor(() => expect(shown()).toEqual(["Map rendering is currently unavailable."]));
  });

  // A 401 used to return early like any other non-403, so a map the service
  // refused for its token stayed blank with nothing said (#25).
  it("says so for a 401: the service did not accept the map's token", async () => {
    const { onError } = renderWith({ mapStyle: ["Standard", "Light"] });
    onError({
      error: {
        status: 401,
        url: "https://api.example.com/maps/Standard/descriptor",
        body: new Blob([JSON.stringify({ message: "Unauthorized" })]),
      },
    });

    await waitFor(() => expect(shown()).toEqual(["Map rendering is currently unavailable."]));
    expect(logged().join("\n")).toMatch(/401/);
    expect(logged().join("\n")).toMatch(/getConfig/);
  });

  it("stays quiet on errors that are not a 401 or a 403", async () => {
    const { onError } = renderWith({ mapStyle: ["Standard", "Light"] });
    onError({ error: { status: 404, body: new Blob(["{}"]) } });
    await new Promise((r) => setTimeout(r, 20));
    expect(shown()).toEqual([]);
  });
});
