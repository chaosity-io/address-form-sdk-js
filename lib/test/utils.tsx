import { LocationClientProvider, useLocationClient } from "@chaosity/location-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RenderOptions } from "@testing-library/react";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect } from "vitest";

// Regular function (not vi.fn) so vi.clearAllMocks() cannot clear its implementation
const mockGetConfig = () =>
  Promise.resolve({
    apiUrl: "https://test-api.chaosity.cloud",
    token: "test-token",
    expiresAt: Date.now() + 900_000,
  });

let hasClient = false;

/**
 * Once the provider `renderWithProvider` mounted has its client. Its getConfig
 * answers at once, but on a later tick, and nothing asks the API before then:
 * no suggestion, no autofill, no map (#25, #30).
 */
export const untilClient = () => waitFor(() => expect(hasClient).toBe(true));

export function renderWithProvider(ui: ReactNode, options?: Omit<RenderOptions, "wrapper">) {
  hasClient = false;
  const ClientProbe = () => {
    hasClient = useLocationClient().client !== null;
    return null;
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <LocationClientProvider getConfig={mockGetConfig}>
          <ClientProbe />
          {children}
        </LocationClientProvider>
      </QueryClientProvider>
    ),
    ...options,
  });
}
