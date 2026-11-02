# 온라인 랭킹 / 도전과제 연결

앱의 `/ranking`, `/achievements`는 설정 없이 기기 기록으로 작동합니다. 실제 온라인 DB는 사용자의 Supabase 프로젝트에서 아래 설정을 마쳐야 연결됩니다. 이 저장소에는 프로젝트 관리자 키나 접속 비밀번호가 없습니다.

현재 배포는 `apygsdlruttdvmfikkpm` 프로젝트에 연결되어 있습니다. 아래 SQL은 해당 프로젝트의 SQL Editor에서 이미 적용했고, Anonymous Sign-Ins도 활성화했습니다. 공개 연결 값은 GitHub Actions Variables와 Git에서 제외된 `.env.local`에 설정했습니다. 같은 프로젝트에 생성 SQL을 다시 실행할 필요는 없습니다. 아래 절차는 새 프로젝트를 연결할 때 사용합니다.

## Supabase 설정

1. Supabase에 PostgreSQL 프로젝트를 만듭니다.
2. SQL Editor에서 [기본 마이그레이션](migrations/202610180001_arcade.sql), [도전과제 진행도 마이그레이션](migrations/202610190001_achievement_counts.sql), [익명 이름 마이그레이션](migrations/202610190002_player_identity.sql), [비밀 도전과제 마이그레이션](migrations/202610190003_secret_achievements.sql)을 순서대로 한 번씩 실행합니다. CLI를 사용한다면 프로젝트를 연결한 뒤 `supabase db push`를 실행합니다.
3. Authentication → Sign In / Providers에서 **Anonymous Sign-Ins**를 켭니다. 이메일 없이도 각 브라우저에 별도의 인증 ID가 생깁니다.
4. Project URL과 **publishable key**(또는 기존 anon key)를 복사합니다. `.env.example`을 `.env.local`로 복사하고 다음 두 값을 채운 뒤 개발 서버를 다시 시작합니다.

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

`service_role`, `sb_secret_...`, DB 비밀번호는 브라우저 코드나 `VITE_*` 변수에 넣지 않습니다.

GitHub Pages는 SQL 서버를 실행하지 않습니다. GitHub 저장소 Settings → Secrets and variables → Actions → **Variables**에도 위 이름의 공개 변수 두 개를 추가하고 Pages workflow를 다시 실행합니다. 워크플로가 빌드에 해당 값을 전달합니다.

## 동작과 데이터

- 홈 첫 방문 팝업에서 닉네임 또는 익명 시작을 선택하면 온라인 참가를 시작합니다. 선택 전에는 계정을 생성하지 않습니다. 닉네임 중복은 허용하지만, 익명 이름은 SQL 시퀀스로 `익명1000`처럼 중복 없이 부여하고 이름을 바꿔도 같은 번호를 유지합니다. 설정이 없거나 오프라인이면 기기에 이름을 보관하고, 연결 시 서버 번호를 확정합니다.
- 참가 시 이 기기에 대기 중인 최근 완료 기록(최대 100개)을 전송합니다. 이후 새 기록은 자동 동기화합니다. 기존 최고 기록은 로컬 랭킹에 유지하며, 과거 localStorage 집계에서 가상의 온라인 플레이를 만들지 않습니다. 도전과제는 업데이트 이후 완료한 기록부터 집계합니다.
- `arcade_profiles`: 인증 ID, 공개 닉네임, 고유 익명 이름. `arcade_runs`: 완료 UUID, 게임, 점수, 정확도, 생존 시간, 서버 접수 시각. 영상·얼굴 좌표·손 좌표는 보내지 않습니다.
- 공개 랭킹 RPC는 게임별 사용자 최고 기록을 최대 50개 반환하며 순위·닉네임·점수만 노출합니다. 인증 ID나 개인의 플레이 이력은 공개하지 않습니다. 도전과제는 자신의 SQL 기록에서 계산합니다.
- 횟수형 도전과제는 현재/목표 수치와 진행 바를 표시합니다. 같은 게임의 반복 플레이는 횟수만 늘리고 게임 종류 수는 늘리지 않습니다. 달성 시 5/5, 3/3으로 표시하며, 로컬 기록 100개 보관 한도를 넘어가도 누적한 게임 종류와 달성 상태를 보존합니다.
- 비밀 과제 6종은 PC 홈에서 웹캠을 켠 뒤 판정합니다. 잠금 카드는 회색 `???`이며 달성 시에만 이름·조건과 반짝임을 표시합니다. 두 손과 얼굴은 별도 워커의 같은 프레임 결과를 합칩니다. 터치 환경과 게임 화면은 기존 인식 경로를 사용합니다. 달성 ID만 `arcade_secrets`에 저장하고 영상·랜드마크·표정 점수는 업로드하지 않습니다.
- 테이블은 RLS로 자기 기록만 읽을 수 있고 직접 쓰기는 막혀 있습니다. 전용 RPC가 현재 인증 ID를 사용해 저장합니다. UUID 중복 제출은 한 번만 집계하며 점수·정확도·시간 범위를 검사합니다. 한 계정당 분당 새 기록 최대 20개입니다. 초과 시 미전송 기록은 남고 다음 동기화에서 재시도합니다.
- 이 버전의 온라인 점수는 **클라이언트가 제출한 커뮤니티 기록**입니다. 서버가 게임 전체를 재실행하거나 부정 조작을 판별하지는 않습니다. 상품 지급용 경쟁 랭킹으로 사용하려면 별도의 서버 검증이 필요합니다.
- 브라우저 데이터를 지우면 익명 계정 접근을 복구할 수 없습니다. Supabase 관리자가 Auth 사용자를 삭제하면 관련 프로필·점수도 외래 키를 통해 삭제됩니다.
- 게임 완료 때마다 결과를 즉시 전송하며, 전송 중 끝난 다음 게임도 이어서 전송합니다. 실패한 기록은 미전송 상태로 유지하고 네트워크 복구·다음 접속·30초 간격 재시도에서 동기화합니다. 연결 오류는 게임이나 결과 화면을 막지 않으며, 홈에서 동기화 상태와 이름 변경을 확인할 수 있습니다.

## 검증

```
npm run test:db
npm run test:community
npm test
npm run test:pages
```

`test:db`는 PGlite의 실제 PostgreSQL 엔진에서 같은 마이그레이션을 실행하고 RLS·권한·중복·입력 제한·순위·도전과제·연쇄 삭제를 검사합니다. 테스트의 Auth 스키마는 최소한의 대체 구현입니다. `test:community`는 별도 Vite 서버와 모의 Supabase 응답으로 익명 참가·동기화·공개 닉네임·통신 오류 복구를 검사합니다. 실제 Supabase Auth 배포 검증은 프로젝트 연결 후 필요합니다.

공식 참고: [익명 로그인](https://supabase.com/docs/guides/auth/auth-anonymous), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [DB 함수 권한](https://supabase.com/docs/guides/database/functions).

## 게임 모드별 랭킹 (2026-11-02)

`migrations/202611010001_game_modes.sql`은 기존 기록을 `standard`로 유지하고 모드별 저장/조회 함수를 추가한다. 이 프로젝트의 Supabase에는 SQL Editor에서 적용 후 공개 조회 RPC를 확인했다. 기존 데이터가 삭제되지 않으며 모드별 인덱스와 유효한 게임·모드 조합, 점수·시간 제한을 유지한다.

- 쏴!: 기본 / 타깃 웨이브 (30초 안에 12개 명중)
- 참!참!참!: 기본 / 최고 난이도 (응답 시간 540ms)
- 빨리 피해!: 기본 / 60초 생존 / 상하 이동 / 상하 이동 60초
- 원 그리기·가위바위보: 기본

클라이언트는 `arcade_board_mode`로 조회한다. 기존 서버 호환을 위해 기본 모드만 이전 조회 함수로 대체할 수 있다. 새 모드는 기존 저장 함수로 보내지 않아 랭킹 혼합을 방지하며, 서버 연결 실패 시 기록을 기기에 보존한다. 기본 모드의 기존 최고 기록은 유지하고 모드별 최고 기록은 최근 100개 게임과 별도로 보존한다.

검증: `npm run test:db`, `npm run test:community`, `npx playwright test tests/game-modes.spec.ts tests/community.spec.ts --workers=1`, `npm run build`. 실서버 공개 조회는 기본/웨이브/최고난이도/생존/상하 모드에서 성공했다. 실제 사용자 점수를 만드는 제출 실험은 수행하지 않았다.

Near Miss 및 포즈 게임 관련 준비 중 도전과제는 유지한다.

## 무한·술래 모드 확장

`migrations/202611020001_endless_seeker.sql`은 쏴!와 빨리 피해!의 무한 모드, 상하 이동 무한, 참참참 술래 모드의 저장 제한과 게임·모드 조합을 추가한다. 이전 모드의 기록과 랭킹은 그대로 분리한다. 시간 제한 없이 진행하며 라이프 소진 또는 기록 저장 버튼으로 끝난다. 점수는 PostgreSQL integer 상한, 저장 시간은 1년 상한으로 제한하고 게임의 종료 시각으로 쓰지 않는다.

술래는 검지의 화면상 방향을 120ms 유지해 확정한다. 컴퓨터의 미리 정한 방향은 응답 중 숨기고 판정 후 공개한다. 술래에서는 얼굴 모델 대신 손 모델을 실행하며, 버튼·키보드 대체 입력도 지원한다. 기존 피하기 전용 연승/퍼펙트 도전과제는 술래 결과로 달성되지 않는다.

검증: `tests/endless-seeker.spec.ts`는 무한 진행·저장, 술래 판정·별도 기록 및 Worker 모의 입력의 손 인식 전환을 확인한다. 실제 손 영상의 정확도 측정은 별도 필요하다. SQL은 로컬 PostgreSQL 테스트를 통과했다. 2026-11-02 사용자가 SQL Editor에서 002 확장을 실행했다고 확인했다. 이후 공개 키로 shoot/standard, shoot/endless, cham/seeker, dodge/endless, dodge/vertical-endless 랭킹 조회가 모두 정상 응답함을 확인했다. 실제 서버의 제약 메타데이터 조회와 점수 제출 시험은 수행하지 않았으므로 조회 성공 자체를 저장 제약 검증으로 해석하지 않는다.
