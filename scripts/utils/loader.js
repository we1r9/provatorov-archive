document.documentElement.style.overflow = "hidden";

window.addEventListener('load', () => {
  const loader = document.getElementById('loading');

  if (!loader) {
    document.documentElement.style.overflow = "";
    document.body.classList.remove('preload-lock');
    return;
  }

  const now       = performance.now?.() || Date.now();
  const elapsed   = now - (window.__loaderStart || now);
  const minShow   = 300;
  const remaining = Math.max(0, minShow - elapsed);

  const cleanup = () => {
    document.documentElement.style.overflow = "";
    document.body.classList.remove('preload-lock');
  };

  const hide = () => {
    loader.classList.add('hidden');
    cleanup();

    let removed = false;
    const finalize = () => {
      if (removed) return;
      removed = true;
      if (loader && loader.parentNode) loader.parentNode.removeChild(loader);
    };
    loader.addEventListener('transitionend', finalize, { once: true });
    setTimeout(finalize, 500);
  };

  setTimeout(hide, remaining);
});