import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Map } from "./index";

vi.mock("react-map-gl/maplibre", () => ({
  default: vi.fn(({ mapStyle }) => <div data-testid="mock-maplibre-map" data-mapstyle={mapStyle} />),
  NavigationControl: vi.fn(() => null),
}));

// A client, but no API URL on the context and none as a prop. The provider
// is mocked rather than driven: whether it builds a client for a `getConfig`
// answer without `apiUrl` is its own question (location-service-client-react#39),
// and this case is about what the map does when it meets that state.
vi.mock("@chaosity/location-client-react", () => ({
  useLocationClient: () => ({ client: {}, apiUrl: null, getToken: () => "token", loading: false, error: null }),
}));

describe("Map without an API URL", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requests nothing, and says apiUrl is missing, when no style URL can be built (#16)", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Map mapStyle={["Standard", "Light"]} />);

    expect(screen.queryByTestId("mock-maplibre-map")).not.toBeInTheDocument();
    expect(consoleError.mock.calls.map((c) => String(c[0])).join("\n")).toMatch(/apiUrl/);
  });

  it("still mounts a style given as a URL, which needs no apiUrl", () => {
    render(<Map mapStyle="https://tiles.example.com/style.json" />);

    expect(screen.getByTestId("mock-maplibre-map")).toHaveAttribute(
      "data-mapstyle",
      "https://tiles.example.com/style.json",
    );
  });
});
