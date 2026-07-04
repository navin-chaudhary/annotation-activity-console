"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

interface MarkdownProps {
  content: string;
}

/**
 * Secure Markdown Renderer
 *
 * Pipeline:
 * Markdown -> HTML (marked)
 * HTML -> Sanitized HTML (DOMPurify)
 * Sanitized HTML -> React
 *
 * Security:
 * - Removes <script> tags
 * - Removes <img> tags
 * - Removes inline event handlers (onclick, onerror, etc.)
 * - Removes javascript: URLs
 * - Prevents XSS attacks
 */
export function Markdown({ content }: MarkdownProps) {
  const safeHtml = useMemo(() => {
    const rawHtml = marked.parse(content, {
      async: false,
    }) as string;

    return DOMPurify.sanitize(rawHtml, {
      USE_PROFILES: {
        html: true,
      },

      // Remove dangerous tags completely
      FORBID_TAGS: [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "img",
        "svg",
        "math",
      ],

      // Remove dangerous attributes
      FORBID_ATTR: [
        "onerror",
        "onclick",
        "onload",
        "onmouseover",
        "style",
      ],
    });
  }, [content]);

  return (
    <div
      className="prose-sm prose text-gray-800 markdown-body max-w-none"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}