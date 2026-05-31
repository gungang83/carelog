@AGENTS.md

> **조직 공통 운영 규칙은 `PLAYBOOK.md`를 먼저 읽을 것.** (커뮤니케이션·에이전트 정의·커밋 컨벤션·협업 규칙·핸드오프·배포 정책·운영 철학)
> 이 `CLAUDE.md`는 **Carelog 특화 사항만** 다룬다.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at:
specs/006-chair-quick-record/plan.md
<!-- SPECKIT END -->

## 문서 관리 원칙

기능을 구현하거나 버그를 수정할 때마다 아래 문서를 **해당 세션 안에** 업데이트한다:

- `project_status.md` — 완료 기능, 알려진 이슈, 다음 목표 현행화
- `docs/architecture.md` — 구조 변경(새 파일, 디렉터리, 데이터 흐름 변경) 발생 시
- `docs/database.md` — 스키마 변경(컬럼 추가·삭제·타입 변경) 발생 시
- `supabase/schema.sql` — DB 변경 시 반드시 동기화
- `README.md` — 기능 목록이나 프로젝트 구조가 바뀔 때

문서 업데이트 없이 기능 구현을 완료로 간주하지 않는다.

## 마무리 프로토콜 ("마무리하자" 또는 "마무리" 신호)

사용자가 "마무리하자", "마무리할게", "마무리해줘", "wrap up", "done" 등 마무리 의사를 표현하면
아래 체크리스트를 **순서대로 모두 완료**해야 한다. 하나라도 실패하면 이유와 해결 방법을 보고한다.

### 마무리 체크리스트

1. **문서 현행화**
   - `project_status.md`: 이번 세션에서 완료한 기능, 수정한 이슈, 새로 발견한 이슈 반영
   - 변경된 기능에 해당하는 `docs/` 파일 업데이트

2. **빌드 검증**
   ```
   npm run build
   ```
   빌드 에러가 있으면 수정 후 재시도. 경고(warning)는 기록만.

3. **Git 커밋**
   - 변경된 모든 파일 스테이징 (`git add`)
   - 커밋 메시지 형식:
     ```
     <type>: <한 줄 요약>

     - 주요 변경사항 1
     - 주요 변경사항 2
     ```
   - type: `feat` (기능), `fix` (버그), `docs` (문서), `refactor` (리팩토링), `chore` (설정)

4. **GitHub Push**
   ```
   git push origin main
   ```

5. **Vercel 배포 확인**
   - push 완료 후 Vercel이 자동 배포 시작됨을 안내
   - 배포 URL 및 상태 확인 방법 안내

위 5단계를 완료한 뒤 사용자에게 완료 요약 보고:
> "마무리 완료. 빌드 ✅ | GitHub ✅ | Vercel 배포 진행 중"

## Carelog 특화 — 운영 주체 · 브랜치 · 배포

> 조직 공통 협업 규칙·커밋 컨벤션·에이전트 정의는 `PLAYBOOK.md` 참조. 여기엔 Carelog만의 사항만 둔다.

- **운영 주체**: Carelog는 **다온(🟣)이 기획·구현·배포를 겸임**한다. (PLAYBOOK §2 Daon)
  PLAYBOOK §4-10의 "main 배포는 CTO(Theo) 전속"은 EO 조직 기본값이며, **Carelog 레포의 배포 전속자는 다온**이다(별도 Vercel·Supabase로 격리 운영).

### 브랜치 전략 (Carelog)

```
main = 프로덕션 (Vercel 배포 대상)
dev  = 개발/통합
다온 작업 브랜치 : claude/zen-cerf-hWuUw → dev → main 배포
```

- 배포(main 머지)는 다온 전속. 머지 직전 `git config merge.ours.driver true`를 1회 실행한다(원격 컨테이너는 매 세션 초기화 → `CLAUDE.local.md` 머지 보호용).
- 다온 정체성·전용 마무리 루틴은 `CLAUDE.local.md`에 둔다(`.gitattributes`의 `merge=ours`로 보호). ⚠️ Carelog는 원격 web 세션이라 매 세션 레포가 새로 클론되므로, 정체성 유지를 위해 `CLAUDE.local.md`를 **레포에 커밋**한다(PLAYBOOK §2의 "git 미추적"과 달리 Carelog는 추적).

### Vercel 배포 (Carelog)

- **`main`(Production)만 자동 배포.** `dev`·작업 브랜치는 `vercel.json`의 `git.deploymentEnabled`로 Preview 배포 비활성.
- 마무리 프로토콜 4단계 `git push origin main`은 다온(배포 전속) 동작이다.
