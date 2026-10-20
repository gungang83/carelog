# spec 035 — 기공지 작성을 Carelog로 · 🧪 테스트중 (EO spec-138 연동)

> 상태: **1차 구현 (2026-10-20).** 카드 #1957(경계·계약 합의) → #1959(착수 — 대표 확정·헤임달 검수 불요).
> 경계: **Carelog = 쓰는 곳**(환자·양식·작성·첨부) / **EO = 거래로 받는 곳**(의뢰 레코드·/lab-work·정산).
> EO측 게이트웨이 EP는 테오가 병행 구축 — 계약(§2-1·2-2)이 확정이라 모양 불변, Carelog는 큐로 흡수.
> 현장 사실: 기공지는 종이만 · 위생사가 · 진료 중 그 자리에서 · 기공소마다 양식 다름 · 사진·동영상·그리기 필요.

## 1. 데이터 (migration `20261020000001_lab_orders.sql`)

| | 내용 |
|---|---|
| `lab_order_forms` | **양식 = 코드 아닌 데이터 정의**(eval_templates·상담자료와 같은 계열). `institution_id`(NULL=전역)·`lab_name`(NULL=공통/지정=기공소 전용)·`def` jsonb `{key, prosthesis_options, shade_systems, sections:[{id,title,fields:[{id,label,type,options?,unit?,hint?}]}]}`. field type: text/textarea/select/multi/check/number/date/**ea**(수량). 첫 시드 = 지플란트 실물(§3 핸드오버): Custom(임플란트)·Crown·치과 체크리스트(동봉물 EA). 첫 진입 시 자동 씨드 |
| `lab_orders` | 의뢰 레코드 겸 **전송 큐**. `id` = carelog_order_id(클라 생성 uuid — **멱등 키**). `payload` jsonb = 계약 §2-2 전송 스냅샷(첨부는 path 보관). `status`: queued(재시도) → sent / failed(영구·수동 재시도 가능). attempts·error·eo_order_id |
| storage `lab-orders` | **비공개** 버킷(사진·동영상·손그림). 서명 URL로만 접근 |

RLS: 두 테이블 enable + 정책 0(서버 전용). 가드 = 기관 멤버십(위생사 포함 전 직원 — 작성 주체).

## 2. 전송 (카드 #1957 합의 구현)

- `lib/eo/lab-gateway.ts` — 크레딧 게이트웨이(spec 031) 패턴: `EO_LAB_GATEWAY=on` + `CARELOG_GATEWAY_SECRET`, never-throw.
  §2-1 `GET /api/gateway/dental-labs`(기공소 목록 — EO 정본, Carelog 미생성) · §2-2 `POST /api/gateway/dental-lab/orders`.
- **저장=복사, 전달=참조**: 첨부는 Carelog 비공개 버킷 보관 → 전송 시점에 24h 서명 URL 생성 → EO가 pull해 자기 스토리지에 복사.
  용량: 사진 5MB(webp 압축 선적용) · 동영상 50MB/30초(클라 duration 검증) · 건당 합계 100MB.
- **form.display**: values(기계용)와 함께 사람용 표시 스냅샷 `[{section,label,value}]`를 전송 — EO·기공소는 display만 렌더(무해석).
- **share 정책**: ✗ 필드는 송신 직전에 애초에 안 보냄. 목록 미발효 시 보수 기본값(name O·chart_no X·doctor O).
- **fail-safe 큐**: 제출 즉시 전송 시도 → 실패/미발효면 queued 보관, cron(`/api/cron/process-lab-orders`, 10분)이 재전송.
  4xx(계약 위반)만 failed, 수동 [다시 보내기]로 복귀 가능. **기공지는 유실되지 않는다.**

## 3. UI

- `/lab-orders`(대시보드) — 목록(상태 뱃지·EO 의뢰번호·다시 보내기) + 새 기공지 작성.
- 작성 화면(`lab-order-composer`): 기공소 선택(EO 목록, 미발효 시 직접 입력 폴백) · 환자 검색(기존 patient)
  또는 직접 입력 · Dr./D.H. · **치식도(FDI 토글)** · 보철/재료/Shade(체계+값)/납기/구분(의뢰·수정·재제작+사유)
  · **동적 양식 렌더**(섹션 접이식) · 기타 주문사항 · 첨부(📷 사진 capture+압축 / 🎬 동영상 30초 / ✏️ 손그림 SketchPad).
  업로드는 서명 업로드 URL(서버 액션 25MB 한도 우회).
- 진입: 상담보드 하단 **[🦷 기공지]**(새 탭 — 보드 상태 유지) + 직접 URL. 체어 오버레이 진입은 2차.

## 3.5 v2 (2026-10-20 대표 피드백 — migration `20261020000002`)

- **세트 의뢰**: 한 장=한 종류 기공물이되 [+ 기공물 추가]로 여러 장을 한 세트로 — 장마다 lab_orders 1행
  (각자 멱등 키), `set_id`로 묶고 payload에 `set:{id,index,total}`(additive — EO는 표시만). 공통 필드
  (기공소·환자·날짜·구분·지시·첨부)는 세트 공유, 치식·보철·재료·Shade·양식 값은 장별.
- **의뢰일**(order_date, 기본 오늘) 추가 · 납기 라벨 "완료 희망(납기)일".
- **사후 수정·첨부 추가**: 목록 [수정·첨부] → 세트를 컴포저로 불러와 수정 → `revision`+1,
  `edit_log`에 {누가, 언제, 수정 시점의 전송/포탈 상태} append → 수정본 재전송(payload에 revision).
  **전송(접수) 후 수정은 목록에 "v2 수정됨 · 전송 후" 경고 뱃지**로 명확히 표시.
  ★EO측 규칙 제안(마르코): 같은 carelog_order_id + 더 높은 revision = 업데이트로 처리 + 기공소에
  🔄수정 알림(EO 복제 기능 재사용) — 계약 §2-2 확장 합의 필요.
- **기공소 선택**: EO 목록(정본) + **거래했던 기공소**(보낸 기공지 distinct 최근순) 칩·자동완성 + 직접 입력.

## 4. 2차 (보류)

- EO→Carelog 상태 알림(§2-3 — 접수·제작중·완료 표시) · 양식 편집 UI(지금은 데이터 직접 수정 — 지플란트
  미결 §5 답 반영도 def 수정만) · 보철 종류에 따른 섹션 자동 접힘(미결 §5-3) · 체어 오버레이 진입 ·
  상담 기록과의 연결(consultation_id 컬럼은 준비됨).

## 5. 발효 조건

env `EO_LAB_GATEWAY=on` (Vercel) — 테오의 EO EP(§2-1·2-2) 배포 후. 그 전까지 작성·보관은 정상 동작,
전송은 큐 대기(화면에 "통로 연결 전 — 자동 전송 예정" 안내).
