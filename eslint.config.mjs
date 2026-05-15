import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    ignores: ["legacy/**", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
