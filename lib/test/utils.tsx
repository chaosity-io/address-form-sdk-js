import { LocationClientProvider } from "@chaosity/location-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RenderOptions } from "@testing-library/react";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";

// Regular function (not vi.fn) so vi.clearAllMocks() cannot clear its implementation
const mockGetConfig = () =>
  Promise.resolve({
    apiUrl: "https://test-api.chaosity.cloud",
    token: "test-token",
    expiresAt: Date.now() + 900_000,
  });

export function renderWithProvider(ui: ReactNode, options?: Omit<RenderOptions, "wrapper">) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <LocationClientProvider getConfig={mockGetConfig}>{children}</LocationClientProvider>
      </QueryClientProvider>
    ),
    ...options,
  });
}
