import { buildMapStyleUrl, createTransformRequest, refreshTokenOnUnauthorized } from "@chaosity/location-client";
import { useLocationClient } from "@chaosity/location-client-react";
import type { MapProps as MapLibreMapProps, MapRef } from "@vis.gl/react-maplibre";
import MapLibreMap, { NavigationControl } from "@vis.gl/react-maplibre";
import type { MutableRefObject, Ref } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Logo } from "../../icons/Logo";
import { logo } from "./styles.css";
import { tokenLedger } from "./tokenLedger";
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
  const { client, getToken, refreshToken, apiUrl: providerApiUrl } = useLocationClient();
  // The API the provider's token is for (#16). The prop used to be the only
  // source, and neither README example passes one.
  const apiUrl = apiUrlProp ?? providerApiUrl ?? undefined;
  const mapStyle = getMapStyle(extendedMapStyle, apiUrl, politicalView);

  // What this configuration's maps know about their tokens: which token each
  // request carried, and what each refresh brought (location-service-client#72).
  const ledger = useMemo(() => tokenLedger(getToken, refreshToken), [getToken, refreshToken]);

  const mapTransformRequest = useMemo(() => {
    if (!apiUrl) return undefined;
    const attach = createTransformRequest(apiUrl, getToken);
    // Each request's token is noted, so a refusal is read against it.
    return ((url, resourceType) => {
      const request = attach(url, resourceType);
      // `createTransformRequest` answers synchronously; a promise is MapLibre's type, not its answer.
      const bearer: unknown = request && "headers" in request ? request.headers?.Authorization : undefined;
      if (request && "url" in request && typeof bearer === "string")
        ledger.sent(request.url, bearer.slice("Bearer ".length));
      return request;
    }) as typeof attach;
  }, [apiUrl, getToken, ledger]);

  // @vis.gl/react-maplibre sets its ref once its map exists, after its own
  // first render, so a callback ref is what hears of it.
  const [mapRef, setMapRef] = useState<MapRef | null>(null);

  // A tile the API refuses before its token's exp (a revoked token, a rotated
  // secret) asks the provider for a new token once, and is reloaded with it,
  // by the client library's helper. Its `tokens` is one object per
  // configuration, because the helper tracks a refused token per object.
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !apiUrl) return;
    return refreshTokenOnUnauthorized(map, apiUrl, ledger.tokens);
  }, [mapRef, apiUrl, ledger]);

  // A refused style is not a tile: the helper above replaces the token for the
  // next request and reloads nothing, and MapLibre does not ask for a style
  // again. So the style is set again: at once when it was sent with a token
  // since replaced, else once per refused token when the provider's refresh
  // (the same one the helper asks for) brought a new token. The token that
  // refresh brought, refused too, is not asked about: the form says so.
  useEffect(() => {
    const map = mapRef?.getMap();
    // A style given as an object was never requested, so it is never refused.
    if (!map || typeof mapStyle !== "string") return;
    let askedFor: string | undefined;
    // The refresh outlives this listener: a map gone by the time it settles is
    // left alone.
    let active = true;
    // Not a diff: the refused style never loaded, so there is nothing to diff against.
    const setAgain = () => {
      if (active) map.setStyle(mapStyle, { diff: false });
    };
    const onError = (event: { error?: unknown }) => {
      // MapLibre's AJAXError carries the status and the URL it was refused for.
      const { status, url } = (event.error ?? {}) as { status?: number; url?: string };
      if (status !== 401 || url !== mapStyle) return;
      const refusal = ledger.refusal(url);
      if (refusal === "stale") return setAgain();
      if (refusal === "again") return;
      const refused = getToken();
      if (!refused || refused === askedFor) return;
      askedFor = refused;
      ledger.tokens.refreshToken().then(
        () => {
          const now = getToken();
          if (now && now !== refused) setAgain();
        },
        () => {},
      );
    };
    map.on("error", onError);
    return () => {
      active = false;
      map.off("error", onError);
    };
  }, [mapRef, mapStyle, ledger, getToken]);

  // A ref the caller passes (React 19 hands a function component its ref as a
  // prop) still receives the map, and does not take the place of the one above.
  const callerRef = (rest as { ref?: Ref<MapRef> }).ref;
  const setRefs = useCallback(
    (handle: MapRef | null) => {
      setMapRef(handle);
      if (typeof callerRef === "function") callerRef(handle);
      else if (callerRef) (callerRef as MutableRefObject<MapRef | null>).current = handle;
    },
    [callerRef],
  );

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
      ref={setRefs}
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
