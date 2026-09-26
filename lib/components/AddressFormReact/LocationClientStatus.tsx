import { useLocationClient } from "@chaosity/location-client-react";
import { useEffect } from "react";
import { useNotificationStore } from "../../stores/notificationStore";
import { DOCS } from "../../utils/docs";

const ID = "location-client-error";

/**
 * The form's banner while the provider has no client because `getConfig`
 * failed, taken down when one of the provider's retries succeeds (#30).
 *
 * Meanwhile every field is a plain input, so the address can still be typed.
 * The provider used to be read as MISSING in this state, and the throw
 * unmounted the whole form.
 *
 * Only while there is no client. A token refresh that fails also sets `error`,
 * but the provider keeps sending with the token it holds until that expires,
 * so the form still works; a request that then fails says so itself
 * (`lib/utils/api.ts`).
 */
export const LocationClientStatus = () => {
  const { client, error } = useLocationClient();
  const failure = client ? null : error;
  const addNotification = useNotificationStore((state) => state.addNotification);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  useEffect(() => {
    if (!failure) return;

    addNotification(
      {
        id: ID,
        type: "error",
        message: `Address suggestions are unavailable right now (${failure}). You can still type the address.`,
      },
      () => {
        console.error(
          `The location client could not be configured: getConfig failed with "${failure}". The provider retries it. See ${DOCS} for troubleshooting.`,
        );
      },
    );

    return () => removeNotification(ID);
  }, [failure, addNotification, removeNotification]);

  return null;
};
