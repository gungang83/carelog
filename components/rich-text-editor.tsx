"use client";

import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import { ImageAnnotator } from "@/components/image-annotator";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// ── Supabase image upload ─────────────────────────────────────
async function uploadImage(file: File): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const bucket =
    process.env.NEXT_PUBLIC_SUPABASE_CONSULTATION_BUCKET ?? "consultation-images";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `inline/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw new Error(error.message);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ── Resizable image node view (React component) ───────────────
function ResizableImageView({ node, updateAttributes }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const { src, alt, width } = node.attrs as {
    src: string;
    alt: string;
    width: number | null;
  };

  function onResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = imgRef.current?.getBoundingClientRect().width ?? (width ?? 300);

    const onMove = (ev: MouseEvent) => {
      const w = Math.max(80, Math.round(startW + ev.clientX - startX));
      if (imgRef.current) imgRef.current.style.width = `${w}px`;
    };
    const onUp = (ev: MouseEvent) => {
      const w = Math.max(80, Math.round(startW + ev.clientX - startX));
      updateAttributes({ width: w });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <NodeViewWrapper
      as="div"
      style={{ display: "inline-block", position: "relative", maxWidth: "100%", margin: "0.75rem 0" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt ?? ""}
        draggable={false}
        style={{
          display: "block",
          width: width ? `${width}px` : "auto",
          maxWidth: "100%",
          height: "auto",
          borderRadius: "8px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.12)",
        }}
      />
      {/* Resize handle */}
      <div
        title="드래그하여 크기 조절"
        onMouseDown={onResizeStart}
        style={{
          position: "absolute",
          right: "-6px",
          bottom: "-6px",
          width: "14px",
          height: "14px",
          background: "#0ea5e9",
          cursor: "se-resize",
          borderRadius: "3px",
          opacity: 0,
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.opacity = "0";
        }}
      />
    </NodeViewWrapper>
  );
}

// ── Custom image extension ────────────────────────────────────
const ResizableImage = Image.extend({
  group: "block",
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("width"),
        renderHTML: ({ width }) =>
          width
            ? { width, style: `width:${width}px;max-width:100%;height:auto` }
            : { style: "max-width:100%;height:auto" },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

// ── Toolbar styles ────────────────────────────────────────────
const BTN =
  "rounded px-2 py-1 text-sm font-medium text-slate-600 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-30 transition-colors";
const BTN_ACTIVE =
  "rounded px-2 py-1 text-sm font-medium bg-sky-100 text-sky-700 transition-colors";

// ── Component ─────────────────────────────────────────────────
export type RichTextEditorHandle = {
  insertText: (text: string) => void;
  clear: () => void;
  setHTML: (html: string) => void;
};

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
function RichTextEditor({ value, onChange, placeholder }, ref) {
  const [annotateFile, setAnnotateFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ref so Tiptap event handlers always see the latest state setter
  const openAnnotatorRef = useRef(setAnnotateFile);
  openAnnotatorRef.current = setAnnotateFile;

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      if (!editorRef.current) return;
      const html = text
        .split(/\n+/)
        .filter(Boolean)
        .map((line) => `<p>${line}</p>`)
        .join("");
      editorRef.current.chain().focus().insertContent(html).run();
    },
    clear() {
      editorRef.current?.commands.clearContent();
    },
    setHTML(html: string) {
      editorRef.current?.commands.setContent(html || "");
    },
  }));

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? "내용을 입력하세요...",
      }),
      ResizableImage,
    ],
    content: value || "",
    onCreate({ editor }) {
      (editorRef as React.MutableRefObject<typeof editor>).current = editor;
    },
    onUpdate({ editor }) {
      (editorRef as React.MutableRefObject<typeof editor>).current = editor;
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[280px] w-full px-4 py-3 text-slate-900 text-sm leading-7 outline-none focus:outline-none",
      },
      handlePaste(_, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imgItem = items.find((i) => i.type.startsWith("image/"));
        if (!imgItem) return false;
        // If clipboard also has text (e.g. browser copy), let Tiptap handle it
        if (items.some((i) => i.kind === "string" && i.type === "text/plain"))
          return false;
        const file = imgItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        openAnnotatorRef.current(file);
        return true;
      },
      handleDrop(_, event) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        const img = files.find((f) => f.type.startsWith("image/"));
        if (!img) return false;
        event.preventDefault();
        openAnnotatorRef.current(img);
        return true;
      },
    },
    immediatelyRender: false,
  });

  async function handleAnnotateSave(annotated: File) {
    setAnnotateFile(null);
    if (!editor) return;
    setUploading(true);
    try {
      const url = await uploadImage(annotated);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      alert("이미지 업로드에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  if (!editor) return null;

  const btn = (active: boolean) => (active ? BTN_ACTIVE : BTN);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-sky-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-sky-100 bg-slate-50/60 px-2 py-1.5">
        <button
          type="button"
          title="굵게 (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold"))}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          title="기울임 (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive("italic"))}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          title="취소선"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btn(editor.isActive("strike"))}
        >
          <s>S</s>
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button
          type="button"
          title="제목 1"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={btn(editor.isActive("heading", { level: 1 }))}
        >
          H1
        </button>
        <button
          type="button"
          title="제목 2"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={btn(editor.isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          title="제목 3"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={btn(editor.isActive("heading", { level: 3 }))}
        >
          H3
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button
          type="button"
          title="글머리 기호 목록"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive("bulletList"))}
        >
          • 목록
        </button>
        <button
          type="button"
          title="번호 목록"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive("orderedList"))}
        >
          1. 목록
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button
          type="button"
          title="인용"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={btn(editor.isActive("blockquote"))}
        >
          ❝
        </button>
        <button
          type="button"
          title="구분선"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className={BTN}
        >
          ─
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        {/* Image insert */}
        <button
          type="button"
          title="이미지 삽입 (파일 선택 → 주석 → 에디터 삽입)"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={BTN}
        >
          {uploading ? "업로드 중..." : "이미지"}
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button
          type="button"
          title="실행 취소 (Ctrl+Z)"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={BTN}
        >
          ↩
        </button>
        <button
          type="button"
          title="다시 실행 (Ctrl+Y)"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={BTN}
        >
          ↪
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setAnnotateFile(f);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
      />

      {/* Hint */}
      <div className="border-b border-sky-50 px-4 py-1 text-[11px] text-slate-400">
        이미지 버튼 · 드래그 앤 드롭 · Ctrl+V 로 이미지를 텍스트 안에 삽입 — 모서리를 드래그해 크기 조절
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Annotator modal */}
      {annotateFile && (
        <ImageAnnotator
          file={annotateFile}
          onClose={() => setAnnotateFile(null)}
          onSave={handleAnnotateSave}
        />
      )}
    </div>
  );
});

RichTextEditor.displayName = "RichTextEditor";
