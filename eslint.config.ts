import eslint from "@eslint/js";
import neostandard from "neostandard";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Base
  eslint.configs.recommended,

  // Standard
  ...neostandard({ noStyle: true }),

  // TypeScript
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
  {
    ignores: ["dist/*"],
  },

  // Custom rules
  {
    rules: {
      "@typescript-eslint/strict-boolean-expressions": [
        "error",
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
          allowNullableBoolean: false,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports",
        },
      ],
    },
  },

  // Node's builtin test runner "describe" and "it" functions return promises but
  // it's fine not to await them
  {
    files: ["test/**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },

  // Disable type-aware linting for config files
  {
    files: ["*.config.[j|t]s", "*.config.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);

