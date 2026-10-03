import { QueryClient } from "@tanstack/react-query";

/**
 * Each form's own cache: `AddressFormProvider` creates one per form.
 *
 * It used to be one module-global client, so every form on a page shared a
 * cache. A key covers the request (#31), but not who asks: two forms under two
 * applications, whose country scopes differ, answered the same text from one
 * list. A form's cache now holds that form's answers only.
 */
export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 60 * 1000, // Cache fetched results for 30 minutes
        retry: 2, // Will retry failed requests 2 times before displaying an error
      },
    },
  });
