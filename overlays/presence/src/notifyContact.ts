import type { MantleHandlers } from "../.mantle/generated/types.js";

export const notifyContact: MantleHandlers<SiteEnv>["notify-contact"] = async (input, ctx) => {
  const env = ctx.env;
  if (!env.EMAIL || !env.CONTACT_NOTIFY_TO || !env.CONTACT_NOTIFY_FROM) return { ok: true };
  await env.EMAIL.send({
    to: env.CONTACT_NOTIFY_TO,
    from: env.CONTACT_NOTIFY_FROM,
    subject: `New contact message from ${input.name ?? "website"}`,
    text: [`Name: ${input.name ?? ""}`, `Email: ${input.email ?? ""}`, "", input.message ?? ""].join("\n"),
    ...(input.email ? { replyTo: input.email } : {}),
  });
  return { ok: true };
};
