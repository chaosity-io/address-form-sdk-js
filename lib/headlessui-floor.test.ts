import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `@headlessui/react` at or above 2.2.10 (AGENTS.md, "Version floors").
 *
 * Up to 2.2.9 it throws a `DataInteractive` Fragment error on a cold load under
 * React 19 with a Server Components host. The range used to be `^2.2.2`, which
 * held the floor only for the standalone bundle, through this lockfile: a React
 * consumer's own install could resolve 2.2.9. The range is the floor now, and
 * this holds it, and every copy the lockfile installs.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const FLOOR = [2, 2, 10];
const atLeastFloor = (version: string) => {
  const v = version.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (v[i] !== FLOOR[i]) return v[i] > FLOOR[i];
  return true;
};

describe("@headlessui/react version", () => {
  it("depends on a caret range from 2.2.10", () => {
    const range: string = JSON.parse(read("package.json")).dependencies["@headlessui/react"];
    const floor = /^\^(\d+\.\d+\.\d+)$/.exec(range)?.[1];
    expect(floor, `${range} is not a plain ^x.y.z range`).toBeDefined();
    expect(atLeastFloor(floor!), `${range} admits a release that crashes a cold load`).toBe(true);
  });

  it("installs no earlier copy anywhere in the lockfile", () => {
    const packages: Record<string, { version: string }> = JSON.parse(read("package-lock.json")).packages;
    const copies = Object.entries(packages).filter(([path]) => /(^|\/)node_modules\/@headlessui\/react$/.test(path));
    expect(copies.length).toBeGreaterThan(0);
    expect(copies.filter(([, p]) => !atLeastFloor(p.version)).map(([path, p]) => `${path}@${p.version}`)).toEqual([]);
  });
});
