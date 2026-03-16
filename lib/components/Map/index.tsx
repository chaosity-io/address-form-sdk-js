import MapLibreMap, { MapProps as MapLibreMapProps, NavigationControl } from "react-map-gl/maplibre";
import { useLocationClient } from "@chaosity/location-client-react";
import { buildMapStyleUrl, createTransformRequest } from "@chaosity/location-client";
import { useMemo } from "react";
import { Logo } from "../../icons/Logo";
import { logo } from "./styles.css";
import { getColorScheme, getMapStyleType } from "./utils";

export type ColorScheme = "Light" | "Dark";

export type MapStyleType = "Standard" | "Monochrome" | "Hybrid" | "Satellite";

type ExtendedMapStyle =
  | MapLibreMapProps["mapStyle"]
  | [MapStyleType, Extract<ColorScheme, "Light">]
  | [Extract<MapStyleType, "Standard" | "Monochrome">, Extract<ColorScheme, "Dark">];

export { type ExtendedMapStyle as MapStyle };

export interface MapProps extends Omit<MapLibreMapProps, "mapStyle"> {
  mapStyle: ExtendedMapStyle;
  apiUrl?: string;
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
