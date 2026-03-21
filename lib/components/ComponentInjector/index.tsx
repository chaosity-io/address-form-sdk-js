import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ComponentInjectorProps<T extends HTMLElement> {
  selector: string;
  replacements: Array<{ selector: string; component: (element: T) => ReactNode }>;
}

/**
 * Replaces DOM elements with React components using portals.
 *
 * @param selector - CSS selector for the root element to search within
 * @param replacements - Array of replacement configurations with selector and component factory
 * @returns React portals that render components in place of the original DOM elements
 */
export const ComponentInjector = <T extends HTMLElement>({
  selector,
  replacements,
}: ComponentInjectorProps<T>): ReactNode => {
  const [containers, setContainers] = useState<
    Array<{
      container: Element;
      component: (element: T) => ReactNode;
      originalElement: T;
    }>
  >([]);

  const replacementsRef = useRef(replacements);
  replacementsRef.current = replacements;

  useEffect(() => {
    const root = document.querySelector(selector);

    if (!root) {
      setContainers([]);
      return;
    }

    const currentContainers = replacementsRef.current
      .map(({ selector, component }) => {
        const element = root.querySelector(selector);

        if (!element) {
          return null;
        }

        const container = document.createElement("div");
        element.parentElement?.insertBefore(container, element);
        const originalElement = element.cloneNode(true) as T;
        element.remove();

        return { container, component, originalElement };
      })
      .filter(Boolean) as Array<{
      container: Element;
      component: (element: T) => ReactNode;
      originalElement: T;
    }>;

    setContainers(currentContainers);

    return () => {
      currentContainers.forEach(({ container }) => {
        container.remove();
      });
    };
  }, [selector]);

  return (
    <>
      {containers.map(({ container, component, originalElement }, index) => {
        return createPortal(component(originalElement), container, index);
      })}
    </>
  );
};
