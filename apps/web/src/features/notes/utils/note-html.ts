export function normalizeNoteHtml(value: string | undefined): string {
  const html = (value ?? '').trim();
  if (!html) return '';
  if (/^(<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>)+$/i.test(html)) return '';
  return html;
}

export function safeTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
