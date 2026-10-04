type GetToken = () => string | undefined;
type RefreshToken = () => Promise<string | undefined>;

/**
 * What a 401 on one of the map's requests says (location-service-client#72):
 * - `stale`: it was sent with a token since replaced. Sent again, it carries
 *   the one in hand, and nothing need be asked;
 * - `again`: the token a refresh brought, within 30 seconds of it, was refused
 *   too. The API refuses every token, as it does a map whose `apiUrl` its
 *   tokens are not for, and asking again would only mint another;
 * - `new`: anything else, the token in hand refused for the first time, or a
 *   request whose token was not noted.
 */
export type Refusal = "stale" | "again" | "new";

/** What one provider configuration's maps know about their tokens. */
export interface TokenLedger {
  /**
   * `{ getToken, refreshToken }` for the client library's map helpers: one
   * object per configuration, so every map on it shares the helpers' hold. Its
   * `refreshToken` is the provider's, noting what each refresh brought.
   */
  tokens: { getToken: GetToken; refreshToken: RefreshToken };
  /** Note the token a request to the API was sent with. */
  sent(url: string, token: string): void;
  /** What a 401 on `url` says. */
  refusal(url: string | undefined): Refusal;
  /**
   * Hear that the map cannot recover: a refresh brought no other token, or
   * failed. Returns a function that stops listening.
   */
  onUnrecoverable(listener: () => void): () => void;
}

/** One per configuration: the provider's `refreshToken` is one per configuration. */
const ledgers = new WeakMap<RefreshToken, TokenLedger>();

/** How many requests' tokens are kept: a refusal arrives within seconds of its request. */
const SENT_KEPT = 256;

/** The client library's own hold on a refused token. */
const BROUGHT_MS = 30_000;

/**
 * The ledger of the configuration `getToken` and `refreshToken` belong to.
 *
 * MapLibre's error event does not say which token a refused request carried,
 * and the token in hand stands in for it only until a refresh replaces it: a
 * request sent before, refused after, then reads as the new token refused.
 * The map notes each request's token as `transformRequest` attaches it, so a
 * refusal is read against the token that request carried.
 */
export const tokenLedger = (getToken: GetToken, refreshToken: RefreshToken): TokenLedger => {
  const known = ledgers.get(refreshToken);
  if (known) return known;

  const sentWith = new Map<string, string>();
  const listeners = new Set<() => void>();
  let brought: { token: string; until: number } | undefined;
  const unrecoverable = () => listeners.forEach((listener) => listener());

  const ledger: TokenLedger = {
    tokens: {
      getToken,
      refreshToken: async () => {
        const inHand = getToken();
        let token: string | undefined;
        try {
          token = await refreshToken();
        } catch (err) {
          unrecoverable();
          throw err;
        }
        const now = getToken();
        if (now && now !== inHand) brought = { token: now, until: Date.now() + BROUGHT_MS };
        else unrecoverable();
        return token;
      },
    },
    sent: (url, token) => {
      sentWith.delete(url);
      sentWith.set(url, token);
      if (sentWith.size > SENT_KEPT) sentWith.delete(sentWith.keys().next().value!);
    },
    refusal: (url) => {
      const carried = url === undefined ? undefined : sentWith.get(url);
      if (carried === undefined) return "new";
      if (carried !== getToken()) return "stale";
      return carried === brought?.token && Date.now() < brought.until ? "again" : "new";
    },
    onUnrecoverable: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  ledgers.set(refreshToken, ledger);
  return ledger;
};
