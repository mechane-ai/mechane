import { useEffect, useState } from 'react';

/** A color as a canvas draws it: red, green, blue and alpha, each from 0 to 255. */
export type DrawColor = readonly [red: number, green: number, blue: number, alpha: number];

const CHANNEL_MAX = 255;
const watchedAttributes: ReadonlyArray<string> = ['class', 'data-theme'];

/**
 * The concrete colors of theme colors, such as `chartToneColors[tone]`, where `element` sits in the page. A canvas
 * cannot read CSS custom properties, so a layer resolves its colors here before each draw.
 */
export function resolveColors(element: HTMLElement, colors: ReadonlyArray<string>): ReadonlyArray<DrawColor> {
  const probe = element.ownerDocument.createElement('canvas');

  probe.width = 1;
  probe.height = 1;

  const context = probe.getContext('2d', { willReadFrequently: true });
  const view = element.ownerDocument.defaultView;

  if (context === null || view === null) {
    return colors.map(() => [0, 0, 0, CHANNEL_MAX]);
  }

  const resolved = colors.map((color) => {
    element.style.setProperty('color', color);

    context.clearRect(0, 0, 1, 1);

    context.fillStyle = view.getComputedStyle(element).color;

    context.fillRect(0, 0, 1, 1);

    const [red = 0, green = 0, blue = 0, alpha = CHANNEL_MAX] = context.getImageData(0, 0, 1, 1).data;

    return [red, green, blue, alpha] as const;
  });

  element.style.removeProperty('color');

  return resolved;
}

/** A color with its channels from 0 to 1, as a shader takes it. */
export function unitColor([red, green, blue, alpha]: DrawColor): DrawColor {
  return [red / CHANNEL_MAX, green / CHANNEL_MAX, blue / CHANNEL_MAX, alpha / CHANNEL_MAX];
}

/**
 * A number that changes whenever the colors or the pixel density under `element` may have changed. The causes are a
 * theme class on an ancestor, the system color scheme, or the window moving to a screen with another pixel ratio. A
 * canvas layer redraws when it changes.
 */
export function useDrawRevision(element: HTMLElement | null): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const view = element?.ownerDocument.defaultView;

    if (element === null || view === null || view === undefined) {
      return;
    }

    function bump(): void {
      setRevision((current) => current + 1);
    }

    const observer = new MutationObserver(bump);
    const scheme = view.matchMedia('(prefers-color-scheme: dark)');
    const density = view.matchMedia(`(resolution: ${view.devicePixelRatio}dppx)`);

    const walk: { node: Element | null } = { node: element };

    while (walk.node !== null) {
      observer.observe(walk.node, { attributes: true, attributeFilter: [...watchedAttributes] });

      walk.node = walk.node.parentElement;
    }

    scheme.addEventListener('change', bump);
    density.addEventListener('change', bump);

    return () => {
      observer.disconnect();
      scheme.removeEventListener('change', bump);
      density.removeEventListener('change', bump);
    };
  }, [element, revision]);

  return revision;
}
