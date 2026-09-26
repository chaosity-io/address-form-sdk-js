import { useLocationClient } from "@chaosity/location-client-react";
import { render, screen, waitFor } from "@testing-library/react";
import { globSync } from "glob";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import preview from "../.storybook/preview";

/**
 * The development harnesses: `npm run dev` (`index.html`) and Storybook (#15).
 *
 * `index.html` passed `render()` an `apiKey` and a `region` it no longer takes,
 * from variables `.env.example` set under names Storybook never read, while
 * Storybook read two names nothing set, and fell back to a host that does not
 * resolve. The GitHub Pages workflow set two more that nothing read.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const text = (path: string) => readFileSync(join(root, path), "utf8");
const HARNESSES = globSync(["index.html", ".storybook/*.{ts,tsx}", "src/stories/*.{ts,tsx}"], { cwd: root }).sort();
const names = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].map(([, name]) => name);

describe("development harnesses", () => {
  it("read every variable .env.example or the Pages workflow sets, and read nothing else", () => {
    const readByHarness = new Set(
      HARNESSES.flatMap((file) => names(text(file), /import\.meta\.env\.((?:STORYBOOK|VITE)_[A-Z_]+)/g)),
    );
    const set = [
      ...names(text(".env.example"), /^((?:STORYBOOK|VITE)_[A-Z_]+)=/gm),
      ...names(text(".github/workflows/deploy-github-pages.yml"), /^\s+((?:STORYBOOK|VITE)_[A-Z_]+):/gm),
    ];

    expect(readByHarness.size).toBeGreaterThan(0);
    expect(
      [...readByHarness].filter((name) => !set.includes(name)),
      "read, never set",
    ).toEqual([]);
    expect(
      set.filter((name) => !readByHarness.has(name)),
      "set, never read",
    ).toEqual([]);
  });

  it("invent no API host to fall back on", () => {
    for (const file of HARNESSES) expect(text(file), file).not.toMatch(/https:\/\/api\.chaosity\.cloud/);
  });

  it("say no API is configured when none is, instead of requesting one", async () => {
    // The test environment sets no STORYBOOK_* variable, which is the state of
    // a fresh clone and of the published Storybook.
    const Probe = () => {
      const { apiUrl, error } = useLocationClient();
      return <output data-testid="probe">{error ?? `apiUrl=${apiUrl}`}</output>;
    };
    const decorate = preview.decorators as ((Story: ComponentType) => React.ReactElement)[];
    const Decorated = decorate.reduce<ComponentType>((Inner, decorator) => () => decorator(Inner), Probe);
    render(<Decorated />);

    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent(/STORYBOOK_API_URL/));
  });
});
