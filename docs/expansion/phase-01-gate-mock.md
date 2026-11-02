# 신규 미니게임 확장 1차: 공통 기반 + 뚫어! Mock

## 범위

사용자 첨부 문서의 1차 지시(35~36절)에 따라 모든 게임을 동시에 구현하지 않았다. `/play/gate`와 `/result/gate`를 추가했다. 실제 Pose/Segmentation 추론과 온라인 기록·도전과제 등록은 이번 체험판에 연결하지 않는다. 기존 Pose 따라해! 준비 카드가 뚫어! 체험판으로 연결된다. 기존 게임의 판정과 모델·인식 임계값은 유지한다.

## 현재 Vision 구조 및 재사용

`CameraProvider.tsx`가 getUserMedia 스트림, 카메라 권한·오류·취소, 단일 in-flight 프레임, Worker 생성/정리 및 오래된 추적 결과 무효화를 담당한다. 손·얼굴·몸 Worker가 로컬 MediaPipe 자산을 사용한다. hand.worker는 일반 게임에서 한 손을, 기존 홈 비밀 도전과제 경로는 두 손+얼굴을 처리한다. circle/cham/rps/shoot/dodge는 기존 Context 값을 사용하고 게임별 입력을 해석한다.

새 게임에서 MediaPipe 호출이나 Worker를 만들지 않는다. 기존 Worker는 같은 tracking 종류를 사용하는 게임 간 유지되고, detector 종류가 달라지면 기존 방식대로 종료·생성된다. 모든 모델 인스턴스를 상주시키는 캐시는 추가하지 않았다. 새로운 profile은 어떤 detector가 필요한지 명시하며 뚫어! Mock과 결과 화면에서는 detector를 중단한다. 기존 홈 비밀 도전과제의 두 손·얼굴 인식은 보존했다. Camera 스트림 수명은 기존 Provider가 관리한다.

## 공통 계약

- `vision/visionTypes.ts`: timestamp, 감지 여부, primary hand/index 및 최근 궤적, face 좌표, pose landmarks, motion, segmentation availability. 얻지 못한 속도·마스크·손잡이를 만들어 채우지 않는다.
- `vision/visionSnapshot.ts`: 기존 Context 데이터를 새 계약으로 옮기는 순수 변환 함수. 원본 프레임 시각/궤적은 호출자가 전달하며 별도 detector를 실행하지 않는다. 현재 홈의 두 손 데이터와 일반 Context의 단일 손은 서로 다르므로 임의로 left/right를 부여하지 않는다.
- `input/GameInputAdapter.ts`: VisionState에서 aim/fire/indexPath/bodyCenter/poseVector/motionAmount만 변환한다. 원시 카메라 좌표는 화면의 mirrored 좌표로 변환하며 Mock은 화면 좌표를 사용한다. 기존 circle 등의 pinch hysteresis는 건드리지 않는다. adapter의 fire는 현재 pinch 상태 계약이며 기존 발사 이벤트·shotSequence를 대체하지 않는다.
- `input/mockPose.ts`: 같은 adapter를 사용하는 가상 상체 입력과 5개 테스트 자세. 실제 입력으로 전환할 때 게임 규칙을 다시 만들 필요가 없다.
- `vision/visionProfiles.ts`: 현재와 계획된 게임의 활성 detector를 정의한다. gate는 현재 null, segmentation은 모두 false다. catch의 hands=2는 향후 계획이며 아직 Worker에 적용하지 않는다.

## 재사용 도구

`vision/shared/trajectory.ts` (최근 점·길이·직선성·속력), `velocity.ts` (누락·긴 간격 무효화), `smoothing.ts` (시간 기반 EMA), `poseNormalization.ts` (어깨 중심·크기·기울기 정규화와 팔 관절 방향 비교), `collision.ts` (point/circle/line/capsule/AABB), `gestureHold.ts`, `visionCoordinate.ts`를 추가했다. 기존 정상 게임들을 일괄 치환하지 않았다. 이후 꿰어!/쳐!/멈춰! 단계에서 검증 후 사용한다.

## 뚫어! 흐름

선택 카드 → 공통 `PreGameSequence` → READY 3초 → 벽 접근 3.5초 → 교차 순간 한 번 판정 → 피드백 1초 → 다음 벽. 총 5회 후 결과와 다시 하기를 제공한다. 목표는 양팔 위/옆/왼팔 위/오른팔 위/대각선이다. 슬라이더·프리셋·A/Z 및 K/M·1~5 입력을 지원한다. Esc·포커스 이탈·숨김·설정창에서 일시정지한다. 결과 저장이 막히면 메모리의 결과로 계속 진행한다.

점수는 95% 이상 300점, 80% 이상 150점, 60% 이상 CLOSE/0점, 그 미만 FAIL/0점이다. 실제 사람 영상으로 검증한 난이도 기준이 아니라 Mock 단계의 초기값이다. 기기별 프레임 주기와 무관하게 벽별 판정을 한 번만 수행한다. SVG mask의 벽 구멍과 Mock 실루엣은 UI 연출이며 segmentation이 아니다. `arcade.gate.prototype`에만 최대 1500점의 체험 기록을 보존하고 온라인 RPC·공식 랭킹·도전과제에는 제출하지 않는다.

## 변경 파일

기반: visionTypes/visionProfiles/visionSnapshot, vision/shared 7개, input/GameInputAdapter/mockPose.

게임: games/gateRules, GateGamePage, gate.css, components/PreGameSequence.

연결: main.tsx(카드·라우트), CameraProvider.tsx(profile), audio/music.ts(Bounce), locales/ko.json 및 en.json, scripts/prepare-pages.mjs(Pages 두 경로).

검증: tests/gate.spec.ts. 결과와 한계는 아래에 기록한다.

## 다음 단계

1. 실제 Pose 연결: gate profile의 detector를 body로 바꾸고 기존 Provider의 body landmarks를 visionSnapshot → adaptGameInput으로 전달한다. 어깨·팔꿈치·손목의 유효성 및 프레임 시각을 확인하고 2~3초 이내의 상체 준비 안내, 추적 유실·복구 및 입력 smoothing을 검증한다. Mock을 유지해 같은 규칙을 비교한다.
2. Segmentation 연결: 기존 pose worker/공통 profile에서만 opt-in 출력하고 mask 수명·반납을 명시한다. gate 렌더의 SVG Mock 실루엣을 영상 합성 레이어로 바꾼다. 느리거나 실패하면 사각 영상+pose overlay로 전환한다. 점수 판정은 계속 poseVector를 사용한다.
3. 이후 문서 순서: 꿰어! → 멈춰! → 받아! → 탄막 피해! 개편 → 쳐! → 기기별 최적화/QA.

## 이번 실행의 검증 결과

- TypeScript/Vite 프로덕션 빌드 통과. Pages 엔트리 15개 생성(신규 gate 2개 포함). Vite의 기존 500kB 청크 크기 경고는 남아 있다.
- Gate/Camera/vision-polish/cham/circle-auto-close/rps: 33개 통과. 실제 로컬 모델의 로딩 테스트와 모의 랜드마크 입력, 버튼 입력을 포함한다. 실제 사람의 Pose 정확도나 모바일 GPU 성능을 검증한 결과는 아니다.
- 모바일 390×844와 데스크톱 1440×1000 캡처를 확인했고, 모바일 시작 버튼이 모달에서 잘리지 않도록 수정 후 해당 테스트를 재실행해 통과했다.
- Audio/music/achievements-expanded: 15개 통과. 최초 실행에서는 이전 모드 구현으로 활성 도전과제가 60→64가 됐지만 테스트 기대값이 60에 머물러 한 개 실패했다. 활성화된 네 모드 도전과제를 명시해 기대값을 갱신한 뒤 재실행했다. 뚫어! 도전과제를 새로 활성화한 것은 아니다.
- 캡처: artifacts/gate-ready-desktop.png, gate-play-desktop.png, gate-ready-mobile.png. 기존 회귀 테스트가 생성한 추적 중 참참참 캡처는 이번 작업 전 상태로 복구했다.
- 커밋·푸시·웹 배포는 수행하지 않았다. 이전 무한/술래 모드 SQL의 실서버 적용 미완료 상태도 이번 단계에서 변경하지 않았다.
