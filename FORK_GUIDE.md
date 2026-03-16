# Fork Guide: OAuth2 Authentication

To use this SDK with your OAuth2 token-based authentication instead of API keys:

## Changes Required

### 1. Context (`lib/context/amazon-location-context.ts`)

```typescript
import { createContext } from "react";
import { GeoPlacesClient } from "@aws-sdk/client-geo-places";

const AmazonLocationContext = createContext<
  | {
      client: GeoPlacesClient;
      getToken: () => string;
    }
  | undefined
>(undefined);

export default AmazonLocationContext;
```

### 2. Provider (`lib/components/AmazonLocationProvider/index.tsx`)

```typescript
import { QueryClientProvider } from "@tanstack/react-query";
import { PropsWithChildren, useMemo } from "react";
import AmazonLocationContext from "../../context/amazon-location-context";
import { queryClient } from "../../utils/query-client";
import { GeoPlacesClient } from "@aws-sdk/client-geo-places";

type AmazonLocationProviderProps = PropsWithChildren & {
  client: GeoPlacesClient;
  getToken: () => string;
};

export function AmazonLocationProvider({ client, getToken, children }: AmazonLocationProviderProps) {
  const value = useMemo(() => {
    if (!client || !getToken) {
      throw new Error("Please provide both `client` and `getToken` props to <AmazonLocationProvider> component.");
    }
    return { client, getToken };
  }, [client, getToken]);

  return (
    <AmazonLocationContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AmazonLocationContext.Provider>
  );
}
```

### 3. API Utils (`lib/utils/api.ts`)

Remove `initializeAwsSdkClient` and `authHelper` - client is now passed in.

### 4. AddressForm Component

Update to accept `client` and `getToken` instead of `apiKey` and `region`:

```typescript
<AddressForm
  client={client}
  getToken={getToken}
  onSubmit={async (getData) => {
    const data = await getData({ intendedUse: "Storage" });
    console.log(data);
  }}
>
  {/* form fields */}
</AddressForm>
```

## Usage with Your LocationClientProvider

```tsx
import { AddressForm } from "@chaosity/address-form-sdk-js"; // your forked version
import { useLocationClient } from "@chaosity/location-client-react";

export default function CheckoutPage() {
  const { client, getToken } = useLocationClient();

  return (
    <AddressForm client={client} getToken={getToken} onSubmit={...}>
      <input data-type="address-form" name="addressLineOne" />
      <input data-type="address-form" name="city" />
      <input data-type="address-form" name="province" />
      <input data-type="address-form" name="postalCode" />
      <input data-type="address-form" name="country" />
      <button data-type="address-form" type="submit">Submit</button>
    </AddressForm>
  );
}
```

## Alternative: Keep Both Auth Methods

Support both API key and OAuth2:

```typescript
type AmazonLocationProviderProps = PropsWithChildren &
  (
    | { apiKey: string; region: string; client?: never; getToken?: never }
    | { client: GeoPlacesClient; getToken: () => string; apiKey?: never; region?: never }
  );
```
