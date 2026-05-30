@AGENTS.md

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

## 멀티 에이전트 협업 모델 (2역할)

> 전체 지침: `docs/multi-agent-playbook-template.md` (이식용 템플릿 원본)
> 에이전트별 **정체성·전용 마무리 루틴**은 각 브랜치의 `CLAUDE.local.md`(`.gitattributes`의 `merge=ours`로 보호)에 둔다.
> _역할 라벨(이름·이모지)은 추후 확정 → 확정 시 부록 B로 각 브랜치에 `CLAUDE.local.md` 생성._

### 역할 & 파일 소유권

| 역할 | 책임 | 소유 파일 | 코드/배포 |
|------|------|----------|-----------|
| **기획 PM** | 스펙·UX·로드맵·우선순위 | `specs/`, `roadmap.md`, `project_status.md` | 코드 읽기만 · main 머지 ❌ |
| **시니어 개발·배포** | 구현·DB·배포·인프라 | `src/`, `package.json`, `supabase/`, 설정 | 코드 ✅ · **main 배포 전속** |

- 기획 PM은 `src/`를 수정하지 않고, 시니어 개발은 기획 문서(`specs/`·`roadmap.md`)를 수정하지 않는다 → 두 영역의 머지가 구조적으로 안 부딪힌다.

### 브랜치 전략

```
main = 프로덕션 (Vercel 배포 대상)
dev  = 개발/통합

기획 PM        : {{기획PM 브랜치}}/docs → main → dev 동기화
시니어 개발·배포 : dev → main 배포
```

- 각 에이전트는 자기 전용 브랜치에서만 작업. 남의 브랜치에 직접 push 금지.
- **배포(main 머지)는 시니어 개발·배포 담당 전속.** 기획 PM은 자기 docs 브랜치에 push하고 main 머지는 하지 않는다.

### 커밋 컨벤션 (말머리 필수)

모든 커밋 맨 앞에 에이전트 말머리 `[이름]`. 타입은 `feat`/`fix`/`chore`/`refactor`/`docs`.
예: `[시니어] feat: SMS 수집 회계 자동화`

### 협업 규칙

```
1. 동일 파일 동시 수정 금지 — 작업 전 어떤 파일 건드는지 공유.
2. 핸드오프 — 기획 PM이 specs/NNN/tasks.md 완성 → 개발자가 확인 후 구현 착수.
3. 장기 세션 중엔 작업 시작 전 git fetch/pull origin <내 브랜치>.
4. 기획 PM은 기능 완료 시 project_status.md(사실 기록) 업데이트.
5. 개발자는 구현 완료 시 tasks.md 해당 항목 완료 표시.
6. DB 마이그레이션·인프라 변경은 시니어 개발·배포 담당이 수행.
7. CLAUDE.local.md는 각 브랜치에 커밋 — .gitattributes merge=ours로 보호.
8. 새 spec/문서 채번 전 git fetch origin → 전 브랜치 통틀어 최고 번호 +1. 충돌 시 늦게 만든 쪽 양보.
```

### 위 "마무리 프로토콜"과의 관계

마무리 프로토콜 4단계의 `git push origin main`은 **시니어 개발·배포 담당** 전용 동작이다.
머지 직전 `git config merge.ours.driver true`를 1회 실행한다(원격 컨테이너는 매 세션 초기화되므로 — `CLAUDE.local.md` 머지 보호용).
