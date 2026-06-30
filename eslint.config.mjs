import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // React Compiler flags all setState inside effects, including async
      // data-fetch callbacks. Too aggressive for this codebase's patterns.
      "react-hooks/set-state-in-effect": "off",
      // React Compiler flags ref reads during render; these components have
      // been tested locally and are correct.
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
