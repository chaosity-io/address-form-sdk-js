import { globSync } from "glob";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * What the README promises about the package, held to the package.
 *
 * Both cases are statements a later change can falsify without touching the
 * README: a map attribute documented but never read (#16), and peer ranges a
 * release moves (#4). A test is the one place that notices.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const README = read("README.md");

describe("README", () => {
  it("documents no data-* attribute that render() does not read (#16)", () => {
    const documented = new Set([...README.matchAll(/`data-([a-z-]+)`/g)].map(([, name]) => name));
    const readByRender = new Set(
      [...read("lib/components/AddressFormReact/render.tsx").matchAll(/dataset, "([a-zA-Z]+)"/g)].map(([, name]) =>
        name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      ),
    );

    expect(documented.size).toBeGreaterThan(0);
    expect([...documented].filter((name) => !readByRender.has(name))).toEqual([]);
  });

  /**
   * The troubleshooting links used to name a path the documentation site no
   * longer serves (a 404), and one of them is printed to the console for every
   * failed request. Whether a URL answers is a network question, so this holds
   * what can be held offline: one address, stated once in the shipped code.
   */
  it("points every documentation link at the address-form page, stated once in the code (#4)", () => {
    const PAGE = "https://docs.chaosity.cloud/docs/client-libraries/address-form";
    const sources = globSync("lib/**/*.{ts,tsx}", { cwd: root, ignore: ["**/*.test.*", "lib/test/**"] }).sort();
    const links = (text: string) =>
      [...text.matchAll(/https:\/\/docs\.chaosity\.cloud[^\s)"'`]*/g)]
        .map(([url]) => url)
        // The API reference is its own page.
        .filter((url) => url !== "https://docs.chaosity.cloud/api");

    expect(links(README).filter((url) => url !== PAGE)).toEqual([]);
    expect(sources.flatMap((file) => links(read(file)).filter((url) => url !== PAGE))).toEqual([]);
    expect(sources.filter((file) => read(file).includes(PAGE))).toHaveLength(1);
  });

  /**
   * The library build extracts every style it has, its own and MapLibre's, into
   * one stylesheet and imports none of it: a React application's bundler owns
   * its CSS. So the example has to import it. Without that line, the example
   * rendered with its suggestion list over the fields and the map's controls
   * as bare buttons (#29). `scripts/smoke-dist.mjs` checks that the path
   * resolves in the packed package.
   */
  it("imports the package's stylesheet in the React example (#29)", () => {
    const example = README.match(/```jsx\n([\s\S]*?)```/)?.[1] ?? "";

    expect(example).toContain('import "@chaosity/address-form/dist/lib/address-form.css";');
  });

  it("states the peer ranges package.json declares (#4)", () => {
    const { peerDependencies } = JSON.parse(read("package.json")) as { peerDependencies: Record<string, string> };

    for (const [name, range] of Object.entries(peerDependencies)) {
      expect(README, `${name} ${range}`).toContain(`\`${name}\` \`${range}\``);
    }
  });
});
