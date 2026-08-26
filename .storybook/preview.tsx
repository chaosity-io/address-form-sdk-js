import { LocationClientProvider } from "@chaosity/location-client-react";
import type { Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";
import "maplibre-gl/dist/maplibre-gl.css";
import { queryClient } from "../lib/utils/query-client";

const getConfig = async () => ({
  apiUrl: import.meta.env.STORYBOOK_API_URL || "https://api.chaosity.cloud",
  token: import.meta.env.STORYBOOK_TOKEN || "demo-token",
  expiresAt: Date.now() + 900_000,
});

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },

  decorators: [
    // Typeahead, AddressForm and LocateButton call useQueryClient, and only
    // AddressFormProvider supplied one — so every story rendering those
    // components DIRECTLY threw "No QueryClient set". Nobody noticed because no
    // test ever executed a story; lib/stories.test.tsx now does.
    //
    // Nesting is fine: AddressFormReact brings its own provider, and the inner
    // one wins for its subtree.
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <LocationClientProvider getConfig={getConfig}>
          <Story />
        </LocationClientProvider>
      </QueryClientProvider>
    ),
  ],
};

export default preview;
