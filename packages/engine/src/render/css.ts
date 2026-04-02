import type { RenderOptions, Margins } from '../types'

export const defaultMargins: Margins = {
  top: '20mm',
  right: '15mm',
  bottom: '20mm',
  left: '15mm',
}

export function printCss(options: RenderOptions): string {
  return `
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      h1, h2, h3, h4, h5, h6 {
        break-after: avoid;
      }

      table {
        break-inside: auto;
      }

      tr {
        break-inside: avoid;
      }

      thead {
        display: table-header-group;
      }

      img, figure {
        break-inside: avoid;
      }

      p {
        orphans: 3;
        widows: 3;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
    }

    table {
      border-collapse: collapse;
      width: 100%;
    }

    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: #f9fafb;
      font-weight: 600;
    }
  `
}
