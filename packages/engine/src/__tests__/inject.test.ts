import { describe, test, expect } from 'bun:test'
import { injectData, registerHelpers } from '../templates/inject'

describe('injectData', () => {
  describe('simple variable replacement', () => {
    test('replaces a single variable', () => {
      const result = injectData('Hello, {{name}}!', { name: 'World' })
      expect(result).toBe('Hello, World!')
    })

    test('replaces multiple variables', () => {
      const result = injectData('{{greeting}}, {{name}}!', { greeting: 'Hi', name: 'Alice' })
      expect(result).toBe('Hi, Alice!')
    })

    test('replaces the same variable used more than once', () => {
      const result = injectData('{{x}} and {{x}}', { x: 'foo' })
      expect(result).toBe('foo and foo')
    })

    test('missing variables render as empty string', () => {
      const result = injectData('Hello, {{missing}}!', {})
      expect(result).toBe('Hello, !')
    })

    test('null variable renders as empty string', () => {
      const result = injectData('{{val}}', { val: null })
      expect(result).toBe('')
    })
  })

  describe('HTML escaping', () => {
    test('escapes < and >', () => {
      const result = injectData('{{html}}', { html: '<script>' })
      expect(result).toBe('&lt;script&gt;')
    })

    test('escapes &', () => {
      const result = injectData('{{val}}', { val: 'a & b' })
      expect(result).toBe('a &amp; b')
    })

    test('escapes double quotes', () => {
      const result = injectData('{{val}}', { val: '"quoted"' })
      expect(result).toBe('&quot;quoted&quot;')
    })

    test("escapes single quotes", () => {
      const result = injectData('{{val}}', { val: "it's" })
      expect(result).toBe('it&#39;s')
    })

    test('escapes all special characters together', () => {
      const result = injectData('{{val}}', { val: `<b class="x">'a' & 'b'</b>` })
      expect(result).toBe('&lt;b class=&quot;x&quot;&gt;&#39;a&#39; &amp; &#39;b&#39;&lt;/b&gt;')
    })
  })

  describe('{{#each array}}...{{/each}}', () => {
    test('iterates over an array of objects and replaces properties', () => {
      const template = '{{#each items}}<li>{{name}}</li>{{/each}}'
      const result = injectData(template, { items: [{ name: 'Alpha' }, { name: 'Beta' }] })
      expect(result).toBe('<li>Alpha</li><li>Beta</li>')
    })

    test('supports {{@index}} for current iteration index', () => {
      const template = '{{#each items}}{{@index}}:{{name}} {{/each}}'
      const result = injectData(template, { items: [{ name: 'A' }, { name: 'B' }] })
      expect(result).toBe('0:A 1:B ')
    })

    test('supports {{this}} for primitive array items', () => {
      const template = '{{#each list}}{{this}},{{/each}}'
      const result = injectData(template, { list: ['x', 'y', 'z'] })
      expect(result).toBe('x,y,z,')
    })

    test('empty array renders nothing', () => {
      const template = '{{#each items}}<li>{{name}}</li>{{/each}}'
      const result = injectData(template, { items: [] })
      expect(result).toBe('')
    })

    test('non-array value for each renders nothing', () => {
      const template = '{{#each items}}<li>{{name}}</li>{{/each}}'
      const result = injectData(template, { items: 'not-an-array' })
      expect(result).toBe('')
    })

    test('HTML-escapes object property values in each', () => {
      const template = '{{#each items}}{{val}}{{/each}}'
      const result = injectData(template, { items: [{ val: '<b>' }] })
      expect(result).toBe('&lt;b&gt;')
    })

    test('HTML-escapes {{this}} values in each', () => {
      const template = '{{#each list}}{{this}}{{/each}}'
      const result = injectData(template, { list: ['<script>'] })
      expect(result).toBe('&lt;script&gt;')
    })

    test('nested object items with multiple properties', () => {
      const template = '{{#each rows}}{{id}}-{{label}} {{/each}}'
      const result = injectData(template, {
        rows: [
          { id: 1, label: 'One' },
          { id: 2, label: 'Two' },
        ],
      })
      expect(result).toBe('1-One 2-Two ')
    })
  })

  describe('{{#if condition}}...{{/if}}', () => {
    test('renders body when condition is truthy', () => {
      const result = injectData('{{#if show}}visible{{/if}}', { show: true })
      expect(result).toBe('visible')
    })

    test('renders nothing when condition is falsy (false)', () => {
      const result = injectData('{{#if show}}visible{{/if}}', { show: false })
      expect(result).toBe('')
    })

    test('renders nothing when condition is undefined (missing key)', () => {
      const result = injectData('{{#if show}}visible{{/if}}', {})
      expect(result).toBe('')
    })

    test('renders nothing when condition is null', () => {
      const result = injectData('{{#if show}}visible{{/if}}', { show: null })
      expect(result).toBe('')
    })

    test('renders nothing when condition is empty string', () => {
      const result = injectData('{{#if show}}visible{{/if}}', { show: '' })
      expect(result).toBe('')
    })

    test('renders nothing when condition is 0', () => {
      const result = injectData('{{#if show}}visible{{/if}}', { show: 0 })
      expect(result).toBe('')
    })

    test('renders body when condition is non-empty string', () => {
      const result = injectData('{{#if title}}has title{{/if}}', { title: 'Hello' })
      expect(result).toBe('has title')
    })
  })
})

describe('registerHelpers', () => {
  test('returns an object with formatCurrency, formatDate, uppercase, lowercase', () => {
    const helpers = registerHelpers()
    expect(typeof helpers.formatCurrency).toBe('function')
    expect(typeof helpers.formatDate).toBe('function')
    expect(typeof helpers.uppercase).toBe('function')
    expect(typeof helpers.lowercase).toBe('function')
  })

  test('formatCurrency formats a number as USD', () => {
    const { formatCurrency } = registerHelpers()
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })

  test('formatCurrency returns the input as-is for non-numeric values', () => {
    const { formatCurrency } = registerHelpers()
    expect(formatCurrency('not-a-number')).toBe('not-a-number')
  })

  test('formatDate formats an ISO date string', () => {
    const { formatDate } = registerHelpers()
    const result = formatDate('2024-01-15')
    // Locale-formatted, but must contain year and day
    expect(result).toContain('2024')
    expect(result).toContain('15')
  })

  test('formatDate returns the input for an invalid date', () => {
    const { formatDate } = registerHelpers()
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  test('uppercase converts to uppercase', () => {
    const { uppercase } = registerHelpers()
    expect(uppercase('hello')).toBe('HELLO')
  })

  test('lowercase converts to lowercase', () => {
    const { lowercase } = registerHelpers()
    expect(lowercase('HELLO')).toBe('hello')
  })
})
