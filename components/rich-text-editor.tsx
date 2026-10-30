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
import { DrawEditor, type DrawResult } from "@/components/draw/draw-editor";
import { AssetPicker } from "@/components/consult-assets/asset-picker";
import { EstimateBuilder } from "@/components/estimate/estimate-builder";
import { loadConsultDrawing, saveConsultDrawing, uploadConsultImage as uploadImage } from "@/lib/draw/consult-store";
import type { DrawDoc } from "@/lib/draw/doc";

// ── 이미지 정렬(spec 025 상담 캔버스) — HTML 플로우 내 자유 배치 ──
//    left/right = 글 감싸기(float). 왼쪽 정렬 이미지 2장을 붙이면 나란히 배치가 된다.
type ImgAlign = "left" | "right" | "center" | null;
function alignStyle(align: ImgAlign): string {
  if (align === "left") return "float:left;margin:0.25rem 1rem 0.5rem 0;";
  if (align === "right") return "float:right;margin:0.25rem 0 0.5rem 1rem;";
  if (align === "center") return "display:block;margin:0.75rem auto;";
  return "";
}

// ── Resizable image node view (React component) ───────────────
function ResizableImageView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  // spec 026 스테이지 / spec 039 고치기 — 그리기 엔진으로 연다(편집용 기록이 있으면 예전 표시를 층으로 복원)
  const [stage, setStage] = useState<{
    purpose: "stage" | "edit";
    image: Blob | null;
    doc: DrawDoc | null;
    ref: string;
  } | null>(null);
  const [stageBusy, setStageBusy] = useState(false);
  const { src, alt, width, align, draw } = node.attrs as {
    src: string;
    alt: string;
    width: number | null;
    align: ImgAlign;
    draw: string | null;
  };

  // stage = 크게 열어 그리며 설명 → "기록에 담기"로 스냅샷 추가 / edit = 이 그림을 고쳐 그 자리에서 바꾸기
  async function openStage(purpose: "stage" | "edit") {
    if (stageBusy) return;
    setStageBusy(true);
    try {
      setStage({ purpose, ...(await loadConsultDrawing(src, draw)) });
    } catch {
      alert("이미지를 열지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setStageBusy(false);
    }
  }

  async function handleStageSave(r: DrawResult) {
    const purpose = stage?.purpose ?? "stage";
    setStage(null);
    setStageBusy(true);
    try {
      const saved = await saveConsultDrawing(r);
      if (purpose === "edit") {
        updateAttributes({ src: saved.src, draw: saved.draw });
        return;
      }
      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos != null) {
        editor
          .chain()
          .insertContentAt(pos + node.nodeSize, { type: "image", attrs: { src: saved.src, alt: alt ?? "", draw: saved.draw } })
          .run();
      } else {
        // ⚠️ setImage는 현재 선택(=직전 이미지 노드)을 교체한다 — 이미지+빈 문단을 이어 삽입해
        //    커서를 문단으로 옮겨 연속 삽입이 안전하게(다중 이미지 교체 버그 방지).
        editor
          .chain()
          .focus()
          .insertContent([{ type: "image", attrs: { src: saved.src, draw: saved.draw } }, { type: "paragraph" }])
          .run();
      }
    } catch {
      alert("그림 저장에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setStageBusy(false);
    }
  }

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

  const wrapperStyle: React.CSSProperties = {
    position: "relative",
    maxWidth: "100%",
  };
  if (align === "left") Object.assign(wrapperStyle, { float: "left", margin: "0.25rem 1rem 0.5rem 0" });
  else if (align === "right") Object.assign(wrapperStyle, { float: "right", margin: "0.25rem 0 0.5rem 1rem" });
  else if (align === "center") Object.assign(wrapperStyle, { display: "block", margin: "0.75rem auto", width: "fit-content" });
  else Object.assign(wrapperStyle, { display: "inline-block", margin: "0.75rem 0" });

  const alignBtn = (a: ImgAlign, label: string, title: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        updateAttributes({ align: align === a ? null : a });
      }}
      style={{
        padding: "2px 6px",
        fontSize: "11px",
        fontWeight: 600,
        borderRadius: "4px",
        border: "none",
        cursor: "pointer",
        background: align === a ? "#0ea5e9" : "rgba(15,23,42,0.75)",
        color: "#fff",
      }}
    >
      {label}
    </button>
  );

  return (
    <NodeViewWrapper as="div" style={wrapperStyle}>
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
      {/* 정렬 컨트롤 — 선택 시 노출 (spec 025). 왼쪽 2장 연속 = 나란히 배치 */}
      {selected && (
        <div
          style={{
            position: "absolute",
            top: "6px",
            left: "6px",
            display: "flex",
            gap: "4px",
            zIndex: 5,
          }}
        >
          {alignBtn("left", "⬅ 글감싸기", "왼쪽 배치 — 오른쪽으로 글이 감싸요 (2장 연속이면 나란히)")}
          {alignBtn("center", "가운데", "가운데 단독 배치")}
          {alignBtn("right", "글감싸기 ➡", "오른쪽 배치 — 왼쪽으로 글이 감싸요")}
          <button
            type="button"
            title="크게 열어 그리며 설명 — '기록에 담기'로 그린 스냅샷 추가 (spec 026 스테이지)"
            onMouseDown={(e) => {
              e.preventDefault();
              void openStage("stage");
            }}
            style={{
              padding: "2px 6px",
              fontSize: "11px",
              fontWeight: 600,
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              background: "#0f766e",
              color: "#fff",
            }}
          >
            {stageBusy ? "여는 중…" : "🖊 크게"}
          </button>
          <button
            type="button"
            title={draw ? "그린 표시를 하나씩 고치거나 지워서 이 그림을 바꿉니다 (spec 039)" : "이 그림 위에 더 그려서 바꿉니다"}
            onMouseDown={(e) => {
              e.preventDefault();
              void openStage("edit");
            }}
            style={{
              padding: "2px 6px",
              fontSize: "11px",
              fontWeight: 600,
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              background: "#7c3aed",
              color: "#fff",
            }}
          >
            ✏️ 고치기
          </button>
        </div>
      )}
      {/* spec 026 스테이지 · spec 039 고치기 — 그리기 엔진 */}
      {stage && (
        <DrawEditor
          image={stage.image}
          doc={stage.doc}
          base={{ ref: stage.ref }}
          title={stage.purpose === "edit" ? "그림 고치기" : "크게 보며 그리기"}
          saveLabel={stage.purpose === "edit" ? "고친 그림으로 바꾸기" : "기록에 담기"}
          onClose={() => setStage(null)}
          onSave={(r) => void handleStageSave(r)}
        />
      )}
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
        renderHTML: () => ({}), // style은 아래 align과 합쳐 한 번에 렌더
      },
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-align"),
        renderHTML: () => ({}),
      },
      // spec 039 — 편집용 기록(.draw.json) URL. 있으면 다시 열 때 그린 표시를 층으로 복원
      draw: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-draw"),
        renderHTML: () => ({}),
      },
    };
  },

  // width + align을 합쳐 style 하나로 렌더(저장 HTML에 그대로 실려 카드·포털 표시에 적용).
  renderHTML({ HTMLAttributes, node }) {
    const width = node.attrs.width as number | null;
    const align = node.attrs.align as ImgAlign;
    const draw = node.attrs.draw as string | null;
    const style =
      (width ? `width:${width}px;` : "") + "max-width:100%;height:auto;border-radius:8px;" + alignStyle(align);
    return [
      "img",
      {
        ...HTMLAttributes,
        ...(width ? { width } : {}),
        ...(align ? { "data-align": align } : {}),
        ...(draw ? { "data-draw": draw } : {}),
        style,
      },
    ];
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
  /** 이미지 파일을 업로드해 본문에 삽입(spec 036 치간칫솔 차트 등 외부 도구의 결과물). */
  insertImageFile: (file: File) => Promise<void>;
  /** 그리기 엔진 결과(보기용 그림 + 편집용 기록)를 본문에 넣는다 — 나중에 [✏️ 고치기]로 다시 열 수 있다(spec 039). */
  insertDrawing: (r: DrawResult) => Promise<void>;
  clear: () => void;
  setHTML: (html: string) => void;
  /** 현재 에디터 내용을 HTML로 즉시 읽는다(자동저장 — React 상태 갱신 대기 없이 동기 캡처). */
  getHTML: () => string;
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
  const [showPicker, setShowPicker] = useState(false); // spec 025 자료 픽커
  const [showEstimate, setShowEstimate] = useState(false); // spec 028 견적 빌더
  const [fullscreen, setFullscreen] = useState(false); // spec 025 상담 캔버스(전체화면)
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
    async insertImageFile(file: File) {
      if (!editorRef.current) return;
      const url = await uploadImage(file);
      editorRef.current
        .chain()
        .focus()
        .insertContent([{ type: "image", attrs: { src: url } }, { type: "paragraph" }])
        .run();
    },
    async insertDrawing(r: DrawResult) {
      if (!editorRef.current) return;
      const saved = await saveConsultDrawing(r);
      editorRef.current
        .chain()
        .focus()
        .insertContent([{ type: "image", attrs: { src: saved.src, draw: saved.draw } }, { type: "paragraph" }])
        .run();
    },
    clear() {
      editorRef.current?.commands.clearContent();
    },
    setHTML(html: string) {
      editorRef.current?.commands.setContent(html || "");
    },
    getHTML() {
      const html = editorRef.current?.getHTML() ?? "";
      return html === "<p></p>" ? "" : html;
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

  async function handleAnnotateSave(r: DrawResult) {
    setAnnotateFile(null);
    if (!editor) return;
    setUploading(true);
    try {
      const saved = await saveConsultDrawing(r);
      // 이미지+빈 문단 삽입 — setImage는 선택을 교체해 연속 삽입 시 직전 이미지가 사라진다(다중 이미지 버그).
      editor
        .chain()
        .focus()
        .insertContent([{ type: "image", attrs: { src: saved.src, draw: saved.draw } }, { type: "paragraph" }])
        .run();
    } catch {
      alert("이미지 업로드에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  function insertAsset(a: {
    kind: "image" | "video_link";
    image_url: string | null;
    link_url: string | null;
    title: string;
    caption: string | null;
  }) {
    if (!editor) return;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (a.kind === "video_link" && a.link_url) {
      // 영상은 링크로 기록에 담는다(spec 026) — 표시에서 자동 링크화, 환자 포털에서 클릭 시청.
      editor.chain().focus().insertContent(`<p>▶ ${esc(a.title)} (영상): ${a.link_url}</p>`).run();
    } else if (a.image_url) {
      // 이미지+빈 문단 삽입 — setImage는 선택을 교체해 자료 여러 장을 연속으로 담으면 앞 장이 사라진다.
      editor
        .chain()
        .focus()
        .insertContent([
          { type: "image", attrs: { src: a.image_url, alt: a.title } },
          { type: "paragraph" },
        ])
        .run();
    } else {
      return;
    }
    if (a.caption) {
      editor.chain().focus().insertContent(`<p>${esc(a.caption)}</p>`).run();
    }
  }

  if (!editor) return null;

  const btn = (active: boolean) => (active ? BTN_ACTIVE : BTN);

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-[100] flex flex-col overflow-hidden bg-white"
          : "mt-3 overflow-hidden rounded-xl border border-sky-200 bg-white focus-within:border-sky-400 focus-within:ring-2 focus-within:ring-sky-400/30"
      }
    >
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
        {/* spec 025 — 상담 자료 라이브러리 픽커 */}
        <button
          type="button"
          title="상담 자료 — 미리 등록한 이미지를 골라 삽입, 크게 열고 그리기·빈 캔버스"
          onClick={() => setShowPicker(true)}
          className={BTN}
        >
          📚 자료
        </button>
        {/* spec 028 — 치료비 견적 빌더 */}
        <button
          type="button"
          title="치료비 견적 — 항목·수량·금액을 골라 [치료비 견적] 블록으로 삽입"
          onClick={() => setShowEstimate(true)}
          className={BTN}
        >
          ₩ 견적
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

        {/* spec 025 — 상담 캔버스(전체화면) 토글 */}
        <button
          type="button"
          title={fullscreen ? "전체화면 종료 (원래 화면으로)" : "전체화면으로 크게 편집"}
          onClick={() => setFullscreen((f) => !f)}
          className={`ml-auto ${btn(fullscreen)}`}
        >
          {fullscreen ? "✕ 닫기" : "⛶ 크게"}
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
        이미지·📚자료·드래그·Ctrl+V로 삽입 — 모서리 드래그 크기조절, 이미지 클릭 후 글감싸기/가운데 배치(왼쪽 2장이면 나란히)
      </div>

      {/* Editor */}
      <div className={fullscreen ? "min-h-0 flex-1 overflow-y-auto" : ""}>
        <EditorContent editor={editor} />
      </div>

      {/* Annotator modal */}
      {annotateFile && (
        <DrawEditor
          image={annotateFile}
          fileName={annotateFile.name.replace(/\.[^.]+$/, "") || "annotated"}
          onClose={() => setAnnotateFile(null)}
          onSave={(r) => void handleAnnotateSave(r)}
        />
      )}

      {/* spec 025 — 상담 자료 픽커 (+spec 026 스테이지: 크게 열고 그려서 담기, 빈 캔버스) */}
      {showPicker && (
        <AssetPicker
          onInsert={insertAsset}
          onInsertAnnotated={(r) => void handleAnnotateSave(r)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* spec 028 — 견적 빌더: [치료비 견적] 평문 블록 삽입 */}
      {showEstimate && (
        <EstimateBuilder
          onInsert={(text) => {
            if (!editor) return;
            const esc = (s: string) =>
              s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            const html = text
              .split("\n")
              .map((line) => `<p>${esc(line)}</p>`)
              .join("");
            editor.chain().focus().insertContent(html).run();
          }}
          onClose={() => setShowEstimate(false)}
        />
      )}
    </div>
  );
});

RichTextEditor.displayName = "RichTextEditor";
