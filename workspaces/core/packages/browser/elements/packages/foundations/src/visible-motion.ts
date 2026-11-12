import { useEffect, useRef, useState } from 'react';

export function useVisibleMotion(isEnabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!isEnabled || element === null) {
      return;
    }

    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let isVisible = false;

    function update() {
      setIsActive(isVisible && !document.hidden && !preference.matches);
    }

    const observer = new IntersectionObserver((entries) => {
      isVisible = entries.some((entry) => entry.isIntersecting);

      update();
    });

    observer.observe(element);
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);

    return () => {
      observer.disconnect();
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [isEnabled]);

  return { ref, isActive: isEnabled && isActive };
}
