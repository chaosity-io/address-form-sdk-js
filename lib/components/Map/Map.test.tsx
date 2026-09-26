import { LocationClientProvider } from "@chaosity/location-client-react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProvider } from "../../test/utils";
import { Map } from "./index";

vi.mock("react-map-gl/maplibre", () => {
  return {
    default: vi.fn(({ children, mapStyle }) => (
      <div data-testid="mock-maplibre-map" data-mapstyle={mapStyle}>
        {children}
      </div>
    )),
    NavigationControl: vi.fn(() => <div data-testid="mock-navigation-control" />),
  };
});

vi.mock("../../icons/Logo.tsx", () => ({
  Logo: vi.fn(({ mode }) => <div data-testid="mock-logo" data-mode={mode} />),
}));

vi.mock("./styles.css.ts", () => ({
  logo: "logo-class",
}));

// The map mounts once the provider has a token (#25), so each case waits for it.
describe("Map Component", () => {
  it("renders the MaplibreMap component with correct props", async () => {
    renderWithProvider(<Map mapStyle={["Standard", "Light"]} apiUrl="https://test-api.chaosity.cloud" />);
    const mapComponent = await screen.findByTestId("mock-maplibre-map");
    expect(mapComponent).toBeInTheDocument();
    const expectedMapStyle = "https://test-api.chaosity.cloud/maps/Standard/descriptor?color-scheme=Light";
    expect(mapComponent).toHaveAttribute("data-mapstyle", expectedMapStyle);
  });

  it("renders the NavigationControl when navigationControl is true", async () => {
    renderWithProvider(<Map mapStyle={["Standard", "Light"]} showNavigationControl={true} />);
    const navigationControl = await screen.findByTestId("mock-navigation-control");
    expect(navigationControl).toBeInTheDocument();
  });

  it("does not render the NavigationControl when navigationControl is false", async () => {
    renderWithProvider(<Map mapStyle={["Standard", "Light"]} showNavigationControl={false} />);
    await screen.findByTestId("mock-maplibre-map");
    expect(screen.queryByTestId("mock-navigation-control")).not.toBeInTheDocument();
  });

  it("renders the Logo with correct mode for Standard mapStyle", async () => {
    renderWithProvider(<Map mapStyle={["Standard", "Light"]} />);
    const logo = await screen.findByTestId("mock-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("data-mode", "Light");
  });

  it("renders the Logo with correct mode for Monochrome mapStyle", async () => {
    renderWithProvider(<Map mapStyle={["Monochrome", "Dark"]} />);
    const logo = await screen.findByTestId("mock-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("data-mode", "Dark");
  });

  it("renders the Logo with Dark mode for Satellite mapStyle", async () => {
    renderWithProvider(<Map mapStyle={["Satellite", "Light"]} />);
    const logo = await screen.findByTestId("mock-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("data-mode", "Dark");
  });

  it("renders the Logo with Dark mode for Hybrid mapStyle", async () => {
    renderWithProvider(<Map mapStyle={["Hybrid", "Light"]} />);
    const logo = await screen.findByTestId("mock-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("data-mode", "Dark");
  });

  it("includes politicalView in the mapStyle URL when provided", async () => {
    renderWithProvider(
      <Map mapStyle={["Standard", "Light"]} politicalView="IN" apiUrl="https://test-api.chaosity.cloud" />,
    );
    const mapComponent = await screen.findByTestId("mock-maplibre-map");
    const expectedMapStyle =
      "https://test-api.chaosity.cloud/maps/Standard/descriptor?color-scheme=Light&political-view=IN";
    expect(mapComponent).toHaveAttribute("data-mapstyle", expectedMapStyle);
  });

  it("does not include colorScheme in the mapStyle URL for Satellite style", async () => {
    renderWithProvider(<Map mapStyle={["Satellite", "Light"]} apiUrl="https://test-api.chaosity.cloud" />);
    const mapComponent = await screen.findByTestId("mock-maplibre-map");
    const expectedMapStyle = "https://test-api.chaosity.cloud/maps/Satellite/descriptor";
    expect(mapComponent).toHaveAttribute("data-mapstyle", expectedMapStyle);
  });

  it("uses the provided mapStyleUrl directly when specified", async () => {
    const customMapStyleUrl = "https://custom-map-style-url.com/style.json";
    renderWithProvider(<Map mapStyle={customMapStyleUrl} />);
    const mapComponent = await screen.findByTestId("mock-maplibre-map");
    expect(mapComponent).toHaveAttribute("data-mapstyle", customMapStyleUrl);
  });

  it("ignores mapStyle, colorScheme, and politicalView when mapStyleUrl is provided", async () => {
    const customMapStyleUrl = "https://custom-map-style-url.com/style.json";
    renderWithProvider(<Map politicalView="IN" mapStyle={customMapStyleUrl} />);
    const mapComponent = await screen.findByTestId("mock-maplibre-map");
    expect(mapComponent).toHaveAttribute("data-mapstyle", customMapStyleUrl);
    // Verify it doesn't contain the default URL parameters
    expect(mapComponent.getAttribute("data-mapstyle")).not.toContain("color-scheme");
    expect(mapComponent.getAttribute("data-mapstyle")).not.toContain("political-view");
  });

  it("renders the Logo with Dark mode when mapStyle is geo URL with Dark color-scheme", async () => {
    renderWithProvider(<Map mapStyle="geo://Standard?color-scheme=Dark&variant=Default" />);
    const logo = await screen.findByTestId("mock-logo");
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("data-mode", "Dark");
  });
});

/**
 * The map and its provider (#16, #25).
 *
 * The map used to build its style only from an `apiUrl` PROP, which nothing
 * documented and neither README example passes, and fell back to the bare
 * style name, which MapLibre requested as `/Standard` relative to the page. And
 * it mounted at once, whether or not the provider had a token yet, so on a
 * cold load its first style request went out without `Authorization`, was
 * refused 401, and was never made again.
 */
describe("Map and its provider", () => {
  const API = "https://test-api.chaosity.cloud";
  const CONFIG = { apiUrl: API, token: "test-token", expiresAt: Date.now() + 900_000 };

  /** A provider whose getConfig answers when the test says so. */
  const renderAnsweringLater = (ui: React.ReactNode) => {
    let answer!: (config: typeof CONFIG) => void;
    const getConfig = () => new Promise<typeof CONFIG>((resolve) => (answer = resolve));
    render(<LocationClientProvider getConfig={getConfig}>{ui}</LocationClientProvider>);
    return { answer: (config = CONFIG) => act(async () => answer(config)) };
  };

  it("builds its style from the provider's apiUrl when given none (#16)", async () => {
    renderWithProvider(<Map mapStyle={["Standard", "Light"]} />);
    expect(await screen.findByTestId("mock-maplibre-map")).toHaveAttribute(
      "data-mapstyle",
      `${API}/maps/Standard/descriptor?color-scheme=Light`,
    );
  });

  it("still takes an apiUrl prop over the provider's", async () => {
    renderWithProvider(<Map mapStyle={["Standard", "Light"]} apiUrl="https://other.example" />);
    expect(await screen.findByTestId("mock-maplibre-map")).toHaveAttribute(
      "data-mapstyle",
      "https://other.example/maps/Standard/descriptor?color-scheme=Light",
    );
  });

  it("mounts no map before the provider has a token, then mounts it (#25)", async () => {
    // The apiUrl prop gives the map a style before the token exists, which is
    // #25's own case: only the wait for the client keeps the map unmounted.
    const { answer } = renderAnsweringLater(<Map mapStyle={["Standard", "Light"]} apiUrl={API} />);
    await act(async () => {});
    expect(screen.queryByTestId("mock-maplibre-map")).not.toBeInTheDocument();

    await answer();
    expect(await screen.findByTestId("mock-maplibre-map")).toHaveAttribute(
      "data-mapstyle",
      `${API}/maps/Standard/descriptor?color-scheme=Light`,
    );
  });

  it("keeps the caller's id and style on the box it shows while waiting", async () => {
    renderAnsweringLater(<Map mapStyle={["Standard", "Light"]} id="shop-map" style={{ height: 320 }} />);
    await act(async () => {});

    const box = document.getElementById("shop-map");
    expect(box).toBeInTheDocument();
    expect(box).toHaveStyle({ height: "320px" });
    expect(screen.queryByTestId("mock-maplibre-map")).not.toBeInTheDocument();
  });
});
