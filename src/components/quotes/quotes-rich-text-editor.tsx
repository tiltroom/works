"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import type { JSONContent } from "@tiptap/core";
import {
  QuotesCompactField,
} from "@/components/quotes/quotes-comments";
import { quotesSecondaryButtonClass } from "@/components/quotes/quotes-shared";

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function isAllowedImageType(file: File) {
  return ACCEPTED_IMAGE_TYPES.has(file.type);
}

function createEmptyDoc(): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

interface QuotesRichTextEditorProps {
  name: string;
  jsonName?: string;
  label: string;
  placeholder?: string;
  initialHtml?: string;
  initialJson?: JSONContent | null;
  uploadEndpoint?: string;
  disabled?: boolean;
  helpText?: string;
  imageButtonLabel?: string;
  unsupportedImageTypeMessage?: string;
  imageTooLargeMessage?: string;
  imageUploadErrorMessage?: string;
}

export function QuotesRichTextEditor({
  name,
  jsonName,
  label,
  placeholder = "Write a short description…",
  initialHtml = "",
  initialJson = null,
  uploadEndpoint = "/api/quotes/uploads",
  disabled = false,
  helpText,
  imageButtonLabel = "Insert image",
  unsupportedImageTypeMessage = "Only JPG, PNG, WEBP, and GIF files are allowed.",
  imageTooLargeMessage = "Images must be 1MB or smaller.",
  imageUploadErrorMessage = "Image upload failed.",
}: QuotesRichTextEditorProps) {
  const [htmlValue, setHtmlValue] = useState(initialHtml);
  const [jsonValue, setJsonValue] = useState(() => JSON.stringify(initialJson ?? createEmptyDoc()));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const content = useMemo(() => {
    if (initialJson) {
      return initialJson;
    }

    if (initialHtml.trim()) {
      return initialHtml;
    }

    return createEmptyDoc();
  }, [initialHtml, initialJson]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({
        inline: true,
        allowBase64: false,
      }),
    ],
    content,
    immediatelyRender: false,
    editable: !disabled,
    editorProps: {
      attributes: {
        class:
          "quotes-rich-text min-h-40 rounded-xl border border-input bg-background/75 px-3 py-2 text-sm text-foreground outline-none transition-all focus-within:border-transparent focus-within:ring-2 focus-within:ring-brand-500",
      },
    },
    onCreate({ editor: createdEditor }) {
      const initialDoc = createdEditor.getJSON();
      setHtmlValue(createdEditor.getHTML());
      setJsonValue(JSON.stringify(initialDoc));
    },
    onUpdate({ editor: updatedEditor }) {
      setHtmlValue(updatedEditor.getHTML());
      setJsonValue(JSON.stringify(updatedEditor.getJSON()));
      setErrorMessage(null);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!disabled);
  }, [disabled, editor]);

  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !editor) {
      return;
    }

    if (!isAllowedImageType(file)) {
      setErrorMessage(unsupportedImageTypeMessage);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMessage(imageTooLargeMessage);
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || imageUploadErrorMessage);
      }

      editor.chain().focus().setImage({ src: payload.url, alt: file.name }).run();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : imageUploadErrorMessage);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <QuotesCompactField label={label} htmlFor={`${name}-editor`} hint={helpText}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
            className={quotesSecondaryButtonClass}
          >
            {isUploading ? "Uploading…" : imageButtonLabel}
          </button>
          <span className="text-xs text-muted-foreground">Basic text, lists, and inline images up to 1MB.</span>
        </div>

        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageSelection} />

        <div id={`${name}-editor`} data-placeholder={placeholder} className="group relative">
          <EditorContent editor={editor} />
          {!editor?.getText().trim() && editor?.isEmpty ? (
            <span className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">{placeholder}</span>
          ) : null}
        </div>

        {errorMessage ? <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p> : null}

        <input type="hidden" name={name} value={htmlValue} />
        {jsonName ? <input type="hidden" name={jsonName} value={jsonValue} /> : null}
      </div>
    </QuotesCompactField>
  );
}
