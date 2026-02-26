/**
 * Simple HTML sanitizer to prevent XSS while allowing specific formatting tags.
 * Primarily for use with dangerouslySetInnerHTML in ActivityFeed.
 */

export function sanitizeHtml(html: string): string {
    if (!html) return '';

    // 1. First, encode all characters to prevent any tags from being parsed
    const temp = document.createElement('div');
    temp.textContent = html;
    const basicEscaped = temp.innerHTML;

    // 2. Re-enable a strict white-list of safe formatting tags that we actually use in log descriptions
    // We use <strong> and <b> for highlighting names/IDs
    return basicEscaped
        .replace(/&lt;strong&gt;/g, '<strong class="text-primary font-bold">')
        .replace(/&lt;\/strong&gt;/g, '</strong>')
        .replace(/&lt;b&gt;/g, '<b class="font-bold">')
        .replace(/&lt;\/b&gt;/g, '</b>')
        .replace(/&lt;span&gt;/g, '<span>')
        .replace(/&lt;\/span&gt;/g, '</span>');
}

/**
 * Simple prompt sanitizer to reduce risk of prompt injection.
 * Strips dangerous control characters and common injection patterns.
 */
export function sanitizePrompt(text: string): string {
    if (!text) return '';

    return text
        // Remove common injection prefixes/suffixes
        .replace(/(ignore all previous instructions|forget everything|system override|you are now)/gi, '[REDACTED]')
        // Sanitize bracketed system-like commands
        .replace(/\[system.*?\]/gi, '')
        .replace(/\{system.*?\}/gi, '')
        // Clean up excessive control characters
        .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
        .trim();
}

