# Quickstart: Chair Quick Record

## Prerequisites

1. Supabase migration applied: `supabase/migrations/20260526000001_chair_quick_record.sql`
2. Default chairs (A, B, C) exist in `chairs` table for your institution
3. Staff user is authenticated and has an active institution

---

## Scenario 1: Record from Chair (Happy Path)

**Setup**: Staff is viewing any dashboard page (patient list, settings, etc.)

1. Look at the dashboard header — three chair buttons `[A] [B] [C]` appear between the logo and the refresh/profile buttons
2. Tap **[A]** — overlay appears over the current screen (background is dimmed)
3. Tap **"녹음 시작"** — button turns red with pulsing indicator, timer starts
4. Speak the consultation content
5. Tap **"중지 및 변환"** — overlay shows "음성 인식 중…" spinner
6. After 10–30 seconds, transcribed + summarized text appears in the overlay
7. Edit the text if needed
8. Tap **"임시 저장"** — record is saved; overlay shows "저장됨 ✓"
9. Tap **"닫기"** — overlay closes; **[A]** button shows a badge (⚠ or count indicator)

**Verification**: Query DB — `SELECT id, chair_id, patient_id, status FROM consultation WHERE patient_id IS NULL ORDER BY created_at DESC LIMIT 1;`
- Should show: `chair_id = <A's uuid>`, `patient_id = NULL`, `status = 'draft'`

---

## Scenario 2: Link Record to Patient

**Setup**: Scenario 1 complete; unlinked record exists on Chair A

1. Tap **[A]** — overlay opens in "미연결 기록" view (list of unlinked records)
2. Tap **"환자 연결"** on the desired record
3. Type patient name or chart number in the search box
4. Tap the matching patient from results
5. Confirm the connection — overlay shows "연결 완료"
6. **[A]** badge disappears (back to idle state)

**Verification**: Query DB — `SELECT patient_id, linked_at, linked_by, status FROM consultation WHERE id = '<id>';`
- Should show: `patient_id = <patient's bigint id>`, `linked_at` is set, `status = 'confirmed'`

---

## Scenario 3: Recording Survives Overlay Close

**Setup**: Staff is recording on Chair B and needs to check another screen

1. Tap **[B]** — overlay opens, start recording
2. While recording, tap **"닫기"** — overlay closes; **[B]** button shows red pulsing indicator
3. Navigate to patient list page (full page navigation)
4. **[B]** still shows red pulsing indicator (recording is in global client state)
5. Tap **[B]** — overlay reopens in recording state with elapsed timer still counting
6. Tap **"중지 및 변환"** — continues normally

**Verification**: Audio data (blob chunks) are preserved in the ChairProvider context ref.

---

## Scenario 4: Concurrent Chair Recording

**Setup**: Two patients arrive simultaneously

1. Tap **[A]** → start recording → close overlay (still recording)
2. Tap **[B]** → start recording → close overlay (both recording simultaneously)
3. Header shows: `[A ●] [B ●] [C ○]` (two active recording indicators)
4. Stop each recording independently via their respective overlays

---

## Scenario 5: Audit Log Verification

**Setup**: Complete Scenario 1 and 2

Query:
```sql
SELECT event_type, actor_user_id, patient_id_before, patient_id_after, created_at
FROM chair_audit_logs
WHERE consultation_id = '<id>'
ORDER BY created_at;
```

Expected rows:
| event_type      | patient_id_before | patient_id_after |
|-----------------|-------------------|------------------|
| record_created  | NULL              | NULL             |
| record_edited   | NULL              | NULL             |  ← if text was edited
| patient_linked  | NULL              | <patient_id>     |

---

## Error Scenario: No Microphone Permission

1. Tap any chair button → overlay opens
2. Tap **"녹음 시작"**
3. Browser denies microphone — overlay shows:
   > "마이크 접근 권한이 필요합니다. 텍스트로 직접 입력하세요."
4. Text input field appears for manual entry
5. Complete normally via text input
