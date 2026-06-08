#!/bin/bash
# 헤임달 상호읽기 훅 — 위성 레포(iris·carelog)에 그대로 떨군다.
# 원격 세션 시작 시 형제 레포(eo·iris·carelog 중 자기 자신 제외)를 읽기 참조로 부착.
#  · 있으면 pull로 최신화, 없으면 clone (멱등) · 비대화 · 토큰 노출 없음 · 조용히 실패 허용.
# 설치: 이 파일을 <레포>/.claude/hooks/session-start.sh 로 두고 settings.json SessionStart에 등록.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then exit 0; fi
if [ -z "${GH_TOKEN:-}" ]; then exit 0; fi

parent="$(cd "${CLAUDE_PROJECT_DIR:-.}/.." && pwd)"
self="$(basename "${CLAUDE_PROJECT_DIR:-$PWD}")"
CRED='!f(){ echo username=x-access-token; echo "password=$GH_TOKEN"; }; f'

attach() {
  local repo="$1" dest="$parent/$1"
  [ "$repo" = "$self" ] && return 0   # 자기 자신은 건너뜀
  if [ -d "$dest/.git" ]; then
    git -C "$dest" -c credential.helper="$CRED" pull --ff-only >/dev/null 2>&1 || true
  else
    git -c credential.helper="$CRED" \
      clone --depth 1 "https://github.com/gungang83/$repo.git" "$dest" >/dev/null 2>&1 || true
  fi
}

# 형제 레포 목록 — 새 위성이 합류하면 여기에 한 줄 추가
attach eo
attach iris
attach carelog
exit 0
