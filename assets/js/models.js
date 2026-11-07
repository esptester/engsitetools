// Loads the 3D example models only when their section comes near the screen.
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
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        start();
      }
    }, { rootMargin: '600px 0px' });
    io.observe(root);
  } else {
    start();
  }
})();
