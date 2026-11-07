// Loads the 3D equipment model on demand, so it never slows the page's first view. On a computer it starts
// once the page has loaded and the viewer comes into view; on a phone or tablet it waits for a tap on
// "Open the 3D model", so it doesn't use mobile data unasked.
(() => {
  const root = document.querySelector('[data-xv]');
  if (!root) return;
  const open = root.querySelector('[data-xv-open]');
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    root.classList.add('is-loading');
    import('./equipment-3d.js')
      .then((m) => m.mount())
      .catch((err) => {
        const notice = root.querySelector('#notice');
        if (notice) notice.textContent = `The 3D model couldn’t start (${err && err.message ? err.message : err}). Please refresh the page to try again.`;
        root.classList.add('is-failed');
        console.error(err);
      });
  };
  if (open) open.addEventListener('click', start);
  if (window.matchMedia('(max-width: 760px), (pointer: coarse)').matches) return;
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
    root.xvLoader = io;
  };
  if (document.readyState === 'complete') watch();
  else window.addEventListener('load', watch, { once: true });
})();
