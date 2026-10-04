import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  createContext,
  useContext,
} from "react";
import { useTranslation } from "react-i18next";
import { Character } from "./Character";
import { useReducedMotion } from "./useReducedMotion";
import "./arcade-loading.css";

const ArcadeReady = createContext(false);
export const useArcadeReady = () => useContext(ArcadeReady);
const MINIMUM_LOADING_MS = 2000;
const LOADING_FADE_MS = 600;

/** Wait for the rendered route, including below-the-fold artwork, before revealing it. */
export function ArcadeLoading({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const english = i18n.language.startsWith("en");
  const content = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<"loading" | "exiting" | "ready">(
    "loading",
  );
  const ready = phase === "ready";
  const reducedMotion = useReducedMotion();
  const skipAssets = useRef(() => {});
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 1 });
  const [presentationProgress, setPresentationProgress] = useState(0);
  const [problem, setProblem] = useState(false);

  useEffect(() => {
    if (ready) {
      content.current?.focus({ preventScroll: true });
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [ready]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const fade = window.setTimeout(
      () => setPhase("ready"),
      reducedMotion ? 0 : LOADING_FADE_MS,
    );
    return () => window.clearTimeout(fade);
  }, [phase, reducedMotion]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let departed = false;
    const exit = () => {
      if (signal.aborted || departed) return;
      departed = true;
      window.clearTimeout(timeout);
      setPhase("exiting");
    };
    setPhase("loading");
    setPresentationProgress(0);
    setProblem(false);
    screen.current?.focus({ preventScroll: true });
    const started = performance.now();
    const presentationTimer = window.setInterval(() => {
      const elapsed = Math.min(
        1,
        (performance.now() - started) / MINIMUM_LOADING_MS,
      );
      setPresentationProgress(elapsed);
      if (elapsed === 1) window.clearInterval(presentationTimer);
    }, 50);
    let minimumTimer = 0;
    const minimumDuration = new Promise<void>((resolve) => {
      minimumTimer = window.setTimeout(() => {
        setPresentationProgress(1);
        resolve();
      }, MINIMUM_LOADING_MS);
    });
    skipAssets.current = () => {
      void minimumDuration.then(exit);
    };
    const images = Array.from(content.current!.querySelectorAll("img"));
    const runners = Array.from(screen.current!.querySelectorAll("img"));
    const allImages = [...images, ...runners];
    setProgress({ done: 0, total: allImages.length + 1 });
    // This only exposes recovery controls. It never marks unfinished assets as ready.
    const timeout = window.setTimeout(() => setProblem(true), 12000);
    const finished = () => {
      if (!signal.aborted && !departed)
        setProgress((value) => ({ ...value, done: value.done + 1 }));
    };
    const tasks = allImages.map(async (img) => {
      img.loading = "eager";
      if (attempt && img.complete && !img.naturalWidth) img.src = img.src;
      if (!img.complete) {
        await new Promise<void>((resolve, reject) => {
          const clean = () => {
            img.removeEventListener("load", loaded);
            img.removeEventListener("error", failed);
            signal.removeEventListener("abort", aborted);
          };
          const loaded = () => {
            clean();
            resolve();
          };
          const failed = () => {
            clean();
            reject(new Error("Image unavailable"));
          };
          const aborted = () => {
            clean();
            reject(new Error("Cancelled"));
          };
          img.addEventListener("load", loaded);
          img.addEventListener("error", failed);
          signal.addEventListener("abort", aborted, { once: true });
        });
      }
      if (!img.naturalWidth) throw new Error("Image unavailable");
      await img.decode();
      finished();
    });
    tasks.push(
      (async () => {
        // Explicit loads cover fonts used by later game states as well as this screen.
        await Promise.all(
          [
            '400 24px "Black Han Sans"',
            '400 24px "Bagel Fat One"',
            ...[400, 600, 700, 800, 900].map(
              (weight) => `${weight} 16px "Noto Sans KR"`,
            ),
          ].map((font) =>
            document.fonts.load(font, "WEBCAM ARCADE 준비 시작 점수 게임"),
          ),
        );
        await document.fonts.ready;
        finished();
      })(),
    );
    void Promise.all([...tasks, minimumDuration])
      .then(exit)
      .catch(() => {
        if (!signal.aborted && !departed) setProblem(true);
      });
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
      window.clearTimeout(minimumTimer);
      window.clearInterval(presentationTimer);
    };
  }, [attempt]);

  const assetsReady = progress.done === progress.total;
  const percent =
    phase === "exiting"
      ? 100
      : Math.min(
          99,
          Math.floor(
            Math.min(progress.done / progress.total, presentationProgress) *
              100,
          ),
        );
  return (
    <>
      <div
        ref={content}
        className="route-content"
        data-ready={ready}
        data-state={phase}
        inert={!ready}
        aria-busy={!ready}
        tabIndex={-1}
      >
        <ArcadeReady.Provider value={ready}>{children}</ArcadeReady.Provider>
      </div>
      {!ready && (
        <section
          ref={screen}
          className="arcade-loading"
          data-state={phase}
          inert={phase === "exiting"}
          aria-hidden={phase === "exiting"}
          tabIndex={-1}
          aria-label={english ? "Loading arcade" : "아케이드 로딩"}
        >
          <div className="loading-orbit loading-orbit-one" aria-hidden="true">
            ★
          </div>
          <div className="loading-orbit loading-orbit-two" aria-hidden="true">
            ✦
          </div>
          <div className="loading-card">
            <span className="loading-sticker">GET READY!</span>
            <p className="loading-brand">
              WEBCAM <span>ARCADE</span>
            </p>
            <h1>
              {english ? (
                <>
                  HERE WE <em>GO!</em>
                </>
              ) : (
                <>
                  신나게 <em>달려!</em>
                </>
              )}
            </h1>
            <p className="loading-copy">
              {english
                ? "Our friends are getting your playground ready."
                : "동물 친구들이 신나게 놀 준비를 하고 있어요."}
            </p>
            <div
              className="loading-race"
              style={{ "--loading-progress": `${percent}%` } as CSSProperties}
            >
              <span className="loading-start" aria-hidden="true">
                START
              </span>
              <span className="loading-finish" aria-hidden="true">
                ⚑
              </span>
              <div className="loading-pack" aria-hidden="true">
                <Character
                  asset="dodge"
                  priority
                  className="loading-runner runner-one"
                />
                <Character
                  asset="cham"
                  priority
                  className="loading-runner runner-two"
                />
                <Character
                  asset="landing"
                  priority
                  className="loading-runner runner-three"
                />
                <span className="loading-dust">✦ · ·</span>
              </div>
              <div
                className="loading-track"
                role="progressbar"
                aria-label={english ? "Assets ready" : "화면 준비 진행률"}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div className="loading-fill" />
              </div>
            </div>
            <div className="loading-status">
              <span role="status">
                {problem
                  ? english
                    ? "Taking a little longer…"
                    : "준비가 조금 늦어지고 있어요…"
                  : phase === "exiting"
                    ? english
                      ? "LET'S PLAY!"
                      : "자, 놀아볼까!"
                    : assetsReady
                      ? english
                        ? "Warming up with our friends…"
                        : "친구들과 준비운동 중…"
                      : english
                        ? "Loading fonts & artwork…"
                        : "폰트와 그림을 불러오는 중…"}
              </span>
              <strong>{percent}%</strong>
            </div>
            {problem ? (
              <div className="loading-recovery">
                <p>
                  {english
                    ? "Some assets are delayed or unavailable. Retry, or continue with what is ready."
                    : "일부 자료가 늦거나 불러오지 못했어요. 다시 시도하거나 준비된 화면으로 시작할 수 있어요."}
                </p>
                <button onClick={() => setAttempt((value) => value + 1)}>
                  {english ? "Try again" : "다시 불러오기"}
                </button>
                <button onClick={() => skipAssets.current()}>
                  {english ? "Continue anyway" : "준비된 화면으로 시작"}
                </button>
              </div>
            ) : (
              <p className="loading-tip">
                {english
                  ? "A little movement. A lot of fun!"
                  : "작은 움직임, 커다란 즐거움!"}{" "}
                <span aria-hidden="true">☺</span>
              </p>
            )}
          </div>
        </section>
      )}
    </>
  );
}
