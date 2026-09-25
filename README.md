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
          const data = await getData();
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
          const data = await getData();
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

| Property                        | Type                            | Required | Default | Description                                                                                                                                                       |
| ------------------------------- | ------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `language`                      | `string`                        | No       | -       | [Language code](https://en.wikipedia.org/wiki/IETF_language_tag) for localized suggestions (e.g., `"en"`, `"es"`)                                                 |
| `politicalView`                 | `string`                        | No       | -       | Political view for disputed territory display in address suggestions. Open to every plan; the map's own is `AddressForm.Map`'s `politicalView`                    |
| `showCurrentCountryResultsOnly` | `boolean`                       | No       | `false` | Limit suggestions to the selected country                                                                                                                         |
| `allowedCountries`              | `string[]`                      | No       | -       | ISO 3166-1 **alpha-2** country codes to restrict suggestions. An application that has a country scope refuses alpha-3 (`AUS`) with a 400                          |
| `placeTypes`                    | `AutocompleteFilterPlaceType[]` | No       | -       | Filter results by place type (e.g., `"Locality"`, `"PostalCode"`)                                                                                                 |
| `initialMapCenter`              | `[number, number]`              | No       | -       | Initial map center as `[longitude, latitude]`                                                                                                                     |
| `initialMapZoom`                | `number`                        | No       | Varies  | Initial zoom level (default: 10 with center, 5 with single country, 1 otherwise)                                                                                  |
| `onSubmit`                      | `(getData) => void`             | No       | -       | Callback receiving an async `getData` function that resolves the captured form data                                                                               |
| `verify`                        | `boolean`                       | No       | `false` | Resolve the chosen PlaceId through address verification when `getData()` is called — see [Verifying the address](#verifying-the-address). Billed per verification |

#### Form Submission Data

```javascript
onSubmit: async (getData) => {
  const data = await getData();
};
```

Everything the form fills in comes from suggestions and place details, which
are for display only. To keep an address, turn on [`verify`](#verifying-the-address).

> **Changed in 0.4.0** — `getData` no longer takes an `intendedUse` argument.
> Passing `"Storage"` used to issue a second, separately billed `GetPlace` for
> the same place. The Location Service never forwards `IntendedUse`, so that
> call returned identical data and granted no storage rights — it only charged
> you twice. The storable path is `verify`.

| Property             | Type                    | Description                                                                                                                                                    |
| -------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeId`            | `string`                | PlaceId of the last pick from the typeahead or locate button, as chosen (a unit's as its building lists it). Not cleared when the fields are edited afterwards |
| `verified`           | `boolean`               | With `verify` on: whether the service verified the chosen PlaceId. Absent when there was nothing to verify                                                     |
| `verification`       | `VerifyAddressResponse` | With `verify` on: the service's whole answer, the place record plus `verified` — the result you may store                                                      |
| `addressLineOne`     | `string`                | Primary address line (street address)                                                                                                                          |
| `addressLineTwo`     | `string`                | Secondary address line (apartment, suite, etc.)                                                                                                                |
| `city`               | `string`                | City name                                                                                                                                                      |
| `province`           | `string`                | State or province                                                                                                                                              |
| `postalCode`         | `string`                | Postal or ZIP code                                                                                                                                             |
| `country`            | `string`                | Country code (ISO 3166-1 alpha-2)                                                                                                                              |
| `originalPosition`   | `string`                | Original coordinates from API (`longitude,latitude`)                                                                                                           |
| `adjustedPosition`   | `string`                | User-adjusted coordinates if map pin was moved (`longitude,latitude`)                                                                                          |
| `addressDetails`     | `Address`               | Full address object from the GetPlace API response                                                                                                             |
| `secondaryAddresses` | `RelatedPlace[]`        | Sub-addresses (units, suites) returned for the selected place                                                                                                  |

#### Verifying the address

With `verify` on — `<AddressForm verify>`, or `verify: true` in `render()` —
`getData()` sends the chosen PlaceId to the service's address verification and
resolves with two more fields:

```javascript
onSubmit: async (getData) => {
  const data = await getData();
  if (data.verified) {
    save(data.verification); // the place record, which you may store
  }
};
```

- **`verification` is the one result you may store**, except a place in Japan,
  which may not be stored at all. Everything else the form returns is for
  display only.
- `verified` is `true` for an address the service knows the exact point of
  (`PointAddress`), or a unit (`SecondaryAddress`). It is `false` for anything
  else: an interpolated address, a street, a locality, a point of interest. A
  `false` resolves; it is not an error.
- **Each verification is billed, whether or not the address verifies**, which
  is why `verify` is off by default. The call is made when you call
  `getData()`, never while the person is typing. Each PlaceId is verified once
  per form: submitting the same selection again reuses the first answer.
- To verify a unit, pick it from the building's list of units. A unit typed
  into address line two is not verified.
- Keep `placeId` beside `verification`. The answer's own `PlaceId` can differ,
  and for a unit it does. The service does not accept that one back, while
  `placeId` verifies again.
- An address the browser autofills is resolved to its best match — the place
  the map pin and `addressDetails` already show — and that match is what is
  verified. Compare `verification.Address` with the fields if the difference
  matters to you.
- There is no call, and `verified` is absent, when there is nothing to verify:
  - the address was typed by hand, never picked, or an autofill resolved to
    nothing;
  - address line one, city, province/state, postal code or country no longer
    reads what the pick or the autofill filled in. `placeId` still names that
    place, but it no longer describes what is being submitted.

  Address line two and the map pin are not part of that check.

- **A failed verification rejects `getData()`** with the client's error, after
  showing it in the form's notification banner. It is not kept, so the next
  submit tries again.
- Needs `@chaosity/location-client` 0.10.0 or later, which this package's peer
  range requires from the release that adds `verify`. Any
  `@chaosity/location-client-react` this package supports will do.

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

| Property                | Type      | HTML Attribute                 | Default | Description                                                                                                   |
| ----------------------- | --------- | ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------- |
| `mapStyle`              | `array`   | `data-map-style`               | -       | Map style (see below)                                                                                         |
| `showNavigationControl` | `boolean` | `data-show-navigation-control` | `true`  | Show map navigation controls                                                                                  |
| `adjustablePosition`    | `boolean` | `data-adjustable-position`     | `true`  | Allow users to drag the location pin                                                                          |
| `politicalView`         | `string`  | -                              | -       | A country's view of disputed borders on the map (ISO 3166-1 alpha-3). Needs the `political-view` plan feature |

#### Map Style Options

| React (Array)             | HTML (String)        | Plan feature |
| ------------------------- | -------------------- | ------------ |
| `['Standard', 'Light']`   | `"Standard,Light"`   | -            |
| `['Standard', 'Dark']`    | `"Standard,Dark"`    | -            |
| `['Monochrome', 'Light']` | `"Monochrome,Light"` | -            |
| `['Monochrome', 'Dark']`  | `"Monochrome,Dark"`  | -            |
| `['Hybrid', 'Light']`     | `"Hybrid"`           | `satellite`  |
| `['Satellite', 'Light']`  | `"Satellite"`        | `satellite`  |

A plan feature is part of the application's plan, and which plans include which
feature is on the [pricing page](https://chaosity.cloud/pricing). On a plan
without it the style is refused: the map stays blank and the form names the
refused feature. It does not fall back to another style, because a map drawn in
a style you did not choose would hide the reason.

## Error Handling

API errors (autocomplete, suggest, place detail, and verification when `verify` is on) are handled automatically:

- A notification banner appears inside the form describing the failure
- The error is logged to `console.error` with a link to [troubleshooting docs](https://docs.chaosity.cloud/address-form)
- The error is re-thrown so you can handle it in your own code if needed

A map the service refuses reads the refusal before choosing its words. When
the application's plan does not include an option the map asks for — the
Hybrid or Satellite style (plan feature `satellite`), or the map's
`politicalView` (`political-view`) — the service answers
`FeatureNotEntitledException`, and the form shows its message, which names the
feature, with what to change. Any other refusal of the map — an origin the
application does not allow, a plan without maps — shows "Map rendering is
currently unavailable." and logs a pointer to the setup instructions.

If `getConfig` fails or returns an expired token, the `LocationClientProvider` will call `getConfig` again on the next request. No manual retry logic is needed.

## Logging

Errors are logged to `console.error` with context:

```
Address autocomplete failed. See https://docs.chaosity.cloud/address-form for troubleshooting. Error: ...
```

For deeper debugging of token refresh and API calls, enable debug logging on the underlying client libraries:

```bash
# Browser console
localStorage.debug = 'location-client:*,location-client-react:*'

# Node.js
DEBUG='location-client:*,location-client-react:*' node app.js
```

## TypeScript Support

This package ships with TypeScript declarations. All props and types are exported:

```typescript
import type { AddressFormData, SubmitHandler } from "@chaosity/address-form";
import type { AutocompleteFilterPlaceType } from "@chaosity/location-client";
```

## License

Apache-2.0
