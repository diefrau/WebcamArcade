# 익명화된 원시 자료

`synthetic-desktop.json`은 가짜 영상 장치의 프레임 횟수, Worker 왕복 시간 및 RAF 간격을 모은 탐색 데이터다. 영상과 랜드마크·실제 카메라 식별자·개인 데이터는 저장하지 않는다. 단일 실행이며 계측 오버헤드가 미측정이므로 제품 개선의 증거로 사용하지 않는다. 각 run에는 버전, 게임, 시작 시각, 워밍업·측정 시간 및 raw 표본이 있다. 로그는 `artifacts/optimization-synthetic.log`.
- 합성 랜드마크 원시 결과: `landmark-synthetic.json`. 생성 스크립트의 좌표이며 실제 인체 데이터는 없다.
- RAF 전용 대조군: `synthetic-overhead-control.json`. 같은 세 게임의 단일 실행이며 RAF 계측 자체는 유지한다.

- Windows 실카메라 탐색 데이터: `artifacts/optimization-live/` (저장소 루트 기준). 프레임 처리 시각, RAF 간격과 해상도/FPS만 포함하며 영상·랜드마크·장치 식별자는 저장하지 않는다. 각 버전/게임 단 1회다.
- 원 점수 합성 입력: `circle-score-fixtures.json`.
