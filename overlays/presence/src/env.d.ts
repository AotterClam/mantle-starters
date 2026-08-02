type SiteEnv = Env & {
  readonly TURNSTILE_SECRET_KEY?: string;
  readonly EMAIL?: SendEmail;
  readonly CONTACT_NOTIFY_TO?: string;
  readonly CONTACT_NOTIFY_FROM?: string;
};
