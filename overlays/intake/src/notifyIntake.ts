import type { MantleHandlers } from "../.mantle/generated/types.js";

export const notifyIntake: MantleHandlers<SiteEnv>["notify-intake"] = async (input, ctx) => {
  const env = ctx.env;
  if (!env.EMAIL || !env.INTAKE_NOTIFY_TO || !env.INTAKE_NOTIFY_FROM) return { ok: true };
  await env.EMAIL.send({
    to: env.INTAKE_NOTIFY_TO,
    from: env.INTAKE_NOTIFY_FROM,
    subject: `New intake response from ${input.name ?? "website"}`,
    text: [
      `Name: ${input.name ?? ""}`,
      `Email: ${input.email ?? ""}`,
      `Attendance: ${input.attendance ?? ""}`,
      "",
      input.note ?? "",
    ].join("\n"),
    ...(input.email ? { replyTo: input.email } : {}),
  });
  return { ok: true };
};
