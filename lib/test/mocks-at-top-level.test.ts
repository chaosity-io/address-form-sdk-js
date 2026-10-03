import { globSync } from "glob";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Every `vi.mock` is a top-level statement (#39).
 *
 * Vitest hoists `vi.mock` to the top of its module wherever it is written, so
 * one inside a test applies to the whole file, and when two mock the same
 * path, one factory silently replaces the other for every test. A nested call
 * in `AddressForm.test.tsx` did exactly that: the factory written for one test
 * was the one all ten ran with, and the top-level one never ran at all.
 *
 * Read with TypeScript's parser, so a call is found however it is written.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const files = globSync(["lib/**/*.test.ts", "lib/**/*.test.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"], {
  cwd: root,
});

function nestedMocks(file: string): string[] {
  const text = readFileSync(join(root, file), "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "vi" &&
      node.expression.name.text === "mock"
    ) {
      // A top-level statement is an ExpressionStatement whose parent is the
      // source file; anything deeper is inside a function, block or test.
      const statement = node.parent;
      if (!(ts.isExpressionStatement(statement) && statement.parent === sf)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        found.push(`${relative(root, join(root, file))}:${line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe("vi.mock is only ever a top-level statement", () => {
  it("read the test files, so an empty walk cannot pass", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((f) => f.endsWith("AddressForm.test.tsx"))).toBe(true);
  });

  it("finds none below the top level", () => {
    expect(files.flatMap(nestedMocks)).toEqual([]);
  });
});
