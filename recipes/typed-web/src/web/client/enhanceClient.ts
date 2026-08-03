import { asset } from "../assets.js";

export const enhanceClientJs = [
  `import { accordion } from '${asset("/enhance/accordion.js")}';`,
  "accordion();",
];
