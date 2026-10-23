import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/public/**", "**/coverage/**", "**/node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["frontend/src/**/*.{ts,tsx}", "shared/src/**/*.ts"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Do not inject HTML. Render agent replies as text.",
        },
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: "Do not assign innerHTML.",
        },
      ],
    },
  },
);
