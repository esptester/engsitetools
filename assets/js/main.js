(() => {
  // Mobile navigation
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');

  if (header && toggle) {
    const setOpen = (open) => {
      header.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };

    toggle.addEventListener('click', () => {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && header.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (!header.contains(event.target) || event.target.closest('.nav a')) setOpen(false);
    });

    window.matchMedia('(min-width: 761px)').addEventListener('change', (event) => {
      if (event.matches) setOpen(false);
    });
  }

  // Keep the copyright year current
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  // Copy-to-clipboard buttons (only shown where the Clipboard API is available)
  if (navigator.clipboard) {
    document.querySelectorAll('[data-copy]').forEach((button) => {
      const label = button.textContent;
      button.hidden = false;
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.copy);
          button.textContent = 'Copied';
        } catch {
          button.textContent = 'Copy failed';
        }
        setTimeout(() => { button.textContent = label; }, 2000);
      });
    });
  }
})();
