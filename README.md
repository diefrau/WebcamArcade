# WEBCAM ARCADE

시안 기반 React + TypeScript 웹캠 미니게임입니다. 홈 → 게임 선택 → 마우스 또는 손으로 ‘쏴!’ → 결과 → 다시 플레이 흐름을 제공합니다.

## 실행

```sh
npm install
npm run dev
```

터미널에 표시된 로컬 주소를 브라우저에서 엽니다.

```sh
npm run build
npm run preview
```

## 구현 범위

- `/`: 홈, 3개 게임 소개, 최고 기록, 오늘 플레이 횟수
- `/games`: 실제 카테고리 필터, 추천 게임, 준비 상태, 준비 중 게임을 포함한 6칸 구성
- `/play/shoot`: 30초 마우스/손 조준 게임, 5개 라이프, 콤보, 일시정지
- `/result/shoot`: 실제 점수·최대 콤보·정확도·최고 기록·결과에 따른 배지
- 한국어·영어 전환, 합성 효과음 켜기/끄기, 애니메이션 줄이기
- 브라우저 localStorage에 기록·설정 저장

카메라는 사용자가 ‘카메라 연결’ 또는 ‘손으로 플레이’를 누를 때만 권한을 요청합니다. 영상은 기기 내 Web Worker에서 처리하며 저장·업로드하지 않습니다. 화면 이동 중에는 연결을 유지하고, 카메라 끄기 버튼으로 모든 트랙을 종료합니다. 권한 거부·장치 없음·장치 사용 중·모델 로딩 실패 시 안내와 재시도를 제공합니다.

‘참!참!참!’, ‘원 그리기’ 및 하단의 미래 게임 3종은 준비 중입니다. 랜덤 시작은 현재 플레이 가능한 유일한 게임인 ‘쏴!’를 엽니다. 랭킹·도전과제·이벤트 메뉴는 비활성화했습니다. 결과의 미션은 이번 게임 결과에 따른 로컬 체크리스트입니다.

## 손으로 플레이

1. ‘쏴!’에서 ‘손으로 플레이’를 선택하고 카메라 권한을 허용합니다.
2. 모델 준비 후 손바닥을 카메라에 보여줍니다. ‘손 인식 완료’를 확인하고 시작합니다.
3. 손을 이동해 조준하고 엄지와 검지를 붙였다 떼면 한 발씩 발사됩니다.
4. 손이 0.8초 이상 보이지 않으면 게임이 일시정지합니다. 손을 다시 보여주거나 ‘마우스로 계속’을 선택합니다.

손목과 손가락 밑마디 5개 지점의 최근 5프레임 평균으로 조준합니다. 영상은 거울처럼 표시되며 조준 좌표도 좌우 반전합니다. 핀치는 손바닥 너비에 대한 엄지·검지 거리 비율로 판별하고, 열기/닫기 임계값을 분리해 떨림에 따른 연속 발사를 방지합니다. 영상 중앙 76%를 전체 조준 범위에 대응시켜 모서리에 접근하기 쉽게 했습니다. 모델 초기화와 추론은 Worker에서 실행하며 최대 약 24fps, 한 번에 한 프레임씩 처리합니다.

카메라는 localhost 또는 HTTPS에서 동작합니다. 실제 카메라·손을 이용한 조작감은 조명, 촬영 거리, 장치 성능에 따라 확인과 조정이 필요합니다.

## 게임 규칙

마우스로 과녁 캐릭터를 클릭하면 명중합니다. 연속 명중 시 100점부터 20점씩 추가하며, 한 발당 최대 300점입니다. 빗나가면 콤보가 초기화되고 라이프를 1개 잃습니다. 30초가 지나거나 5번 빗나가면 종료합니다. 일시정지 버튼 또는 Escape로 멈추고 재개할 수 있습니다. 탭이 숨겨지면 자동으로 일시정지합니다. 정확도는 명중 수 / 전체 발사 수입니다.

## 주요 파일

- `src/main.tsx`: 라우트, 공통 UI 컴포넌트, 게임 및 기록 관리
- `src/styles.css`: 디자인 토큰, 페이지 레이아웃, 반응형 및 접근성 스타일
- `src/comic.css`: 제공 시안에 맞춘 큰 제목·스티커·화면 비율·6칸 카드 배치
- `src/components/ComicArt.tsx`: 만화 장식 및 숲/목재 사격장 SVG
- `src/components/WebcamFrame.tsx`: 실제 영상, 손 랜드마크, 연결/오류 상태
- `src/vision/CameraProvider.tsx`: 카메라 생명주기, 로컬 Worker 통신 및 복구
- `src/vision/hand.worker.ts`, `src/vision/gestures.ts`: 추론, 조준 안정화, 핀치 발사
- `src/locales/ko.json`, `src/locales/en.json`: 번역 리소스
- `tests/arcade.spec.ts`: 실제 브라우저에서 흐름·기록·언어·일시정지 검증
- `tests/camera.spec.ts`: 가상 카메라 + 실제 모델 초기화, 권한/모델 오류, 연결 유지/종료, 합성 랜드마크로 조준·발사·손 상실 검증

공통 컴포넌트: Button, Sticker, Header, Logo, GameCard, Character, GameArt, WebcamFrame, Mascot, RecordsBar, SettingsDialog. 랜딩과 게임 카드에는 제공된 캐릭터 에셋을 사용하고, 플레이 목표물과 사격장 등은 SVG입니다. 글꼴은 Google Fonts에서 불러오므로 최초 로딩에는 네트워크가 필요합니다.

## 캐릭터 적용

`char/`의 PNG 원본은 보존합니다. `node scripts/prepare-characters.mjs`로 해상도·투명도·색상을 유지하는 무손실 WebP를 생성합니다. 전체 용량은 9.41MB에서 5.23MB로 약 44% 감소했습니다. 배포용 이미지는 `src/assets/characters/images/`, 중앙 매핑은 `src/assets/characters/index.ts`, 공통 컴포넌트와 크기/배치 스타일은 `src/components/Character.tsx`, `src/components/character.css`입니다.

| 위치                           | 원본            |
| ------------------------------ | --------------- |
| 홈 메인, 게임 선택 보조 캐릭터 | LandingAki.png  |
| 참!참!참!                      | LookOut.png     |
| 원 그리기                      | FullCircle.png  |
| 쏴!, 오늘의 추천               | PopShot.png     |
| 가위바위보                     | RockPaper.png   |
| 빨리 피해!                     | DodgeIt.png     |
| 포즈 따라해!                   | StrikeAPose.png |

홈의 3개 카드와 게임 선택 6개 카드 모두 같은 registry를 참조합니다. 이미지의 비율을 유지하고 텍스트·배지·CTA를 별도 HTML로 둡니다. 메인 캐릭터만 우선 로딩하며 나머지는 지연 로딩합니다. 현재 교체 범위는 랜딩·게임 카드이며, 카메라 상태/플레이/결과 캐릭터는 후속 적용 대상입니다.

시각 검토: 새 에셋은 굵은 외곽선·선명한 색상과 어울립니다. 다만 메인 Aki와 분홍 카드 토끼의 귀 색·얼굴·렌더링은 서로 다르고, 원 그리기/쏴!/포즈의 캐릭터 역시 하나의 Blue Dog로 통일되어 있지 않습니다. 파일명을 기준으로 배치했으며 원본을 임의로 재색칠하거나 좌우 반전하지 않았습니다. 가로형 액션 일러스트는 작은 카드에서 세부 묘사가 작게 보이므로, 추후 동일한 디자인의 캐릭터 단독 포즈가 있으면 카드 간 시각적 크기를 더 잘 맞출 수 있습니다.

## 검증

```sh
npx playwright install chromium
npm test
```

테스트 실행 시 `artifacts/`에 화면별 스크린샷이 생성됩니다. 로컬에서만 동작하며 배포하지 않았습니다. 정적 호스팅 배포 시 SPA 경로를 `index.html`로 연결하는 rewrite 설정이 필요합니다.

## MediaPipe 자산

구현은 [Google Hand Landmarker 웹 가이드](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js)를 따릅니다. `@mediapipe/tasks-vision`은 Apache-2.0 라이선스이며, npm 설치/빌드 시 `scripts/prepare-vision.mjs`가 해당 버전의 WASM 런타임을 `public/vision/wasm/`에 복사합니다. 이 폴더는 자동 생성되므로 Git에서 제외했습니다.

`public/vision/hand_landmarker.task`는 [Google의 Hand Landmarker float16 모델 v1](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)입니다. 모델과 WASM은 사이트에 포함되므로 플레이 중 외부 CDN에서 받지 않습니다. 빌드 시 `public/vision/` 파일도 함께 배포해야 합니다. 자동 테스트에는 사용자의 실제 카메라를 사용하지 않습니다.
