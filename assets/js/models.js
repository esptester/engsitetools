// Loads the 3D example models only after the page has loaded and their section comes into view.
(() => {
  const root = document.querySelector('[data-models]');
  if (!root) return;
  const status = root.querySelector('[data-mv-status]');
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    import('./models-3d.js')
      .then((m) => m.mount(root))
      .catch((err) => {
        if (status) {
          status.hidden = false;
          status.textContent = `The 3D examples couldn’t start (${err && err.message ? err.message : err}). Please refresh the page to try again.`;
        }
        root.classList.add('is-failed');
        console.error(err);
      });
  };
  const watch = () => {
    if (!('IntersectionObserver' in window)) {
      start();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: '150px 0px' });
    io.observe(root);
    // held on the element, so the browser can't throw the observer away before it fires
    root.mvLoader = io;
  };
  // Wait for the page itself to finish first, so the 3D never slows the first view
  if (document.readyState === 'complete') watch();
  else window.addEventListener('load', watch, { once: true });
})();
