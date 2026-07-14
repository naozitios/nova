declare module 'html-to-text' {
  export function convert(
    html: string,
    options?: {
      wordwrap?: boolean | number | string
      selectors?: Array<{
        selector: string
        options?: Record<string, unknown>
      }>
      [key: string]: unknown
    },
  ): string
}
