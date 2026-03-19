## @chaosity/address-form

Address Form SDK for [Chaosity Location Service](https://chaosity.cloud). Provides an intelligent autofill address form component that suggests addresses as users type, populates all address fields on selection, and optionally shows an interactive map with an adjustable location pin.

## Getting Started

The SDK can be used inside a React app or as a standalone HTML/JavaScript component.

### Prerequisites

You need a Chaosity Location Service account and a bearer token. Tokens are issued via your backend using the [Location Service API](https://docs.chaosity.cloud/api).

### Installation

#### React

```bash
npm install @chaosity/address-form @chaosity/location-client @chaosity/location-client-react
```

#### HTML/JavaScript (standalone)

Include the CSS and script from the CDN:

```html
<head>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/@chaosity/address-form/dist/standalone/address-form-sdk.css"
  />
</head>
<body>
  <script src="https://cdn.jsdelivr.net/npm/@chaosity/address-form/dist/standalone/address-form-sdk.umd.js"></script>
</body>
```

### Usage

#### React

Wrap your app with `LocationClientProvider` from `@chaosity/location-client-react`, then use `<AddressForm>` inside it.

```jsx
import React from "react";
import { LocationClientProvider } from "@chaosity/location-client-react";
import { AddressForm, Flex } from "@chaosity/address-form";

async function getConfig() {
  // Fetch a token from your backend
  const res = await fetch("/api/location-token");
  return res.json(); // { apiUrl, token, expiresAt }
}

export default function App() {
  return (
    <LocationClientProvider getConfig={getConfig}>
      <AddressForm
        onSubmit={async (getData) => {
          const data = await getData({ intendedUse: "SingleUse" });
          console.log(data);
        }}
      >
        <Flex direction="row" flex>
          <Flex direction="column">
            <input data-type="address-form" name="addressLineOne" data-api-name="suggest" placeholder="Enter address" />
            <input data-type="address-form" name="addressLineTwo" />
            <input data-type="address-form" name="city" placeholder="City" />
            <input data-type="address-form" name="province" placeholder="State/Province" />
            <input data-type="address-form" name="postalCode" />
            <input data-type="address-form" name="country" placeholder="Country" />
            <Flex direction="row">
              <button data-type="address-form" type="submit">
                Submit
              </button>
              <button data-type="address-form" type="reset">
                Reset
              </button>
            </Flex>
          </Flex>
          <AddressForm.Map mapStyle={["Standard", "Light"]} />
        </Flex>
      </AddressForm>
    </LocationClientProvider>
  );
}
```

#### HTML/JavaScript (standalone)

```html
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Address Form</title>
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@chaosity/address-form/dist/standalone/address-form-sdk.css"
    />
  </head>
  <body>
    <form id="address-form" class="aws-address-form aws-flex-row aws-flex-1">
      <div class="aws-flex-column">
        <input
          data-type="address-form"
          name="addressLineOne"
          data-api-name="suggest"
          data-show-current-location="true"
        />
        <input data-type="address-form" name="addressLineTwo" />
        <input data-type="address-form" name="city" />
        <input data-type="address-form" name="province" />
        <input data-type="address-form" name="postalCode" />
        <input data-type="address-form" name="country" />
        <div class="aws-flex-row">
          <button data-type="address-form" type="submit">Submit</button>
          <button data-type="address-form" type="reset">Reset</button>
        </div>
      </div>
      <div data-type="address-form" data-map-style="Standard,Light"></div>
    </form>
    <script src="https://cdn.jsdelivr.net/npm/@chaosity/address-form/dist/standalone/address-form-sdk.umd.js"></script>
    <script>
      AddressFormSDK.render({
        root: "#address-form",
        getConfig: async () => {
          const res = await fetch("/api/location-token");
          return res.json(); // { apiUrl, token, expiresAt }
        },
        onSubmit: async (getData) => {
          const data = await getData({ intendedUse: "SingleUse" });
          console.log(data);
        },
      });
    </script>
  </body>
</html>
```

### Supported Countries

The following countries have full address field parsing (each component populated into its respective field):

- Australia, Canada, France, Hong Kong, Ireland, New Zealand, Philippines, Singapore, United Kingdom, United States

Other countries display the complete address in `addressLineOne`.

## API Reference

### AddressForm

Main component wrapping the address form.

#### Props

| Property                        | Type                            | Required | Default | Description                                                                                                       |
| ------------------------------- | ------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `language`                      | `string`                        | No       | -       | [Language code](https://en.wikipedia.org/wiki/IETF_language_tag) for localized suggestions (e.g., `"en"`, `"es"`) |
| `politicalView`                 | `string`                        | No       | -       | Political view for disputed territory display                                                                     |
| `showCurrentCountryResultsOnly` | `boolean`                       | No       | `false` | Limit suggestions to the selected country                                                                         |
| `allowedCountries`              | `string[]`                      | No       | -       | ISO alpha-2 or alpha-3 country codes to restrict suggestions                                                      |
| `placeTypes`                    | `AutocompleteFilterPlaceType[]` | No       | -       | Filter results by place type (e.g., `"Locality"`, `"PostalCode"`)                                                 |
| `initialMapCenter`              | `[number, number]`              | No       | -       | Initial map center as `[longitude, latitude]`                                                                     |
| `initialMapZoom`                | `number`                        | No       | Varies  | Initial zoom level (default: 10 with center, 5 with single country, 1 otherwise)                                  |
| `onSubmit`                      | `(getData) => void`             | No       | -       | Callback receiving an async `getData` function to retrieve form data with `intendedUse` parameter                 |

#### Form Submission Data

```javascript
onSubmit: async (getData) => {
  const data = await getData({
    intendedUse: "SingleUse", // or "Storage"
  });
};
```

Use `"Storage"` if you plan to store or cache the results.

| Property           | Type      | Description                                                              |
| ------------------ | --------- | ------------------------------------------------------------------------ |
| `placeId`          | `string`  | Place ID (present when address selected from typeahead or locate button) |
| `addressLineOne`   | `string`  | Primary address line (street address)                                    |
| `addressLineTwo`   | `string`  | Secondary address line (apartment, suite, etc.)                          |
| `city`             | `string`  | City name                                                                |
| `province`         | `string`  | State or province                                                        |
| `postalCode`       | `string`  | Postal or ZIP code                                                       |
| `country`          | `string`  | Country code (ISO 3166-1 alpha-2)                                        |
| `originalPosition` | `string`  | Original coordinates from API (`longitude,latitude`)                     |
| `adjustedPosition` | `string`  | User-adjusted coordinates if map pin was moved (`longitude,latitude`)    |
| `addressDetails`   | `Address` | Full address object from the GetPlace API response                       |

### Form Input Fields

All fields use `data-type="address-form"` plus a `name` attribute.

#### Address Line One (`name="addressLineOne"`)

| Attribute                    | Default           | Description                                                          |
| ---------------------------- | ----------------- | -------------------------------------------------------------------- |
| `label`                      | `"Address"`       | Field label                                                          |
| `placeholder`                | `"Enter address"` | Placeholder text                                                     |
| `data-api-name`              | `"suggest"`       | API: `suggest` (addresses + POIs) or `autocomplete` (addresses only) |
| `data-show-current-location` | `"true"`          | Show locate button using browser Geolocation API                     |

#### Other Fields

- **Address Line Two** (`name="addressLineTwo"`): label "Address Line 2", placeholder "Apartment, suite, etc."
- **City** (`name="city"`): label "City"
- **Province/State** (`name="province"`): label "Province/State"
- **Postal Code** (`name="postalCode"`): label "Postal/Zip code"
- **Country** (`name="country"`): label "Country"

### AddressForm.Map / `<AddressForm.Map>`

Map component for previewing and adjusting the selected address location.

| Property                | Type      | HTML Attribute                 | Default | Description                          |
| ----------------------- | --------- | ------------------------------ | ------- | ------------------------------------ |
| `mapStyle`              | `array`   | `data-map-style`               | -       | Map style (see below)                |
| `showNavigationControl` | `boolean` | `data-show-navigation-control` | `true`  | Show map navigation controls         |
| `adjustablePosition`    | `boolean` | `data-adjustable-position`     | `true`  | Allow users to drag the location pin |

#### Map Style Options

| React (Array)             | HTML (String)        |
| ------------------------- | -------------------- |
| `['Standard', 'Light']`   | `"Standard,Light"`   |
| `['Standard', 'Dark']`    | `"Standard,Dark"`    |
| `['Monochrome', 'Light']` | `"Monochrome,Light"` |
| `['Monochrome', 'Dark']`  | `"Monochrome,Dark"`  |
| `['Hybrid']`              | `"Hybrid"`           |
| `['Satellite']`           | `"Satellite"`        |

## Error Handling

API errors (autocomplete, suggest, place detail) are handled automatically:

- A notification banner appears inside the form describing the failure
- The error is logged to `console.error` with a link to [troubleshooting docs](https://docs.chaosity.cloud/address-form)
- The error is re-thrown so you can handle it in your own code if needed

If `getConfig` fails or returns an expired token, the `LocationClientProvider` will call `getConfig` again on the next request. No manual retry logic is needed.

## Logging

Errors are logged to `console.error` with context:

```
Address autocomplete failed. See https://docs.chaosity.cloud/address-form for troubleshooting. Error: ...
```

For deeper debugging of token refresh and API calls, enable debug logging on the underlying client libraries:

```bash
# Browser console
localStorage.debug = 'chaosity:*'

# Node.js
DEBUG=chaosity:* node app.js
```

## TypeScript Support

This package ships with TypeScript declarations. All props and types are exported:

```typescript
import type { AddressFormData, SubmitHandler } from "@chaosity/address-form";
import type { AutocompleteFilterPlaceType } from "@chaosity/location-client";
```

## License

Apache-2.0
