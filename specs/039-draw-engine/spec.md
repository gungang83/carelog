# spec 039 — 그리기 엔진 (Carelog 공용 · EO도 불러 씀) · 🧪 1단계 구현

> 상태: **1단계 구현 (2026-10-30, 대표 착수 확인).** 대표 방향: 그리기는 Carelog 한 곳에서 계속 고도화하는 **공용 모듈/엔진**.
> 상담·기공지·상담 스테이지 등 여러 곳에 "첨부되는 방식"으로 쓰이고, 원본(사진·엑스레이·치아 모형) 위에 덧그린다.
> 앞으로 형태가 계속 바뀐다(엑스레이 활용, 3D 모델에 직접 그리기 등) → **바뀌어도 호환이 깨지지 않는 구조**가 목표.
> EO는 복사하지 않고 불러 쓴다(`specs/000-backlog/lab-case-thread.md` §3.6).

## 0. 현황 (2026-10-30 코드 기준)

| 구현 | 쓰는 곳 | 방식 |
|---|---|---|
| `components/image-annotator.tsx` (510줄) | 상담 에디터 이미지 수정·상담 스테이지(asset-picker)·치아 그림(tooth-viewer)·기공지 첨부 수정 | **픽셀에 직접 굽기**(ImageData 되돌리기) |
| `components/lab/sketch-pad.tsx` (154줄) | 기공지 손그림 | 별도 구현(중복) |

문제: ① 그리면 원본에 **구워져** 나중에 예전 표시를 고치거나 지울 수 없다(덧칠만 가능) ② 그리기 구현이 둘
③ 쓰는 곳마다 연결 방식이 제각각 → 도구가 바뀌면 여러 곳을 고쳐야 한다.

## 1. 원칙

1. **결과는 늘 두 가지로 남긴다**: 보기용 그림(PNG, 어디서나 그대로 보임) + **편집용 기록**(무엇을 어디에
   그렸는지 데이터). 다시 열면 기록을 불러와 예전 표시를 고치거나 지울 수 있다. 엔진이 바뀌어도 보기용 그림은 그대로라 기존 화면이 깨지지 않는다.
2. **원본은 건드리지 않는다**: 사진·엑스레이 원본은 그대로 두고 그 위 "층"에만 그린다.
3. **쓰는 곳은 한 가지 방법으로만 부른다**: `openDraw(...)` → 결과 `{png, doc}`. 도구가 늘거나 바뀌어도 쓰는 곳은 손대지 않는다.
4. **편집용 기록은 버전을 단다**: 엔진은 예전 버전 기록을 계속 읽는다(올려 읽기). 모르는 항목은 보기용 그림으로 대신 보여준다.
5. **필요할 때만 불러온다**: 엔진은 열 때 로딩(dynamic import), 3D는 고를 때만.

## 2. 구조

```
쓰는 곳(상담 에디터·스테이지·기공지·치아 그림·…)        EO 대화방
        │ openDraw({base, doc?, tools?, saveLabel})          │ iframe + postMessage
        ▼                                                    ▼
  ┌──────────────── components/draw (화면 껍데기) ─────────── /draw (외부용 창) ┐
  │  툴바 · 확대/이동 · 되돌리기 · 저장/취소                                      │
  └───────────────────────────── lib/draw (엔진 핵심, 순수 TS) ──────────────────┘
       바탕(base) 어댑터          도구(tool) 등록부              문서(DrawDoc) 모델·렌더러
       image · xray · blank      pen · line · arrow · rect      버전·올려 읽기·PNG 굽기
       teeth2d · teeth3d(스냅샷)  ellipse · text · highlight
       (→ model3d 직접 그리기)    eraser(항목 지우기) · stamp · measure
```

### 2-1. 편집용 기록 `DrawDoc` (v1)

```ts
type DrawDoc = {
  v: 1;
  base: {
    kind: "image" | "xray" | "blank" | "teeth2d" | "teeth3d";   // 이후 "model3d"
    ref?: string;            // 원본 위치(저장소 경로) — 원본은 수정하지 않음
    w: number; h: number;    // 원본 픽셀 크기 = 좌표계
    view?: { brightness?: number; contrast?: number; invert?: boolean }; // 엑스레이 보기 조정(원본 무변경)
    paper?: "plain" | "grid" | "lined";                                  // blank일 때
  };
  space: "image";            // 이후 "model"(3D 표면 좌표)
  items: DrawItem[];         // 그린 것들 — 원본 픽셀 좌표(해상도 무관)
  calib?: { mmPerPx: number; by: string };  // 엑스레이 실측 보정(측정 도구용)
};
type DrawItem = {
  id: string; tool: string;                   // 등록부의 도구 이름
  pts: number[];                              // [x1,y1,x2,y2,…]
  style: { color: string; width: number; opacity?: number };
  text?: string; stamp?: string;              // 도구별 추가 값
  at?: string;                                // 그린 시각(대화 이력용)
};
```

- 지우개 = **항목 지우기**(획 단위). 픽셀 지우개가 필요하면 "가리기" 항목으로 표현(원본 보존).
- 3D 직접 그리기 단계에서 `space:"model"` + 항목 좌표를 모델 표면 기준으로 저장 → 2D 문서와 같은 틀.

### 2-2. 저장 방식 (DB 변경 없음)

- 보기용 PNG는 지금처럼 각자 자리에 저장(상담 기록 이미지·기공지 첨부).
- 편집용 기록은 **같은 위치에 `<그림 이름>.draw.json`** 으로 나란히 저장. 상담 기록 이미지 태그에는
  `data-draw="<경로>"` 표시 → 다시 열 때 기록을 불러와 층을 복원. 기록이 없는 예전 그림은 지금처럼 그 위에 덧칠.

### 2-3. 외부 창 `/draw` (EO 등) — 계약 확정 (헤임달 #2262 회신, 2026-10-30)

- 로그인·저장 없음(DB·저장소·환자 정보 무접촉). 같은 엔진을 EO가 iframe으로 띄우고 postMessage로 주고받는다.
- 열기 `{type:"carelog-draw/open", v:1, base, image?:Blob, doc?:DrawDoc, tools?}`
  → 완료 `{type:"carelog-draw/done", v:1, png:Blob, doc:DrawDoc}` / 취소 `{type:"carelog-draw/cancel", v:1}`
- 결과 저장은 부른 쪽(EO) 몫. ★돌려주는 DrawDoc의 `base.ref`는 **비워서** 보낸다 — Carelog 저장소 경로를 절대 넣지 않음(EO가 자기 경로로 채움).
- ★"저장 안 함"을 **브라우저가 막게** — `/draw` 응답 헤더(CSP):
  - `frame-ancestors <EO 도메인>` (EO 화면 안에서만 뜸)
  - `connect-src 'none'`(불가하면 `'self'`) — 페이지가 어디로도 데이터를 못 보냄
  - `form-action 'none'` · 외부 스크립트·분석 도구 없음
- postMessage: 양쪽 모두 **targetOrigin 명시("*" 금지) + 받은 메시지 origin 검사**.
- 경로 공개: middleware 공개 경로에 `/draw` 추가(로그인 불요), 페이지는 서버 데이터 접근 코드 없음.

## 3. 단계

| 단계 | 내용 | 대상 |
|---|---|---|
| **1. 엔진 통합** | `lib/draw` + `components/draw` 신설, ImageAnnotator·SketchPad를 한 엔진으로 통합, 편집용 기록 저장·다시 열어 고치기. 쓰는 곳 5곳을 `openDraw`로 교체. **겉모습·사용법은 지금과 같게**(회귀 없음) | 상담 에디터·스테이지·치아 그림·기공지 손그림·첨부 수정 |
| 2. 엑스레이·임상 도구 | 엑스레이 바탕(밝기·대비·반전), 실측 보정+길이 측정, 도장(임플란트·크라운 등), 타원·형광펜 | 상담(엑스레이 설명) |
| 3. 외부 창 `/draw` | iframe + postMessage 규격 v1 + CSP(§2-3) — EO 대화방 [✏️ 그리기] | EO(계약 확정 #2262 · EO 구현 = 마르코) |
| 4. 3D 직접 그리기 | `space:"model"` — 치아 모형 표면에 직접 표시, 스냅샷은 보기용 PNG로 | 상담·기공지 |

## 4. 미결

- 엑스레이 원본 형식: 지금은 일반 이미지(JPG/PNG) 전제. DICOM 등 원본 연동은 별도 결정(웹세프 spec 033 연계 여부).
- 측정 보정 기준(자·임플란트 길이 등)은 2단계 착수 때 현장 확인.

## 5. 1단계 구현 기록 (2026-10-30)

- 신설: `lib/draw/doc.ts`(DrawDoc v1·upgradeDoc·drawUnit) · `lib/draw/render.ts`(도구 등록부·렌더·획 hit-test·flattenDoc)
  · `components/draw/draw-editor.tsx`(화면) · `lib/draw/consult-store.ts`(상담 버킷 저장/불러오기).
- 삭제: `components/image-annotator.tsx`, `components/lab/sketch-pad.tsx` → 전부 DrawEditor.
- 쓰는 곳 교체:
  - 상담 에디터: 붙여넣기·드롭·이미지 버튼 → 저장 시 원본+보기용+기록 업로드, `<img data-draw>`. 이미지 선택 시 **[✏️ 고치기]**(그 자리 교체, 신규) · [🖊 크게](스냅샷 추가, 기존).
  - 자료 픽커: 스테이지(원본 = 자료 URL, 재업로드 없음) · 빈 캔버스(백지/모눈/줄노트 = 종이 바탕, 이미지 굽기 없음).
  - 치아 그림: 그려서 담기 → `onDone(image, text, drawing)` — 바탕 kind teeth2d/teeth3d.
  - 기공지: 그림 지시(빈 종이, 그린 게 없으면 저장 비활성) · 첨부 고치기(기록 있으면 층 복원, 없으면 지금 그림 위 덧칠 — 원본 = 그 첨부 경로) · 치아 모형.
    원본·기록은 lab-orders 버킷에 저장만(첨부 목록 밖), 첨부 meta에 `draw` 경로 — **EO 전송 wire에는 실리지 않음**(전송기가 kind·name·bytes·signed_url만 구성).
- 바뀐 동작: **지우개 = 누른 획을 통째로 지움**(예전: 흰색으로 칠함 → 사진 위에서 흰 자국). 기록이 없는 예전 그림의 구워진 표시는 지울 수 없고 덧그리기만 가능.
  [↪ 다시]·[모두 지우기]·Ctrl+Shift+Z/Ctrl+Y 추가. 펜 획은 곡선 보정. 바탕 최대 1600px(업로드 압축과 같은 기준, 예전 900×640보다 선명).
- 검증(헤드리스 크로미움, 임시 화면): 펜·화살표·사각형·텍스트 → 저장(기록 4항목, 원본 업로드 필요 표시) → 다시 열어 화살표만 지움 → 저장(3항목, 원본 그대로) ·
  모눈 종이 빈 상태 저장 비활성 → 한 획 후 저장. 콘솔 오류 0. 실제 저장소 업로드·터치(핀치) 동작은 배포 후 실기기 확인.
