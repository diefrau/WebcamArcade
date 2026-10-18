# 온라인 랭킹 / 도전과제 연결

앱의 `/ranking`, `/achievements`는 설정 없이 기기 기록으로 작동합니다. 실제 온라인 DB는 사용자의 Supabase 프로젝트에서 아래 설정을 마쳐야 연결됩니다. 이 저장소에는 프로젝트 관리자 키나 접속 비밀번호가 없습니다.

현재 배포는 `apygsdlruttdvmfikkpm` 프로젝트에 연결되어 있습니다. 아래 SQL은 해당 프로젝트의 SQL Editor에서 이미 적용했고, Anonymous Sign-Ins도 활성화했습니다. 공개 연결 값은 GitHub Actions Variables와 Git에서 제외된 `.env.local`에 설정했습니다. 같은 프로젝트에 생성 SQL을 다시 실행할 필요는 없습니다. 아래 절차는 새 프로젝트를 연결할 때 사용합니다.

## Supabase 설정

1. Supabase에 PostgreSQL 프로젝트를 만듭니다.
2. SQL Editor에서 [기본 마이그레이션](migrations/202610180001_arcade.sql), [도전과제 진행도 마이그레이션](migrations/202610190001_achievement_counts.sql)을 순서대로 한 번씩 실행합니다. CLI를 사용한다면 프로젝트를 연결한 뒤 `supabase db push`를 실행합니다.
3. Authentication → Sign In / Providers에서 **Anonymous Sign-Ins**를 켭니다. 이메일 없이도 각 브라우저에 별도의 인증 ID가 생깁니다.
4. Project URL과 **publishable key**(또는 기존 anon key)를 복사합니다. `.env.example`을 `.env.local`로 복사하고 다음 두 값을 채운 뒤 개발 서버를 다시 시작합니다.

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

`service_role`, `sb_secret_...`, DB 비밀번호는 브라우저 코드나 `VITE_*` 변수에 넣지 않습니다.

GitHub Pages는 SQL 서버를 실행하지 않습니다. GitHub 저장소 Settings → Secrets and variables → Actions → **Variables**에도 위 이름의 공개 변수 두 개를 추가하고 Pages workflow를 다시 실행합니다. 워크플로가 빌드에 해당 값을 전달합니다.

## 동작과 데이터

- 익명 계정 생성은 사용자가 온라인 탭의 참가 버튼을 누를 때만 실행합니다. 닉네임은 선택이며, 비우면 익명으로 표시합니다. 닉네임 중복은 허용합니다.
- 참가 시 이 기기에 대기 중인 최근 완료 기록(최대 100개)을 전송합니다. 이후 새 기록은 자동 동기화합니다. 기존 최고 기록은 로컬 랭킹에 유지하며, 과거 localStorage 집계에서 가상의 온라인 플레이를 만들지 않습니다. 도전과제는 업데이트 이후 완료한 기록부터 집계합니다.
- `arcade_profiles`: 인증 ID, 공개 닉네임. `arcade_runs`: 완료 UUID, 게임, 점수, 정확도, 생존 시간, 서버 접수 시각. 영상·얼굴 좌표·손 좌표는 보내지 않습니다.
- 공개 랭킹 RPC는 게임별 사용자 최고 기록을 최대 50개 반환하며 순위·닉네임·점수만 노출합니다. 인증 ID나 개인의 플레이 이력은 공개하지 않습니다. 도전과제는 자신의 SQL 기록에서 계산합니다.
- 횟수형 도전과제는 현재/목표 수치와 진행 바를 표시합니다. 같은 게임의 반복 플레이는 횟수만 늘리고 게임 종류 수는 늘리지 않습니다. 달성 시 5/5, 3/3으로 표시하며, 로컬 기록 100개 보관 한도를 넘어가도 누적한 게임 종류와 달성 상태를 보존합니다.
- 테이블은 RLS로 자기 기록만 읽을 수 있고 직접 쓰기는 막혀 있습니다. 전용 RPC가 현재 인증 ID를 사용해 저장합니다. UUID 중복 제출은 한 번만 집계하며 점수·정확도·시간 범위를 검사합니다. 한 계정당 분당 새 기록 최대 20개입니다. 초과 시 미전송 기록은 남고 다음 동기화에서 재시도합니다.
- 이 버전의 온라인 점수는 **클라이언트가 제출한 커뮤니티 기록**입니다. 서버가 게임 전체를 재실행하거나 부정 조작을 판별하지는 않습니다. 상품 지급용 경쟁 랭킹으로 사용하려면 별도의 서버 검증이 필요합니다.
- 브라우저 데이터를 지우면 익명 계정 접근을 복구할 수 없습니다. Supabase 관리자가 Auth 사용자를 삭제하면 관련 프로필·점수도 외래 키를 통해 삭제됩니다.
- 연결 오류는 로컬 게임 완료나 결과 화면을 막지 않습니다. 랭킹 화면에서 재시도할 수 있습니다.

## 검증

```
npm run test:db
npm run test:community
npm test
npm run test:pages
```

`test:db`는 PGlite의 실제 PostgreSQL 엔진에서 같은 마이그레이션을 실행하고 RLS·권한·중복·입력 제한·순위·도전과제·연쇄 삭제를 검사합니다. 테스트의 Auth 스키마는 최소한의 대체 구현입니다. `test:community`는 별도 Vite 서버와 모의 Supabase 응답으로 익명 참가·동기화·공개 닉네임·통신 오류 복구를 검사합니다. 실제 Supabase Auth 배포 검증은 프로젝트 연결 후 필요합니다.

공식 참고: [익명 로그인](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [DB 함수 권한](https://supabase.com/docs/guides/database/functions).
