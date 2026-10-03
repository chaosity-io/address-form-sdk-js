// `@chaosity/address-form/data`: the package's data and helpers, as values a
// React Server Component can read (#34).
//
// The main entry is a client module ("use client"), because its components
// create React contexts. A Server Component that imports from it gets every
// export as a client reference, not a value, so `countries.length` there is
// not a number. Nothing imported here creates a context or renders anything,
// so this entry carries no directive. The main entry exports the same names,
// for client code that already imports them from there.
export { getColorScheme, getMapStyleType } from "./components/Map/utils";
export { countries } from "./data/countries";
export { getIncludeCountriesFilter } from "./utils/country-filter";
