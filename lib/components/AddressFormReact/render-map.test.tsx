import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "./render";

// MapLibre needs WebGL, which jsdom has not got. The mock shows what the map
// was given: its style, and whether it drew the navigation control.
vi.mock("react-map-gl/maplibre", () => ({
  default: ({ children, mapStyle }: { children?: React.ReactNode; mapStyle?: string }) => (
    <div data-testid="maplibre-map" data-mapstyle={mapStyle}>
      {children}
    </div>
  ),
  NavigationControl: () => <div data-testid="navigation-control" />,
  Marker: () => null,
}));

const API = "https://test-api.chaosity.cloud";
const getConfig = async () => ({ apiUrl: API, token: "test-token", expiresAt: Date.now() + 900_000 });

const mount = (mapAttributes: string) => {
  document.body.innerHTML = `
    <form id="address-form">
      <input data-type="address-form" name="addressLineOne" />
      <div data-type="address-form" ${mapAttributes}></div>
    </form>
  `;
  act(() => render({ root: "#address-form", getConfig }));
};

/**
 * The standalone map element (#16). `render()` has no way to pass an `apiUrl`,
 * so its map could only ever request the bare style name. And it read neither
 * the navigation control's attribute the README documents.
 */
describe("render() — the map element", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("builds its style from getConfig's apiUrl, as the React map does", async () => {
    mount('data-map-style="Standard,Light"');
    expect(await screen.findByTestId("maplibre-map")).toHaveAttribute(
      "data-mapstyle",
      `${API}/maps/Standard/descriptor?color-scheme=Light`,
    );
  });

  it('reads data-show-navigation-control="false"', async () => {
    mount('data-map-style="Standard,Light" data-show-navigation-control="false"');
    await screen.findByTestId("maplibre-map");
    expect(screen.queryByTestId("navigation-control")).not.toBeInTheDocument();
  });

  it("keeps the navigation control by default", async () => {
    mount('data-map-style="Standard,Light"');
    await screen.findByTestId("maplibre-map");
    expect(screen.getByTestId("navigation-control")).toBeInTheDocument();
  });
});
