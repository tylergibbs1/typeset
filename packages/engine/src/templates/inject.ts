/**
 * Simple Handlebars-compatible template injection.
 * Supports {{variable}}, {{#each array}}...{{/each}}, and {{#if condition}}...{{/if}}
 */
export function injectData(template: string, data: Record<string, unknown>): string {
  let result = template

  // Process {{#each array}}...{{/each}} blocks
  result = result.replace(
    /\{\{#each\s+(\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, key, body) => {
      const arr = data[key]
      if (!Array.isArray(arr)) return ''
      return arr
        .map((item, index) => {
          let row = body
          if (typeof item === 'object' && item !== null) {
            for (const [k, v] of Object.entries(item)) {
              row = row.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), escapeHtml(String(v ?? '')))
            }
          }
          row = row.replace(/\{\{@index\}\}/g, String(index))
          row = row.replace(/\{\{this\}\}/g, escapeHtml(String(item)))
          return row
        })
        .join('')
    }
  )

  // Process {{#if condition}}...{{/if}} blocks
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, body) => {
      const value = data[key]
      return value ? body : ''
    }
  )

  // Process simple {{variable}} replacements
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key]
    if (value === undefined || value === null) return ''
    return escapeHtml(String(value))
  })

  return result
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function registerHelpers(): Record<string, (...args: unknown[]) => string> {
  return {
    formatCurrency: (value: unknown) => {
      const num = Number(value)
      if (isNaN(num)) return String(value)
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
    },
    formatDate: (value: unknown) => {
      const date = new Date(String(value))
      if (isNaN(date.getTime())) return String(value)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    },
    uppercase: (value: unknown) => String(value).toUpperCase(),
    lowercase: (value: unknown) => String(value).toLowerCase(),
  }
}
