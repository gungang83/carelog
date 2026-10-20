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

## 3.6 계약 v1 정합 정정 (2026-10-20 · 카드 #1966 — EO 구현 main@d0620a58 정본 대조)

송신부 자기검증(§2-4 책임 귀속) 결과 정정 5건:
1. **성공 판정 2xx**: EO는 신규=201, 멱등 중복=200(idempotent) — 기존 200-only 판정은 ★모든 정상 전송을
   실패 처리하는 버그였다. `res.ok`로 수정.
2. **첨부 키 `signed_url`**: 기존 `url` 키는 EO가 읽지 않음(pull 0건) — 정정.
3. **에러 규격(ⓓ)**: 실패 본문 `{error}` 단일 키 파싱. 4xx=영구실패 유지하되 "다시 보내 주세요"(첨부 pull
   일시 실패 — URL은 전송마다 재발급이라 재전송=복구)는 재시도로 분류. 5xx(503=설정 미비)는 재시도.
   타임아웃 8s→40s(EO가 첨부 pull 후 응답).
4. **서명 URL ⓒ**: 만료 24h→**15분**. 발급 시점은 원래 전송 직전(sender 내부)이라 큐가 깨지지 않음 —
   큐·로그·행 어디에도 URL 미저장(기존부터 path만 보관).
5. **share ⓐ 확장**: `free_text`·`attachments` 반영 — ✗면 instructions/첨부를 애초에 안 보냄.
   작성 화면에 고지 문구("기타 주문사항·사진은 기공소에 그대로 전달 — 환자 식별정보 금지") 상시.
   display는 양식 필드만 담아 환자 식별정보 미포함(ⓑ-3 — fixed 필드는 display에 안 들어감).
멱등 키: EO `dentweb_ref=carelog:<uuid>` 형식 검증 `[A-Za-z0-9_\-:.]{1,120}` — uuid 통과 확인.
env 켜는 순서(ⓓ 함정): ⛔EO 기공소 연결·포탈 ON(#1965) → 마르코 발효 통보 → 그 후 `EO_LAB_GATEWAY=on`.

## 4. 2차 (보류)

- EO→Carelog 상태 알림(§2-3 — 접수·제작중·완료 표시) · 양식 편집 UI(지금은 데이터 직접 수정 — 지플란트
  미결 §5 답 반영도 def 수정만) · 보철 종류에 따른 섹션 자동 접힘(미결 §5-3) · 체어 오버레이 진입 ·
  상담 기록과의 연결(consultation_id 컬럼은 준비됨).

## 5. 발효 조건

env `EO_LAB_GATEWAY=on` (Vercel) — 테오의 EO EP(§2-1·2-2) 배포 후. 그 전까지 작성·보관은 정상 동작,
전송은 큐 대기(화면에 "통로 연결 전 — 자동 전송 예정" 안내).

## 3.7 기공소 선택 가드 (2026-10-20 · 카드 #1968)

- EO 목록이 살아 있으면(게이트웨이 응답) 선택지는 ★`portal_enabled=true`만 — 거래원장 유래
  이름(「지플란트」 vs 「지플란트기공소」 두 표기 함정)은 공유 설정이 없어 거절되므로 아예 안 보인다.
  자유 입력도 숨김(enabled 0개면 "EO 포탈 설정에서 먼저 켜 주세요" 안내). 수정 모드의 과거 기공소명은
  "(포탈 설정 확인 필요)" 표기로 유지.
- `lab_name`은 목록 문자열 ★원문 그대로 전송(trim 등 변형 금지 — EO 매칭 키). 송신부 검증만 trim.
- 게이트웨이 미발효(null) 동안은 기존 폴백(거래 이력 제안+직접 입력) 유지.

## 3.8 재실측 적발 — 첨부 kind 표준 (2026-10-20 · 카드 #1973)

첫 실측은 display 0·첨부 0이라 "통과할 게 없어서 통과"(마르코 적발). 재실측에서 실제 불일치 1건:
- **첨부 kind**: EO 수신 정본 = `photo|video|drawing`, Carelog 내부 = `photo|video|sketch` —
  계약서에 kind 열거가 없어 양쪽이 다르게 정했다. ★wire에서 `sketch→drawing` 매핑(sender)으로 해소.
  내부 저장·UI는 sketch 유지(기존 행 호환).
- 거절 메시지가 성공(초록) 톤으로 뜨던 표시 버그 수정 — failed는 빨간 톤.
