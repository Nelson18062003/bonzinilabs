import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

// ────────────────────────────────────────────────────────────────────────────
// iOS-zoom anti-regression rules.
//
// iOS Safari auto-zooms any form control whose computed font-size is < 16px
// on focus. The design-system primitives at `src/components/form/*`
// guarantee the 16px floor on mobile via `text-base md:text-sm`. These
// rules steer every new contribution toward those primitives and flag
// the escape hatches (raw <input>/<textarea>, shadcn Input/Textarea
// imports) so reviewers notice. They are WARNINGS by design: raw inputs
// for file/checkbox/radio are legitimate, and a few legacy screens
// haven't been migrated yet.
// ────────────────────────────────────────────────────────────────────────────

const iosZoomRules = {
  "no-restricted-syntax": [
    "warn",
    {
      // Flag text-ish <input>s (those that open a keyboard). Skip file,
      // checkbox, radio, range, hidden, button/submit/reset, color, image —
      // none of those trigger the iOS font-size zoom.
      selector:
        "JSXOpeningElement[name.name='input']:not(:has(JSXAttribute[name.name='type'] > Literal[value=/^(file|checkbox|radio|range|hidden|button|submit|reset|color|image)$/]))",
      message:
        "Prefer TextField/EmailField/PhoneField/AmountField/PasswordField/NumberField/OtpField/SearchField/DateField from '@/components/form'. Raw <input> can drop below 16px font-size and trigger iOS Safari auto-zoom.",
    },
    {
      selector: "JSXOpeningElement[name.name='textarea']",
      message:
        "Prefer <TextArea> from '@/components/form'. Raw <textarea> can drop below 16px font-size and trigger iOS Safari auto-zoom.",
    },
  ],
  "no-restricted-imports": [
    "warn",
    {
      paths: [
        {
          name: "@/components/ui/input",
          message:
            "Prefer TextField (or a specialised EmailField/PhoneField/AmountField/PasswordField/NumberField/OtpField/SearchField/DateField) from '@/components/form' — guaranteed iOS-safe 16px floor.",
        },
        {
          name: "@/components/ui/textarea",
          message:
            "Prefer <TextArea> from '@/components/form' — guaranteed iOS-safe 16px floor.",
        },
      ],
    },
  ],
};

// Files allowed to use raw <input>/<textarea> because they ARE the
// design-system primitives or an intentional custom input with explicit
// iOS-safe sizing.
const primitiveFiles = [
  "src/components/ui/**",
  "src/components/form/**",
  "src/components/auth/PremiumInput.tsx",
];

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      ...iosZoomRules,
    },
  },
  {
    // Primitive implementation files — they need raw <input> internally.
    files: primitiveFiles,
    rules: {
      "no-restricted-syntax": "off",
      "no-restricted-imports": "off",
    },
  },
);
