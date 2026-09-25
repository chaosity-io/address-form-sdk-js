import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Plan features are named where the options are offered (#22).
 *
 * The service gates some map options by plan and refuses the rest with 403
 * `FeatureNotEntitledException`. The ones that reach this form are the Hybrid
 * and Satellite styles (`satellite`) and the MAP's political view
 * (`political-view`). The form's own `politicalView` shapes address
 * suggestions and is open to every plan, so the form's prop and the map's
 * share a name and only the map's can blank it. Each place that offers one of
 * them says so.
 */

const here = dirname(fileURLToPath(import.meta.url));
const source = (path: string) => {
  const file = join(here, path);
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
};

/** The JSDoc text on the first node `find` accepts. */
const docOf = (path: string, find: (node: ts.Node) => boolean): string => {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (!found && find(node)) found = node;
    ts.forEachChild(node, visit);
  };
  visit(source(path));
  if (!found) throw new Error(`nothing matched in ${path}`);
  return ts
    .getJSDocCommentsAndTags(found)
    .map((d) => d.getText())
    .join("\n");
};

const typeAlias = (name: string) => (n: ts.Node) => ts.isTypeAliasDeclaration(n) && n.name.text === name;
const member = (iface: string, name: string) => (n: ts.Node) =>
  ts.isPropertySignature(n) &&
  n.name.getText() === name &&
  ts.isInterfaceDeclaration(n.parent) &&
  n.parent.name.text === iface;

describe("the JSDoc", () => {
  it("MapStyleType names the satellite feature for Hybrid and Satellite", () => {
    const doc = docOf("components/Map/index.tsx", typeAlias("MapStyleType"));
    expect(doc).toContain("`satellite`");
    expect(doc).toMatch(/Hybrid[\s\S]*Satellite/);
  });

  /**
   * Every `politicalView` a caller can set, found by walking `lib/` rather
   * than listed (review round 1): each says which kind it is — the map's plan
   * feature, or open to every plan. A function parameter is not a site: the
   * only one, `getMapStyle`'s, is fed from `MapProps.politicalView`.
   */
  it("every politicalView property says whether it is the plan feature", () => {
    const files = (ts.sys.readDirectory(here, [".ts", ".tsx"]) as string[]).filter(
      (f) => !/\.test\.tsx?$|setup-tests|\.css\.ts$/.test(f),
    );
    const found: string[] = [];
    const unsaid: string[] = [];
    for (const file of files) {
      const visit = (node: ts.Node) => {
        if (ts.isPropertySignature(node) && node.name.getText() === "politicalView") {
          const where = `${file.slice(here.length + 1)}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
          found.push(where);
          const doc = ts
            .getJSDocCommentsAndTags(node)
            .map((d) => d.getText())
            .join("\n");
          if (!doc.includes("`political-view`") && !/every plan/.test(doc)) unsaid.push(where);
        }
        ts.forEachChild(node, visit);
      };
      visit(source(file.slice(here.length + 1)));
    }
    expect(found.length, "the walk found the known declarations").toBeGreaterThanOrEqual(6);
    expect(unsaid).toEqual([]);
  });

  it("the map's politicalView names the political-view feature", () => {
    expect(docOf("components/Map/index.tsx", member("MapProps", "politicalView"))).toContain("`political-view`");
  });

  it("the deprecated form's politicalView, which reaches its map, names it too", () => {
    expect(docOf("components/AddressForm/index.tsx", member("AddressFormProps", "politicalView"))).toContain(
      "`political-view`",
    );
  });

  it("the form's own politicalView says it is not the gated one", () => {
    const doc = docOf("components/AddressFormReact/AddressForm.tsx", member("AddressFormProps", "politicalView"));
    expect(doc).toMatch(/every plan/);
    expect(doc).toContain("AddressForm.Map");
  });
});

const README = readFileSync(join(here, "../README.md"), "utf8");
const section = (heading: string) => {
  const start = README.indexOf(heading);
  expect(start, heading).toBeGreaterThan(-1);
  const rest = README.slice(start + heading.length);
  // Sub-headings (`#### Props`) belong to the section; the next `###` ends it.
  const next = rest.search(/^#{1,3} /m);
  return next === -1 ? rest : rest.slice(0, next);
};

describe("the README", () => {
  it("names the satellite feature on every line offering Hybrid or Satellite", () => {
    const offending = README.split("\n")
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /\bHybrid\b|\bSatellite\b/.test(line) && !line.includes("`satellite`"))
      .map(([n, line]) => `README.md:${n} ${line.trim()}`);
    expect(offending).toEqual([]);
  });

  it("documents AddressForm.Map's politicalView as the political-view feature", () => {
    const row = section("### AddressForm.Map")
      .split("\n")
      .find((l) => l.startsWith("| `politicalView`"));
    expect(row, "a politicalView row in the AddressForm.Map table").toBeDefined();
    expect(row).toContain("`political-view`");
  });

  it("says the form's politicalView is for suggestions and open to every plan", () => {
    const row = section("### AddressForm\n")
      .split("\n")
      .find((l) => l.startsWith("| `politicalView`"));
    expect(row).toMatch(/suggestions/);
    expect(row).toMatch(/every plan/);
  });

  /**
   * Every React value the style table gives compiles against `MapStyle`
   * (#24): the table offered `['Hybrid']` and `['Satellite']`, which the type
   * rejects, so a TypeScript consumer copying it got TS2322. Checked by
   * compiling the table's own cells, not a copy of them.
   */
  // Builds a TypeScript program: ~1.5 s alone, far longer under the suite's
  // parallel coverage run, so it gets the room vite.config.ts explains for the
  // heaviest render. No assertion changes with it.
  it("gives React style values that type-check against MapStyle", { timeout: 60_000 }, () => {
    const cells = section("#### Map Style Options")
      .split("\n")
      .map((l) => l.match(/^\| `(\[[^`]+\])`/)?.[1])
      .filter((c): c is string => !!c);
    expect(cells.length, "the table's React column").toBeGreaterThanOrEqual(6);

    const file = join(here, "__readme-styles.ts");
    const text = `import type { MapStyle } from "./components/Map";\n${cells
      .map((c, i) => `export const s${i}: MapStyle = ${c};`)
      .join("\n")}\n`;
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      noEmit: true,
      allowImportingTsExtensions: true,
      // Only what `MapStyle` reaches: every @types package would be loaded
      // otherwise, which under the suite's parallel load cost ~40 s.
      types: [],
    };
    const host = ts.createCompilerHost(options);
    const { readFile, fileExists, getSourceFile } = host;
    host.readFile = (f) => (f === file ? text : readFile(f));
    host.fileExists = (f) => f === file || fileExists(f);
    host.getSourceFile = (f, lang, ...rest) =>
      f === file ? ts.createSourceFile(f, text, lang) : getSourceFile(f, lang, ...rest);
    const program = ts.createProgram([file], options, host);
    const source = program.getSourceFile(file)!;
    const errors = ts.getPreEmitDiagnostics(program, source).map((d) => {
      // Line 1 is the import; line n + 2 holds cell n.
      const line = source.getLineAndCharacterOfPosition(d.start ?? 0).line;
      return `${cells[line - 1]}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
    });
    expect(errors).toEqual([]);
  });

  it("says what a refused map shows", () => {
    expect(section("## Error Handling")).toContain("FeatureNotEntitledException");
  });
});
