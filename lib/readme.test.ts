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
   * The README said `data-api-name` defaulted to `"suggest"` while both places
   * that read it default to `"autocomplete"` (#38), so a page leaving it out
   * got a different API, and a different bill, from the one documented. Every
   * default the attribute tables state is held to the code that applies it:
   * the `?? value` where a field reads its attribute (the React fields and
   * render(), which must agree), or the component's own default where render()
   * passes the attribute through.
   */
  it("states the default the code applies, for every attribute with one (#38)", () => {
    const unquote = (v: string) => v.replace(/^`|`$/g, "").replace(/^"|"$/g, "");
    // A row is `| \`data-x\` | default | …` (the field tables) or
    // `| prop | type | \`data-x\` | default | …` (the map table).
    const stated = new Map<string, string>();
    for (const line of README.split("\n")) {
      const cells = line.split("|").map((c) => c.trim());
      const i = cells.findIndex((c) => /^`data-[a-z-]+`$/.test(c));
      if (i < 0 || !cells[i + 1] || cells[i + 1] === "-") continue;
      stated.set(cells[i].slice(1, -1), unquote(cells[i + 1]));
    }

    const camel = (attr: string) => attr.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    const fields = read("lib/components/AddressFormReact/AddressFormFields.tsx");
    const render = read("lib/components/AddressFormReact/render.tsx");
    const components = globSync("lib/components/**/*.tsx", { cwd: root, ignore: ["**/*.test.*"] })
      .map(read)
      .join("\n");

    const wrong: string[] = [];
    for (const [attr, value] of stated) {
      const applied = [
        new RegExp(`\\(rest, "${attr}"\\) \\?\\? ("?[\\w-]+"?)`).exec(fields)?.[1],
        new RegExp(`\\(element\\.dataset, "${camel(attr)}"\\) \\?\\? ("?[\\w-]+"?)`).exec(render)?.[1],
      ].filter((v): v is string => v !== undefined);
      // Passed through as undefined: the component's parameter default decides.
      if (applied.length === 0) {
        const param = new RegExp(`\\b${camel(attr)} = ("?[\\w-]+"?),`).exec(components)?.[1];
        if (param !== undefined) applied.push(param);
      }
      if (applied.length === 0) wrong.push(`${attr}: no default found in the code`);
      for (const v of applied) if (unquote(v) !== value) wrong.push(`${attr}: README "${value}", code ${v}`);
    }

    expect(stated.size).toBeGreaterThanOrEqual(4);
    expect(wrong).toEqual([]);
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
