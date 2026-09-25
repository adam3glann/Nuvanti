let revealObserver;
const observed = new Set();

export function initScrollReveal(root = document) {
  const elements = root.querySelectorAll('.reveal:not(.is-visible)');
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduceMotion) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
        observed.delete(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  }

  // Drop detached cards after filters replace the result list.
  observed.forEach((el) => {
    if (!el.isConnected) {
      revealObserver.unobserve(el);
      observed.delete(el);
    }
  });
  elements.forEach((el) => {
    if (observed.has(el)) return;
    observed.add(el);
    revealObserver.observe(el);
  });
}
