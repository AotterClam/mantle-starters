import { accordion } from '/enhance/accordion.js';
accordion();
const THEME_KEY = 'mantle-theme';
const readTheme = () => {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};
const applyTheme = (theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelectorAll('img[src*="/assets/mantle-ocean-hero-light.svg"], img[src*="/assets/mantle-ocean-hero-dark.svg"]').forEach((image) => {
    const src = image.getAttribute('src') || '';
    const nextSrc = theme === 'dark' ? src.replace('/assets/mantle-ocean-hero-light.svg', '/assets/mantle-ocean-hero-dark.svg') : src.replace('/assets/mantle-ocean-hero-dark.svg', '/assets/mantle-ocean-hero-light.svg');
    if (nextSrc && image.getAttribute('src') !== nextSrc) image.setAttribute('src', nextSrc);
  });
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.dataset.theme = theme;
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    button.querySelectorAll('[data-theme-label]').forEach((label) => {
      label.textContent = theme === 'dark' ? button.dataset.lightModeLabel || '' : button.dataset.darkModeLabel || '';
    });
  });
};
applyTheme(readTheme());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!localStorage.getItem(THEME_KEY)) applyTheme(readTheme());
});
document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
});
const updateSiteNav = () => {
  document.querySelectorAll('[data-site-nav]').forEach((nav) => {
    nav.dataset.scrolled = window.scrollY > 8 ? 'true' : 'false';
  });
};
updateSiteNav();
window.addEventListener('scroll', updateSiteNav, { passive: true });
document.querySelectorAll('[data-mobile-nav]').forEach((sheet) => {
  const root = sheet.closest('nav');
  const trigger = root?.querySelector('[data-mobile-nav-trigger]');
  const panel = sheet.querySelector('[data-sheet-content]');
  if (!trigger) return;
  const setOpen = (open) => {
    sheet.dataset.state = open ? 'open' : 'closed';
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) panel?.querySelector('a, button')?.focus();
  };
  trigger.addEventListener('click', () => setOpen(sheet.dataset.state !== 'open'));
  sheet.querySelectorAll('[data-mobile-nav-close]').forEach((el) => {
    el.addEventListener('click', () => setOpen(false));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sheet.dataset.state === 'open') setOpen(false);
  });
});
document.querySelectorAll('[data-mantle-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const isIntake = form.dataset.intakeForm === 'true';
    const status = form.querySelector('[data-mantle-form-status]');
    const button = form.querySelector('button[type="submit"]');
    const turnstile = form.querySelector('.cf-turnstile');
    const setStatus = (message, error) => {
      if (!status) return;
      status.hidden = false;
      status.textContent = message;
      if (error) status.dataset.error = 'true';
      else delete status.dataset.error;
    };
    if (button) button.disabled = true;
    setStatus(form.dataset.mantlePendingMessage || '', false);
    try {
      const body = Object.fromEntries(Array.from(new FormData(form).entries(), ([name, value]) => {
        const control = form.elements.namedItem(name);
        return [name, control?.type === 'number' && value !== '' ? Number(value) : value];
      }));
      const res = await fetch(form.action, {
        method: form.method || 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok === false) {
        throw new Error(payload?.diagnostic?.message || form.dataset.mantleErrorMessage || '');
      }
      form.dispatchEvent(new CustomEvent('mantle:form-success', { detail: { payload } }));
      if (!isIntake) form.reset();
      setStatus(form.dataset.mantleSuccessMessage || '', false);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : form.dataset.mantleErrorMessage || '', true);
    } finally {
      if (turnstile && window.turnstile?.reset) window.turnstile.reset(turnstile);
      if (button) button.disabled = false;
    }
  });
});
