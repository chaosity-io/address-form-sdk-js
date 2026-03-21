import { LocationClientProvider } from "@chaosity/location-client-react";
import type { Preview } from "@storybook/react-vite";
import "maplibre-gl/dist/maplibre-gl.css";

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
    (Story) => (
      <LocationClientProvider getConfig={getConfig}>
        <Story />
      </LocationClientProvider>
    ),
  ],
};

export default preview;
