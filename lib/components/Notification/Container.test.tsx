import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useNotificationStore } from "../../stores/notificationStore";
import { Container } from "./Container";

describe("Notification Container", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearNotifications();
  });

  it("renders nothing when there are no notifications", () => {
    const { container } = render(<Container />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the last notification", () => {
    const { addNotification } = useNotificationStore.getState();

    addNotification({ message: "First notification", type: "error" });
    addNotification({ message: "Second notification", type: "error" });
    addNotification({ message: "Last notification", type: "error" });

    render(<Container />);

    expect(screen.getByText("Last notification")).toBeInTheDocument();
    expect(screen.queryByText("First notification")).not.toBeInTheDocument();
    expect(screen.queryByText("Second notification")).not.toBeInTheDocument();
  });

  it("removes notification when close button is clicked", async () => {
    const user = userEvent.setup();
    const { addNotification } = useNotificationStore.getState();

    addNotification({ message: "Test notification", type: "error" });

    render(<Container />);

    expect(screen.getByText("Test notification")).toBeInTheDocument();

    const closeButton = screen.getByRole("button");
    await user.click(closeButton);

    expect(screen.queryByText("Test notification")).not.toBeInTheDocument();
  });
});
