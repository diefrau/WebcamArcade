# 실행 명령과 조건

루트: `C:/Users/xofkd/OneDrive/바탕 화면/웹디자인II/WebcamArcade`; Node 24.15.0, npm 11.12.1, Windows 11. 패키지 변경 시 lockfile에 맞춘 `npm ci`; 기존 node_modules를 덮어쓰지 않도록 기준 버전은 별도 worktree에서 실행했다.

- 타입 검사 포함 프로덕션 빌드: `npm run build` (종료 0, `artifacts/optimization-build.log`). 별도 lint 스크립트 없음.
- 실행: `npm run preview -- --host 127.0.0.1 --port 4179 --strictPort`; 기준 worktree에서 동일 명령 포트 4178. 경로 `/WebcamArcade/play/{shoot,circle,cham}`.
- 선별 회귀: `npm test -- tests/vision-polish.spec.ts tests/camera.spec.ts tests/cham.spec.ts tests/rps.spec.ts tests/dodge.spec.ts tests/circle-auto-close.spec.ts --workers=2` (최초 종료 1); 실패 4개 `npm test -- tests/cham.spec.ts tests/circle-auto-close.spec.ts tests/dodge.spec.ts tests/rps.spec.ts --workers=1 -g "brief side-profile|webcam completes exactly once via closure|webcam calibrates off-center|a stable hand shape scores"` (종료 0).
- 탐색용 가짜 카메라 계측: 위 두 빌드 서버 실행 후 루트에서 `node docs/optimization/measure-fake.mjs`; 원시 데이터 `docs/optimization/raw/synthetic-desktop.json`, 로그 `artifacts/optimization-synthetic.log`. 고정 샘플 1회씩, 3초 워밍업/10초 측정. 실기기·실제 사용자 인식률·실제 센서 지연이 아니다. 기본 앱은 이 스크립트 없이 계측하지 않는다.
- 전체 테스트 `npm test`, SQL `npm run test:db`, 온라인 mock `npm run test:community`, Pages 경로 `npm run test:pages`는 이번 조사에서 미실행. 실제 사용자 참여 장시간 측정 및 스마트폰 테스트 미실행. Windows 실카메라 세 게임은 버전별 약 10초씩 예비 측정했다.
- 모바일 실카메라는 HTTPS secure context 필요. 기존 배포 사이트 또는 보안 연결된 별도 테스트 배포가 필요하며, 현재 로컬 `127.0.0.1`은 휴대폰의 localhost가 아니다. 외부 노출 및 배포는 사용자 승인 없이 수행하지 않았다.

## 수동 실카메라 계측 도구

두 빌드 서버를 앞의 포트에서 띄운 뒤 `node docs/optimization/measure-live.mjs baseline shoot 10` 또는 `node docs/optimization/measure-live.mjs current shoot 10`을 실행한다. Chrome 창에서 사용자가 직접 카메라 연결 및 권한을 허용하고 게임을 시작한 뒤 F8을 눌러 계측한다. 앱에 주입되는 측정은 이 임시 테스트 창에만 적용되며, 원시 영상·얼굴·손 랜드마크를 저장하지 않는다. Supabase 인증·REST 요청은 해당 테스트 창에서 차단한다. 카메라 설정은 해상도·FPS 등만 기록하고 장치 ID는 저장하지 않는다. raw JSON은 `artifacts/optimization-live/`에 저장된다. 기존 버전은 shoot/circle/cham만 가능하다. 실제 작업자의 동작과 시간 창, 권한 대기, 전원·발열·조명은 수동으로 별도 기록해야 하며 사용자 허용 없이 카메라를 켜지 않는다.

`node docs/optimization/measure-overhead.mjs`는 현재 빌드에서 Worker 래핑을 하지 않고 RAF만 관찰한 별도 가짜 카메라 실행이다. 완전한 계측 OFF가 아니며 두 실험 간 노이즈를 통제한 반복 실험도 아니어서 계측 오버헤드 수치를 확정할 수 없다. 원시 결과 `raw/synthetic-overhead-control.json`.

## 원 점수 함수 고정 입력 비교

`node docs/optimization/compare-circle-score.mjs`는 두 버전 파일에서 실제 점수 함수와 보조 함수를 각각 읽어 동일한 합성 좌표를 전달한다. 연속된 닫힌 원, 70% 열린 원, 타원, 낮은 점 수 등 6개 시나리오는 반환 점수·정확도(또는 판정 불가)가 같았다. 획 분리 표시가 들어간 열린 원 1개는 기준 436점/44%, 현재 432점/43%로 달랐다. 기준 시점에는 다중 획 표시 자체가 없었고 현재는 끊어진 구간의 각도 합산을 생략하는 코드 차이가 있으므로 같은 게임 이벤트 의미라는 가정은 성립하지 않는다. 이는 현재 버전 회귀나 실카메라 인식 실패의 증거가 아니다. raw: `raw/circle-score-fixtures.json`. Node 24의 실험적 `stripTypeScriptTypes` API를 사용하므로 경고가 출력된다.

- 원 점수 합성 입력 비교: `node docs/optimization/compare-circle-score.mjs`. 웹캠·전체 이벤트 검증이 아니다.
- 손 랜드마크 합성 비교: `node docs/optimization/compare-landmarks.mjs`.

- 원 점수 비교 도구의 최초 TypeScript AST 시도는 현재 TypeScript 7 패키지에서 기대한 API를 제공하지 않아 실패했다. Node 24의 실험적 stripTypeScriptTypes로 대체해 재실행했으며 경고가 나온다.
