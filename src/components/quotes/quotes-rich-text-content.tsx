interface QuotesRichTextContentProps {
  html: string;
  emptyMessage?: string;
}

export function QuotesRichTextContent({ html, emptyMessage }: QuotesRichTextContentProps) {
  if (!html.trim()) {
    return emptyMessage ? <p className="text-sm italic text-muted-foreground">{emptyMessage}</p> : null;
  }

  return (
    <div
      className="quotes-rich-text text-sm leading-6 text-foreground/90"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
