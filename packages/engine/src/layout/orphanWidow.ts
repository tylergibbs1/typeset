/**
 * Generates CSS rules to prevent common orphan/widow issues.
 * Applied as a baseline regardless of AI layout analysis.
 */
export function orphanWidowCss(): string {
  return `
/* Prevent orphaned headings */
h1, h2, h3, h4, h5, h6 {
  break-after: avoid;
  break-inside: avoid;
}

/* Prevent widowed single rows */
tr:last-child {
  break-before: avoid;
}

/* Keep figures with captions */
figure {
  break-inside: avoid;
}

/* Keep definition terms with descriptions */
dt {
  break-after: avoid;
}

/* Minimum lines before/after break */
p {
  orphans: 3;
  widows: 3;
}
`
}
