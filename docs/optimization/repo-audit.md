# 저장소 조사

- 저장소: `C:/Users/xofkd/OneDrive/바탕 화면/웹디자인II/WebcamArcade`; main, 시작 SHA `dbc0e365a298249622d72ba75cb5ebfd76bacfff`. 기존 추적 파일 변경 없음. `BGM/`과 `artifacts/` 아래 다수 미추적 파일은 사용자 기존 자료로 보존. 이번 산출물은 `docs/optimization/`과 `artifacts/optimization-*`에 한정한다.
- 사용자 확인 기준: `6845125c004fc9ac28a52f9ca6be8f3becc93cbe`까지 양호. 별도 worktree `artifacts/optimization-good`에서 해당 lockfile로 설치·배포용 빌드 성공. `artifacts/optimization-baseline`의 002cd08은 사용자 답변 전 예비 후보로 준비한 별도 worktree이며 확정 기준이 아니다.
- 기준 버전은 쏴!, 원 그리기, 참참참 세 게임. 현재는 가위바위보, 빨리 피해!를 포함해 5게임이며 포즈 따라해는 미구현. 새 게임 둘은 이전 기준 없음. 원 그리기에는 핀치, 자동 닫힘, 주먹 완료 등 의도된 게임 변경이 있어 동일 행동·점수로 직접 비교할 수 없다.
- React 19.3.0 / TypeScript 7.0.2 / Vite 8.3.0 / MediaPipe Tasks Vision 1.0.1 / npm lockfile / Node 24.15.0 / npm 11.12.1. CI는 Node 24, `npm ci`, `npm run build`, GitHub Pages.
- `CameraProvider.tsx`: 공유 카메라, 640×480·30fps 이상값 요청, 실제 값은 장치별 설정 확인 필요. 동영상 프레임 timestamp 중복 제외, busy 플래그로 단일 in-flight, worker 전환 및 cleanup. 게임별 `hand.worker.ts`, `face.worker.ts`, `body.worker.ts`: VIDEO `detectForVideo` 동기 호출, CPU delegate; 모델 옵션 0.6. 홈 PC는 `home.worker.ts`가 별도 손(최대 2)·얼굴 Worker의 같은 프레임 결과를 결합하며 이미지 복제; 손 인식/얼굴 blendshape 활성화. 게임 페이지는 42ms, PC 홈은 84ms 최소 간격. 모바일 compact touch 홈은 결합 추적 미사용.
- 모델은 `public/vision/` 로컬 파일, WASM은 설치된 npm 패키지에서 빌드 전 로컬 복사. 손 SHA256 `FBC2A30080C3C557093B5DDFC334698132EB341044CCEE322CCF8BCF3607CDE1`, 얼굴 `64184E229B263107BC2B804C6625DB1341FF2BB731874B0BCC2FE6544E0BC9FF`, 포즈 `59929E1D1EE95287735DDD833B19CF4AC46D29BC7AFDDBBF6753C459690D574A`. 기준 SHA와 현재 손·얼굴 모델 바이너리는 Git diff상 동일.
- `React.StrictMode` 사용; 개발 환경의 effect 재실행 가능성은 배포 결과와 별도 취급. 프로덕션 `base`는 `/WebcamArcade/`. `GestureInterpreter`, face/body 및 각 게임의 rules가 판정·점수 의미 소유; React Context가 결과 전달, 각 게임 UI가 렌더, `src/audio/`가 사운드 소유.
- 보존 계약: 각 게임 임계값·좌표/미러링·게임 흐름·음악·접근성·권한·카메라 수명주기를 임의 변경하지 않는다. 현재 시험 변경은 측정 스크립트/보고서만 포함한다.
- 테스트: 동시 의존성 설치 중 관련 36개 중 32 PASS/4 FAIL; 4개를 설치 완료 후 workers=1로 재실행해 4 PASS. 첫 실패 로그 `artifacts/optimization-regression.log`, 재실행 `artifacts/optimization-retry.log`; 이는 원인 확정이 아니다.
