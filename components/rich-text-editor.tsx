"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

const TOOLBAR_BUTTON =
  "rounded px-2 py-1 text-sm font-medium text-slate-600 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-30 transition-colors";
const TOOLBAR_BUTTON_ACTIVE =
  "rounded px-2 py-1 text-sm font-medium bg-sky-100 text-sky-700 transition-colors";

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? "내용을 입력하세요...",
      }),
    ],
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.getHTML();
      // 빈 에디터일 때 빈 문자열로 처리
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[240px] w-full px-4 py-3 text-slate-900 text-sm leading-7 outline-none focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  if (!editor) return null;

  const btn = (active: boolean) =>
    active ? TOOLBAR_BUTTON_ACTIVE : TOOLBAR_BUTTON;

  return (
    <div className="mt-3 rounded-xl border border-sky-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30 overflow-hidden">
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-sky-100 px-2 py-1.5 bg-slate-50/60">
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
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={btn(editor.isActive("heading", { level: 1 }))}
        >
          H1
        </button>
        <button
          type="button"
          title="제목 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={btn(editor.isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          title="제목 3"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
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
          className={TOOLBAR_BUTTON}
        >
          ─
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button
          type="button"
          title="실행 취소 (Ctrl+Z)"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={TOOLBAR_BUTTON}
        >
          ↩
        </button>
        <button
          type="button"
          title="다시 실행 (Ctrl+Y)"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={TOOLBAR_BUTTON}
        >
          ↪
        </button>
      </div>

      {/* 에디터 본문 */}
      <EditorContent editor={editor} />
    </div>
  );
}
