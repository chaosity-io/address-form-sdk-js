import { LocationClientProvider } from "@chaosity/location-client-react";
import type { Preview } from "@storybook/react-vite";
import { QueryClientProvider } from "@tanstack/react-query";
import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { queryClient } from "../lib/utils/query-client";
import { getConfig } from "./get-config";

// MapLibre 6 finds no worker under a bundler until it is told where one is.
setWorkerUrl(workerUrl);

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
