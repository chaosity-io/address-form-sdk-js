import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * maplibre-gl 6.4.1 or later, and the worker it needs.
 *
 * GHSA-jrc7-96c5-q579 is a critical XSS in maplibre-gl up to 6.4.0: its
 * sanitizer skipped the attribute after each one it removed, so an attribution
 * string carrying two event handlers kept the second. 6.4.1 is the first
 * release with the fix, and there is no 5.x one. This package installs
 * maplibre-gl as a dependency, and the standalone bundle ships whichever copy
 * the lockfile installed, so both start at 6.4.1.
 *
 * maplibre 6 finds its worker from `import.meta.url`, which a bundler rewrites
 * and a UMD build empties, and without one the map mounts and draws no tile.
 * So the React map takes `workerUrl`, which the README's example passes, and
 * the standalone bundle carries the worker itself. `scripts/smoke-dist.mjs`
 * checks that the built bundle carries the installed maplibre-gl.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const FIRST_PATCHED = [6, 4, 1] as const;

const atLeastPatched = (version: string) => {
  const v = version.split(".").map(Number);
  for (let i = 0; i < FIRST_PATCHED.length; i++) {
    if (v[i] !== FIRST_PATCHED[i]) return v[i] > FIRST_PATCHED[i];
  }
  return true;
};

const parse = (code: string) => ts.createSourceFile("block.tsx", code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const walk = (node: ts.Node, visit: (node: ts.Node) => void) => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

describe("maplibre-gl version", () => {
  it("depends on a caret range from 6.4.1", () => {
    const range: string = JSON.parse(read("package.json")).dependencies["maplibre-gl"];
    const floor = /^\^(\d+\.\d+\.\d+)$/.exec(range)?.[1];

    expect(floor, `${range} is not a plain ^x.y.z range`).toBeDefined();
    expect(atLeastPatched(floor!), `${range} admits a vulnerable release`).toBe(true);
  });

  it("installs no vulnerable copy anywhere in the lockfile", () => {
    const packages: Record<string, { version: string }> = JSON.parse(read("package-lock.json")).packages;
    const copies = Object.entries(packages).filter(([path]) => /(^|\/)node_modules\/maplibre-gl$/.test(path));

    expect(copies.length).toBeGreaterThan(0);
    expect(
      copies.filter(([, entry]) => !atLeastPatched(entry.version)).map(([path, e]) => `${path}@${e.version}`),
    ).toEqual([]);
  });
});

describe("the README on maplibre 6", () => {
  const blocks = [...read("README.md").matchAll(/^```(jsx|tsx|js|ts|javascript|typescript)\n([\s\S]*?)^```/gm)].map(
    (m) => m[2],
  );

  it("passes workerUrl to every map its React examples render", () => {
    const maps: string[] = [];
    for (const code of blocks) {
      walk(parse(code), (node) => {
        if (!ts.isJsxSelfClosingElement(node) && !ts.isJsxOpeningElement(node)) return;
        const tag = node.tagName.getText();
        if (tag !== "AddressForm.Map" && tag !== "Map") return;
        const passes = node.attributes.properties.some((p) => ts.isJsxAttribute(p) && p.name.getText() === "workerUrl");
        maps.push(`${tag}${passes ? " workerUrl" : ""}`);
      });
    }

    expect(maps.length).toBeGreaterThan(0);
    expect(maps.filter((m) => !m.endsWith(" workerUrl"))).toEqual([]);
  });

  it("never imports a default from maplibre-gl, which has none", () => {
    const defaults = blocks.flatMap((code) =>
      parse(code).statements.filter(
        (s) =>
          ts.isImportDeclaration(s) &&
          ts.isStringLiteral(s.moduleSpecifier) &&
          s.moduleSpecifier.text === "maplibre-gl" &&
          s.importClause?.name,
      ),
    );

    expect(defaults.map((s) => s.getText())).toEqual([]);
  });
});

describe("the standalone entry", () => {
  /**
   * The bundle is loaded from a CDN as one classic script: there is no worker
   * file beside it to find, so it hands MapLibre the one it carries. Dropping
   * this call leaves every standalone map blank, and nothing else notices.
   */
  it("hands setWorkerUrl the worker the bundle carries", () => {
    const source = parse(read("lib/main-standalone.tsx"));
    const imports = new Map<string, string>();
    for (const s of source.statements) {
      if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) continue;
      const clause = s.importClause;
      if (clause?.name) imports.set(clause.name.text, `${s.moduleSpecifier.text}#default`);
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const e of clause.namedBindings.elements) {
          imports.set(e.name.text, `${s.moduleSpecifier.text}#${(e.propertyName ?? e.name).text}`);
        }
      }
    }

    const calls: string[] = [];
    walk(source, (node) => {
      if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return;
      if (imports.get(node.expression.text) !== "maplibre-gl#setWorkerUrl") return;
      const used = new Set<string>();
      walk(node.arguments[0], (n) => ts.isIdentifier(n) && imports.has(n.text) && used.add(imports.get(n.text)!));
      calls.push([...used].sort().join(","));
    });

    expect(calls).toEqual(["virtual:maplibre-worker#default"]);
  });
});
