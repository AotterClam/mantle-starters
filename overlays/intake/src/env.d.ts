type SiteEnv = Env & {
  readonly TURNSTILE_SECRET_KEY?: string;
  readonly EMAIL?: SendEmail;
  readonly INTAKE_NOTIFY_TO?: string;
  readonly INTAKE_NOTIFY_FROM?: string;
};
