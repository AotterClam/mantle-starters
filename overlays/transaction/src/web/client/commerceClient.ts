export const commerceClientJs = [`
const CART_KEY = 'mantle-cart-v1';
const readCart = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) =>
      item && typeof item.productSlug === 'string' && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 99
    ) : [];
  } catch { return []; }
};
const writeCart = (cart) => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount(cart);
};
const updateCartCount = (cart = readCart()) => {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('[data-cart-link]').forEach((link) => {
    const badge = link.querySelector('[data-cart-count]');
    if (!badge) return;
    badge.textContent = String(count);
    badge.hidden = count === 0;
    link.setAttribute('aria-label', count ? (link.dataset.cartLabel + ': ' + count) : link.dataset.cartLabel);
  });
};
const catalog = () => new Map(Array.from(document.querySelectorAll('[data-commerce-product]'), (node) => [
  node.dataset.productSlug,
  {
    title: node.dataset.productTitle || node.dataset.productSlug,
    priceMinor: Number(node.dataset.priceMinor),
    currency: node.dataset.currency,
    coverUrl: node.dataset.coverUrl,
  },
]));
const money = (minor, currency) => new Intl.NumberFormat(document.documentElement.lang || 'en', {
  style: 'currency', currency,
}).format(minor / 100);
const cartTotal = (cart, products) => cart.reduce((sum, item) => {
  const product = products.get(item.productSlug);
  return sum + (product ? product.priceMinor * item.quantity : 0);
}, 0);

document.querySelectorAll('[data-add-to-cart]').forEach((button) => {
  button.addEventListener('click', () => {
    const productSlug = button.dataset.productSlug;
    if (!productSlug) return;
    const cart = readCart();
    const existing = cart.find((item) => item.productSlug === productSlug);
    if (existing) existing.quantity = Math.min(99, existing.quantity + 1);
    else cart.push({ productSlug, quantity: 1 });
    writeCart(cart);
    const label = button.textContent;
    button.textContent = button.dataset.addedLabel || label;
    setTimeout(() => { button.textContent = label; }, 900);
  });
});

const renderCart = () => {
  const root = document.querySelector('[data-cart-page]');
  if (!root) return;
  const itemsRoot = root.querySelector('[data-cart-items]');
  const empty = root.querySelector('[data-cart-empty]');
  const layout = root.querySelector('[data-cart-layout]');
  const total = root.querySelector('[data-cart-total]');
  const products = catalog();
  const cart = readCart().filter((item) => products.has(item.productSlug));
  writeCart(cart);
  itemsRoot.replaceChildren();
  for (const item of cart) {
    const product = products.get(item.productSlug);
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[6rem_minmax(0,1fr)]';
    const media = document.createElement('div');
    media.className = 'aspect-square overflow-hidden rounded-lg bg-muted';
    if (product.coverUrl) {
      const image = document.createElement('img');
      image.src = product.coverUrl; image.alt = product.title; image.loading = 'lazy';
      image.className = 'h-full w-full object-cover'; media.append(image);
    }
    const details = document.createElement('div');
    details.className = 'min-w-0';
    const heading = document.createElement('div');
    heading.className = 'flex items-start justify-between gap-4';
    const name = document.createElement('strong');
    name.className = 'min-w-0'; name.textContent = product.title;
    const line = document.createElement('strong');
    line.className = 'shrink-0'; line.textContent = money(product.priceMinor * item.quantity, product.currency);
    heading.append(name, line);
    const unitPrice = document.createElement('p');
    unitPrice.className = 'mt-1 text-sm text-foreground-muted'; unitPrice.textContent = money(product.priceMinor, product.currency);
    const controls = document.createElement('div');
    controls.className = 'mt-5 flex items-end justify-between gap-4';
    const quantityLabel = document.createElement('label');
    quantityLabel.className = 'grid gap-1.5 text-xs font-medium text-foreground-muted';
    const quantityText = document.createElement('span');
    quantityText.textContent = root.dataset.quantityLabel || 'Quantity';
    const quantity = document.createElement('input');
    quantity.type = 'number'; quantity.min = '1'; quantity.max = '99'; quantity.value = String(item.quantity);
    quantity.className = 'h-9 w-20 rounded-lg border border-border bg-background px-2 text-sm text-foreground';
    quantity.setAttribute('aria-label', product.title + ' ' + (root.dataset.quantityLabel || 'quantity'));
    quantityLabel.append(quantityText, quantity);
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = root.dataset.removeLabel || 'Remove';
    remove.className = 'min-h-9 px-1 text-sm font-medium text-destructive hover:underline';
    remove.setAttribute('aria-label', (root.dataset.removeLabel || 'Remove') + ' ' + product.title);
    quantity.addEventListener('change', () => {
      item.quantity = Math.max(1, Math.min(99, Number(quantity.value) || 1));
      writeCart(cart); renderCart();
    });
    remove.addEventListener('click', () => { writeCart(cart.filter((value) => value !== item)); renderCart(); });
    controls.append(quantityLabel, remove); details.append(heading, unitPrice, controls); row.append(media, details); itemsRoot.append(row);
  }
  const hasItems = cart.length > 0;
  empty.hidden = hasItems; layout.hidden = !hasItems;
  if (hasItems) total.textContent = money(cartTotal(cart, products), products.get(cart[0].productSlug).currency);
};

const renderCheckout = () => {
  const root = document.querySelector('[data-cart-summary]');
  if (!root) return;
  const totalRow = document.querySelector('[data-checkout-total-row]');
  const total = document.querySelector('[data-checkout-total]');
  const products = catalog();
  const cart = readCart().filter((item) => products.has(item.productSlug));
  root.replaceChildren();
  for (const item of cart) {
    const product = products.get(item.productSlug);
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 py-4';
    const media = document.createElement('div');
    media.className = 'aspect-square overflow-hidden rounded-md bg-muted';
    if (product.coverUrl) {
      const image = document.createElement('img');
      image.src = product.coverUrl; image.alt = ''; image.loading = 'lazy';
      image.className = 'h-full w-full object-cover'; media.append(image);
    }
    const name = document.createElement('span');
    name.className = 'min-w-0 text-sm'; name.textContent = product.title + ' × ' + item.quantity;
    const price = document.createElement('strong'); price.className = 'shrink-0 text-sm'; price.textContent = money(product.priceMinor * item.quantity, product.currency);
    row.append(media, name, price); root.append(row);
  }
  const form = document.querySelector('[data-checkout-form]');
  const hasItems = cart.length > 0;
  form.querySelector('button[type="submit"]').disabled = !hasItems;
  totalRow.hidden = !hasItems;
  if (hasItems) {
    total.textContent = money(cartTotal(cart, products), products.get(cart[0].productSlug).currency);
  } else {
    root.textContent = root.dataset.emptyLabel || 'Cart is empty.';
  }
};

document.querySelectorAll('[data-checkout-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = form.querySelector('[data-commerce-status]');
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true; status.textContent = '';
    try {
      const fields = Object.fromEntries(new FormData(form));
      const response = await fetch('/api/commerce/orders', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...fields, locale: form.dataset.locale, items: readCart() }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        const diagnostic = payload.diagnostic;
        const message = diagnostic?.code === 'CONFLICT' && diagnostic.path === '/items'
          ? form.dataset.stockInsufficientLabel
          : diagnostic?.message;
        throw new Error(message || form.dataset.errorLabel);
      }
      localStorage.removeItem(CART_KEY); updateCartCount([]);
      location.href = '/' + form.dataset.locale.toLowerCase() + '/pay/' + payload.data.orderToken;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : form.dataset.errorLabel;
      button.disabled = false;
    }
  });
});

document.querySelectorAll('[data-order-action]').forEach((button) => {
  button.addEventListener('click', async () => {
    const status = button.closest('div')?.parentElement?.querySelector('[data-commerce-status]');
    document.querySelectorAll('[data-order-action]').forEach((control) => { control.disabled = true; });
    try {
      const action = button.dataset.orderAction;
      const response = await fetch('/api/commerce/orders/' + (action === 'pay' ? 'pay' : 'cancel'), {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderToken: button.dataset.orderToken }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.diagnostic?.message || button.dataset.errorLabel);
      location.href = '/' + button.dataset.locale.toLowerCase() + '/orders/' + button.dataset.orderToken;
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : button.dataset.errorLabel;
      document.querySelectorAll('[data-order-action]').forEach((control) => { control.disabled = false; });
    }
  });
});

updateCartCount();
renderCart();
renderCheckout();
`];
