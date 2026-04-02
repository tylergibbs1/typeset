import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          fontSize: "15px",
        }}
      >
        typeset
      </span>
    ),
  },
  githubUrl: "https://github.com/tylergibbs1/typeset",
};
