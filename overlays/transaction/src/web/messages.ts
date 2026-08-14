import catalog from "../../.mantle/overlays/transaction/messages.json";

type Messages = typeof catalog.locales.en;

export function messagesForLocale(locale: string): Messages {
  const locales = catalog.locales as unknown as Record<string, Messages>;
  const key = Object.keys(locales).find((candidate) => candidate.toLowerCase() === locale.toLowerCase());
  return locales[key ?? catalog.canonicalLocale] ?? Object.values(locales)[0]!;
}

export function commerceCopy(locale: string) {
  const message = messagesForLocale(locale);
  return {
    shop: message["shop.label"], products: message["shop.products"], product: message["shop.product"],
    back: message["shop.back"], add: message["shop.add"], added: message["shop.added"], noProducts: message["shop.noProducts"],
    cart: message["nav.cart"], emptyCart: message["cart.empty"], quantity: message["cart.quantity"], remove: message["cart.remove"],
    total: message["cart.total"], checkout: message["cart.checkout"], name: message["checkout.name"], email: message["checkout.email"],
    address: message["checkout.address"], placeOrder: message["checkout.submit"], checkoutFailed: message["checkout.failed"],
    stockInsufficient: message["checkout.insufficientStock"],
    fakePayment: message["payment.title"], fakePaymentNotice: message["payment.notice"], payNow: message["payment.submit"],
    cancelOrder: message["order.cancel"], order: message["order.title"], pendingPayment: message["order.pending"], paid: message["order.paid"],
    fulfilled: message["order.fulfilled"], cancelled: message["order.cancelled"], orderUpdateFailed: message["order.updateFailed"],
  } as const;
}
