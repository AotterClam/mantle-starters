import { enhanceClientJs } from "./enhanceClient.js";
import { formClientJs } from "./formClient.js";
import { intakeClientJs } from "./intakeClient.js";
import { navClientJs } from "./navClient.js";
import { themeClientJs } from "./themeClient.js";

export const homeClientJs = [
  "import { bindWebMcp } from '/assets/mantle-webmcp.js';",
  "void bindWebMcp();",
  ...enhanceClientJs,
  ...themeClientJs,
  ...navClientJs,
  ...intakeClientJs,
  ...formClientJs,
  "",
].join("\n");
