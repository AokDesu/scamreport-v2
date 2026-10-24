/** Redact local execution identity without changing test results or relative diagnostics. */
export function sanitizeReport(text: string, replacements: ReadonlyArray<readonly [string, string]>): string {
  for (const [source, label] of [...replacements].sort((a, b) => b[0].length - a[0].length)) {
    if (source) text = text.replaceAll(source, label);
  }
  return text.replace(/\bhostname=(['"])[^'"]*\1/g, 'hostname=$1local$1');
}
