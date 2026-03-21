import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentInjector } from "./index";

describe("ComponentInjector", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("replaces elements with React components", () => {
    document.body.innerHTML = `
      <div id="parent">
        <span class="target">Original</span>
      </div>
    `;

    render(
      <ComponentInjector
        selector="#parent"
        replacements={[
          {
            selector: ".target",
            component: (element) => <div>Replaced: {element.textContent}</div>,
          },
        ]}
      />,
    );

    expect(document.querySelector(".target")).toBeNull();
    expect(document.body.textContent).toContain("Replaced: Original");
  });

  it("handles missing parent element", () => {
    render(
      <ComponentInjector
        selector="#nonexistent"
        replacements={[
          {
            selector: ".target",
            component: () => <div>Should not render</div>,
          },
        ]}
      />,
    );

    expect(document.body.textContent).not.toContain("Should not render");
  });

  it("passes attributes from target element to replacement component", () => {
    document.body.innerHTML = `
      <div id="parent">
        <input class="target" data-testid="original" placeholder="Enter text" />
      </div>
    `;

    render(
      <ComponentInjector
        selector="#parent"
        replacements={[
          {
            selector: ".target",
            component: (element) => (
              <div data-testid={element.getAttribute("data-testid")}>{element.getAttribute("placeholder")}</div>
            ),
          },
        ]}
      />,
    );

    expect(document.querySelector('[data-testid="original"]')).toBeInTheDocument();
    expect(document.body.textContent).toContain("Enter text");
  });
});
