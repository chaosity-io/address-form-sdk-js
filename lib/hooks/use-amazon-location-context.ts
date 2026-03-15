import { useLocationClient } from "@chaosity/location-client-react";

/**
 * Compatibility hook — wraps useLocationClient() from @chaosity/location-client-react.
 * Returns the GeoPlacesClient from context, or throws if not available and not loading.
 * Returns null while the client is still initializing.
 */
function useAmazonLocationContext() {
  const { client, loading } = useLocationClient();

  if (!client && !loading) {
    throw new Error(
      "Location client is not available. Wrap this component with <LocationClientProvider> from @chaosity/location-client-react.",
    );
  }

  return { client: client!, loading };
}

export default useAmazonLocationContext;
