/**
 * The configuration Storybook's providers ask for: `STORYBOOK_API_URL` and
 * `STORYBOOK_TOKEN`, from `.env` (see `.env.example`).
 *
 * With either unset (a fresh clone, or the Storybook the Pages workflow
 * publishes) it refuses, so the provider has no client and each form says in
 * its banner that no API is configured. It used to fall back to a host that
 * does not resolve, with a token that is not one, and every story sent its
 * requests there (#15).
 */
export const getConfig = async () => {
  const apiUrl: string | undefined = import.meta.env.STORYBOOK_API_URL;
  const token: string | undefined = import.meta.env.STORYBOOK_TOKEN;
  if (!apiUrl || !token) {
    throw new Error("no API is configured: set STORYBOOK_API_URL and STORYBOOK_TOKEN in .env");
  }
  return { apiUrl, token, expiresAt: Date.now() + 900_000 };
};
