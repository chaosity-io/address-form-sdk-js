import type { FunctionComponent } from "react";
import { useNotificationStore } from "../../stores/notificationStore";
import { Notification } from "./Notification";

export const Container: FunctionComponent = () => {
  const lastNotification = useNotificationStore((state) => state.notifications[state.notifications.length - 1]);
  const removeNotification = useNotificationStore((state) => state.removeNotification);

  if (!lastNotification) {
    return null;
  }

  return (
    <div>
      <Notification notification={lastNotification} onRemove={removeNotification} />
    </div>
  );
};
