import { useCallback, useEffect, useRef, useState } from 'react';

const CONTROLS = 'a[href],button,input,select,textarea,summary,[contenteditable="true"],[tabindex]';

/** Adds a stop only when scrolling needs a keyboard target of its own. */
export function useScrollTabIndex<Element extends HTMLElement>() {
  const viewport = useRef<Element | null>(null);
  const [element, setElement] = useState<Element | null>(null);
  const [canScroll, setCanScroll] = useState(false);

  const ref = useCallback((node: Element | null): void => {
    viewport.current = node;

    setElement(node);
  }, []);

  useEffect(() => {
    if (element === null) {
      return;
    }

    const node = element;

    function measure(): void {
      const style = getComputedStyle(node);
      const horizontal = /auto|scroll/u.test(style.overflowX) && node.scrollWidth > node.clientWidth + 1;
      const vertical = /auto|scroll/u.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;

      const hasControl = Array.from(node.querySelectorAll<HTMLElement>(CONTROLS)).some((control) => {
        const isAvailable = !control.matches(':disabled') && control.closest('[hidden],[inert]') === null;

        return isAvailable && control.tabIndex >= 0 && control.getClientRects().length > 0;
      });

      setCanScroll(horizontal || (vertical && !hasControl));
    }

    const resize = new ResizeObserver(measure);

    function observeContent(): void {
      resize.disconnect();
      resize.observe(node);

      for (const child of node.children) {
        resize.observe(child);
      }
    }

    const mutations = new MutationObserver(() => {
      observeContent();
      measure();
    });

    mutations.observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open', 'hidden', 'inert', 'disabled', 'class', 'style'],
    });
    observeContent();

    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [element]);

  return { ref, viewport, tabIndex: canScroll ? 0 : -1 };
}
