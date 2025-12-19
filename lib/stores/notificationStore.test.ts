import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNotificationStore } from "./notificationStore";

describe("notificationStore", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearNotifications();
  });

  it("starts with empty notifications", () => {
    const { notifications } = useNotificationStore.getState();
    expect(notifications).toEqual([]);
  });

  it("adds notification with auto-generated id", () => {
    const { addNotification } = useNotificationStore.getState();

    addNotification({ message: "Test message", type: "error" });

    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({ message: "Test message", type: "error" });
    expect(notifications[0].id).toBeDefined();
  });

  it("adds notification with custom id", () => {
    const { addNotification } = useNotificationStore.getState();

    addNotification({ id: "custom-id", message: "Test message", type: "error" });

    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe("custom-id");
  });

  it("ignores duplicate notification ids", () => {
    const { addNotification } = useNotificationStore.getState();

    addNotification({ id: "duplicate", message: "First", type: "error" });
    addNotification({ id: "duplicate", message: "Second", type: "error" });

    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toBe("First");
  });

  it("removes notification by id", () => {
    const { addNotification, removeNotification } = useNotificationStore.getState();

    addNotification({ id: "test-1", message: "First", type: "error" });
    addNotification({ id: "test-2", message: "Second", type: "error" });

    removeNotification("test-1");

    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBe("test-2");
  });

  it("clears all notifications", () => {
    const { addNotification, clearNotifications } = useNotificationStore.getState();

    addNotification({ message: "First", type: "error" });
    addNotification({ message: "Second", type: "error" });

    clearNotifications();

    const { notifications } = useNotificationStore.getState();
    expect(notifications).toEqual([]);
  });

  it("calls onAdd callback when notification is added", () => {
    const { addNotification } = useNotificationStore.getState();
    const onAdd = vi.fn();

    addNotification({ message: "Test", type: "error" }, onAdd);

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("does not call onAdd callback for duplicate notifications", () => {
    const { addNotification } = useNotificationStore.getState();
    const onAdd = vi.fn();

    addNotification({ id: "test-id", message: "Test", type: "error" }, onAdd);
    addNotification({ id: "test-id", message: "Test", type: "error" }, onAdd);

    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
