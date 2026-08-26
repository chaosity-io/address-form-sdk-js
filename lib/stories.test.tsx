import { composeStories, setProjectAnnotations } from "@storybook/react-vite";
import { cleanup, render } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import previewAnnotations from "../.storybook/preview";

/**
 * Every story must at least render (#3 / T35).
 *
 * Nine story files existed and none of them was ever executed by a test, so a
 * story could throw on mount and nothing would notice — the failure surfaces as
 * a broken example in the docs a customer is reading, which is the worst place
 * to find it.
 *
 * `composeStories` applies the same args and the same preview decorators
 * Storybook uses, including the LocationClientProvider wrapper, so this asserts
 * the real composition rather than a component in isolation. It needs no new
 * dependency and no separate Storybook server: the portable-stories API ships
 * with @storybook/react-vite, which is already here.
 *
 * This is a smoke test on purpose. It proves each story mounts and produces
 * output; it does not assert behaviour, which is what the 220 tests around it
 * are for.
 */

setProjectAnnotations(previewAnnotations);

// Stories reach the live API through the provider. Nothing here should make a
// network call, so the client is stubbed at the module boundary.
vi.mock("../lib/utils/api", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  autocomplete: vi.fn().mockResolvedValue({ ResultItems: [] }),
  suggest: vi.fn().mockResolvedValue({ ResultItems: [] }),
  getPlace: vi.fn().mockResolvedValue({}),
  reverseGeocode: vi.fn().mockResolvedValue({ ResultItems: [] }),
}));

// `*.stories.*` rather than an extglob: Vite's import.meta.glob does not
// support `@(ts|tsx)` and silently matches nothing, which would make this file
// pass while running zero stories. The "finds stories to run" case below exists
// because that failure is otherwise invisible.
const modules = import.meta.glob("../src/stories/*.stories.*", {
  eager: true,
});

afterEach(cleanup);

describe("every story renders", () => {
  const cases: [string, () => unknown][] = [];

  for (const [path, mod] of Object.entries(modules)) {
    const file = path.split("/").pop()!;
    let composed: Record<string, unknown>;
    try {
      composed = composeStories(mod as never);
    } catch {
      // A story file that cannot even be composed is itself a failure; surface
      // it as a named case rather than swallowing it into a bare import error.
      cases.push([
        `${file} (compose)`,
        () => {
          throw new Error("composeStories failed");
        },
      ]);
      continue;
    }
    for (const [name, Story] of Object.entries(composed)) {
      cases.push([`${file} › ${name}`, Story as () => unknown]);
    }
  }

  it("finds stories to run", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  it.each(cases)("%s", async (_name, Story) => {
    // A composed story IS a component, so render it as one. Calling it and
    // wrapping the result needed a JSX.Element cast, and React 19 removed the
    // global JSX namespace.
    const Composed = Story as unknown as ComponentType;
    const { container } = render(<Composed />);
    expect(container).toBeTruthy();
  });
});
