# spec 039 — 그리기 엔진 (Carelog 공용 · EO도 불러 씀) · 📝 초안

> 상태: **초안 (2026-10-30).** 대표 방향: 그리기는 Carelog 한 곳에서 계속 고도화하는 **공용 모듈/엔진**.
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

### 2-3. 외부 창 `/draw` (EO 등)

- 로그인·저장 없음(DB·저장소·환자 정보 무접촉). 같은 엔진을 iframe으로 띄우고 postMessage로 주고받는다.
- 열기 `{type:"carelog-draw/open", v:1, base, image?:Blob, doc?:DrawDoc, tools?}`
  → 완료 `{type:"carelog-draw/done", v:1, png:Blob, doc:DrawDoc}` / 취소 `{type:"carelog-draw/cancel", v:1}`
- `frame-ancestors`로 허용 도메인(EO)만 · 양쪽 origin 확인. 결과 저장은 부른 쪽 몫.

## 3. 단계

| 단계 | 내용 | 대상 |
|---|---|---|
| **1. 엔진 통합** | `lib/draw` + `components/draw` 신설, ImageAnnotator·SketchPad를 한 엔진으로 통합, 편집용 기록 저장·다시 열어 고치기. 쓰는 곳 5곳을 `openDraw`로 교체. **겉모습·사용법은 지금과 같게**(회귀 없음) | 상담 에디터·스테이지·치아 그림·기공지 손그림·첨부 수정 |
| 2. 엑스레이·임상 도구 | 엑스레이 바탕(밝기·대비·반전), 실측 보정+길이 측정, 도장(임플란트·크라운 등), 타원·형광펜 | 상담(엑스레이 설명) |
| 3. 외부 창 `/draw` | iframe + postMessage 규격 v1 — EO 대화방 [✏️ 그리기] | EO(헤임달 카드 합의 후) |
| 4. 3D 직접 그리기 | `space:"model"` — 치아 모형 표면에 직접 표시, 스냅샷은 보기용 PNG로 | 상담·기공지 |

## 4. 미결

- 엑스레이 원본 형식: 지금은 일반 이미지(JPG/PNG) 전제. DICOM 등 원본 연동은 별도 결정(웹세프 spec 033 연계 여부).
- 측정 보정 기준(자·임플란트 길이 등)은 2단계 착수 때 현장 확인.
