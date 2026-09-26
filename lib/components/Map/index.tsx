import { buildMapStyleUrl, createTransformRequest } from "@chaosity/location-client";
import { useLocationClient } from "@chaosity/location-client-react";
import { useEffect, useMemo } from "react";
import type { MapProps as MapLibreMapProps } from "react-map-gl/maplibre";
import MapLibreMap, { NavigationControl } from "react-map-gl/maplibre";
import { Logo } from "../../icons/Logo";
import { logo } from "./styles.css";
import { getColorScheme, getMapStyleType } from "./utils";

export type ColorScheme = "Light" | "Dark";

/**
 * A map style. `Hybrid` and `Satellite` need the `satellite` feature of the
 * application's plan: without it the service refuses the style (403
 * `FeatureNotEntitledException`) and the map stays blank. Inside
 * `AddressForm.Map` the refusal is shown, naming the feature; a bare `Map`
 * shows nothing beyond MapLibre's own console error. `Standard` and
 * `Monochrome` are open to every plan.
 * Which plans include it: https://chaosity.cloud/pricing.
 */
export type MapStyleType = "Standard" | "Monochrome" | "Hybrid" | "Satellite";

type ExtendedMapStyle =
  | MapLibreMapProps["mapStyle"]
  | [MapStyleType, Extract<ColorScheme, "Light">]
  | [Extract<MapStyleType, "Standard" | "Monochrome">, Extract<ColorScheme, "Dark">];

export { type ExtendedMapStyle as MapStyle };

export interface MapProps extends Omit<MapLibreMapProps, "mapStyle"> {
  mapStyle: ExtendedMapStyle;
  /**
   * The API to build the style's URL on. Defaults to the provider's, the one
   * its token is for, which is almost always what you want (#16).
   */
  apiUrl?: string;
  /**
   * A country's view of disputed borders on the MAP (ISO 3166-1 alpha-3, e.g.
   * `"IND"`). Needs the `political-view` feature of the application's plan;
   * without it the style is refused and the map stays blank. Not the form's
   * own `politicalView`, which shapes address suggestions and is open to every
   * plan.
   */
  politicalView?: string;
  showNavigationControl?: boolean;
}

export function Map({
  mapStyle: extendedMapStyle = ["Standard", "Light"],
  apiUrl: apiUrlProp,
  politicalView,
  showNavigationControl = true,
  children,
  ...rest
}: MapProps) {
  const { client, getToken, apiUrl: providerApiUrl } = useLocationClient();
  // The API the provider's token is for (#16). The prop used to be the only
  // source, and neither README example passes one.
  const apiUrl = apiUrlProp ?? providerApiUrl ?? undefined;
  const mapStyle = getMapStyle(extendedMapStyle, apiUrl, politicalView);

  const mapTransformRequest = useMemo(() => {
    if (!apiUrl) return undefined;
    return createTransformRequest(apiUrl, getToken);
  }, [apiUrl, getToken]);

  useEffect(() => {
    if (client && !mapStyle) {
      console.error(
        "Map not rendered: its style needs the API's URL, and none is known. Return `apiUrl` from getConfig, or pass `apiUrl` to the map.",
      );
    }
  }, [client, mapStyle]);

  // Nothing is requested before the provider has a token (#25). The map used to
  // mount at once, so on a cold load its first style request left without
  // `Authorization`, was refused 401, and MapLibre never asked again. The
  // provider stores the token before it publishes the client, so a client means
  // a token. The box keeps its size meanwhile, so nothing shifts when the map
  // arrives.
  if (!client || !mapStyle) {
    return <div id={rest.id} style={rest.style ?? MAP_BOX} />;
  }

  return (
    <MapLibreMap
      mapStyle={mapStyle}
      transformRequest={mapTransformRequest as MapLibreMapProps["transformRequest"]}
      validateStyle={false}
      style={MAP_BOX}
      {...rest}
    >
      {showNavigationControl && <NavigationControl />}

      <div className={logo}>
        <Logo mode={getLogoMode(extendedMapStyle)} />
      </div>

      {children}
    </MapLibreMap>
  );
}

const MAP_BOX = { width: "100%", height: "100%", borderRadius: 4 };

/**
 * The style MapLibre is given, or nothing when none can be built. A style NAME
 * is not one: handed "Standard", MapLibre requested it as a URL relative to
 * the page, `/Standard`, and 404ed on every load (#16).
 */
const getMapStyle = (
  extendedMapStyle: ExtendedMapStyle,
  apiUrl?: string,
  politicalView?: string,
): MapLibreMapProps["mapStyle"] | undefined => {
  if (Array.isArray(extendedMapStyle)) {
    const [mapStyle, colorScheme = "Light"] = extendedMapStyle;
    if (!apiUrl) return undefined;

    const supportsColorScheme = mapStyle === "Standard" || mapStyle === "Monochrome";
    return buildMapStyleUrl(apiUrl, mapStyle, {
      colorScheme: supportsColorScheme ? (colorScheme as ColorScheme) : undefined,
      politicalView,
    });
  }

  return extendedMapStyle;
};

const getLogoMode = (extendedMapStyle: ExtendedMapStyle): ColorScheme => {
  const mapStyleType = getMapStyleType(extendedMapStyle);
  const colorScheme = getColorScheme(extendedMapStyle);
  return mapStyleType === "Standard" || mapStyleType === "Monochrome" ? (colorScheme ?? "Light") : "Dark";
};
