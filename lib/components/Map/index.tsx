import { buildMapStyleUrl, createTransformRequest } from "@chaosity/location-client";
import { useLocationClient } from "@chaosity/location-client-react";
import { useMemo } from "react";
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
  const { getToken } = useLocationClient();
  const apiUrl = apiUrlProp;

  const mapTransformRequest = useMemo(() => {
    if (!apiUrl) return undefined;
    return createTransformRequest(apiUrl, getToken);
  }, [apiUrl, getToken]);

  return (
    <MapLibreMap
      mapStyle={getMapStyle(extendedMapStyle, apiUrl, politicalView)}
      transformRequest={mapTransformRequest as MapLibreMapProps["transformRequest"]}
      validateStyle={false}
      style={{ width: "100%", height: "100%", borderRadius: 4 }}
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

const getMapStyle = (
  extendedMapStyle: ExtendedMapStyle,
  apiUrl?: string,
  politicalView?: string,
): MapLibreMapProps["mapStyle"] => {
  if (Array.isArray(extendedMapStyle)) {
    const [mapStyle, colorScheme = "Light"] = extendedMapStyle;

    if (apiUrl) {
      const supportsColorScheme = mapStyle === "Standard" || mapStyle === "Monochrome";
      return buildMapStyleUrl(apiUrl, mapStyle, {
        colorScheme: supportsColorScheme ? (colorScheme as ColorScheme) : undefined,
        politicalView,
      });
    }

    return mapStyle;
  }

  return extendedMapStyle;
};

const getLogoMode = (extendedMapStyle: ExtendedMapStyle): ColorScheme => {
  const mapStyleType = getMapStyleType(extendedMapStyle);
  const colorScheme = getColorScheme(extendedMapStyle);
  return mapStyleType === "Standard" || mapStyleType === "Monochrome" ? (colorScheme ?? "Light") : "Dark";
};
