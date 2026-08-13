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
  document.querySelectorAll('a[href$="/cart"]').forEach((link) => {
    let badge = link.querySelector('[data-cart-count]');
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.cartCount = '';
      badge.className = 'ml-1 text-xs';
      link.append(badge);
    }
    badge.textContent = count ? '(' + count + ')' : '';
  });
};
const catalog = () => new Map(Array.from(document.querySelectorAll('[data-commerce-product]'), (node) => [
  node.dataset.productSlug,
  {
    title: node.dataset.productTitle || node.dataset.productSlug,
    priceMinor: Number(node.dataset.priceMinor),
    currency: node.dataset.currency,
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
  const totalRow = root.querySelector('[data-cart-total-row]');
  const total = root.querySelector('[data-cart-total]');
  const checkout = root.querySelector('[data-checkout-link]');
  const products = catalog();
  const cart = readCart().filter((item) => products.has(item.productSlug));
  writeCart(cart);
  itemsRoot.replaceChildren();
  for (const item of cart) {
    const product = products.get(item.productSlug);
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4';
    const name = document.createElement('strong');
    name.textContent = product.title;
    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-3';
    const quantity = document.createElement('input');
    quantity.type = 'number'; quantity.min = '1'; quantity.max = '99'; quantity.value = String(item.quantity);
    quantity.className = 'w-20 rounded-lg border border-border bg-background px-2 py-1';
    quantity.setAttribute('aria-label', product.title + ' ' + (root.dataset.quantityLabel || 'quantity'));
    const line = document.createElement('span');
    line.textContent = money(product.priceMinor * item.quantity, product.currency);
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = '×'; remove.className = 'px-2 text-foreground-muted';
    remove.setAttribute('aria-label', (root.dataset.removeLabel || 'Remove') + ' ' + product.title);
    quantity.addEventListener('change', () => {
      item.quantity = Math.max(1, Math.min(99, Number(quantity.value) || 1));
      writeCart(cart); renderCart();
    });
    remove.addEventListener('click', () => { writeCart(cart.filter((value) => value !== item)); renderCart(); });
    controls.append(quantity, line, remove); row.append(name, controls); itemsRoot.append(row);
  }
  const hasItems = cart.length > 0;
  empty.hidden = hasItems; totalRow.hidden = !hasItems; checkout.hidden = !hasItems;
  if (hasItems) total.textContent = money(cartTotal(cart, products), products.get(cart[0].productSlug).currency);
};

const renderCheckout = () => {
  const root = document.querySelector('[data-cart-summary]');
  if (!root) return;
  const products = catalog();
  const cart = readCart().filter((item) => products.has(item.productSlug));
  root.replaceChildren();
  for (const item of cart) {
    const product = products.get(item.productSlug);
    const row = document.createElement('p');
    row.className = 'flex justify-between gap-4 py-2';
    const name = document.createElement('span'); name.textContent = product.title + ' × ' + item.quantity;
    const price = document.createElement('strong'); price.textContent = money(product.priceMinor * item.quantity, product.currency);
    row.append(name, price); root.append(row);
  }
  const form = document.querySelector('[data-checkout-form]');
  if (!cart.length) {
    root.textContent = root.dataset.emptyLabel || 'Cart is empty.';
    form.querySelector('button[type="submit"]').disabled = true;
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
      if (!response.ok || !payload.ok) throw new Error(payload.diagnostic?.message || 'Checkout failed.');
      localStorage.removeItem(CART_KEY); updateCartCount([]);
      location.href = '/' + form.dataset.locale.toLowerCase() + '/pay/' + payload.data.orderToken;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Checkout failed.';
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
      if (!response.ok || !payload.ok) throw new Error(payload.diagnostic?.message || 'Order update failed.');
      location.href = '/' + button.dataset.locale.toLowerCase() + '/orders/' + button.dataset.orderToken;
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : 'Order update failed.';
      document.querySelectorAll('[data-order-action]').forEach((control) => { control.disabled = false; });
    }
  });
});

updateCartCount();
renderCart();
renderCheckout();
`];
