import { GateGamePage, GateResultPage } from "./games/GateGamePage";
import { CommunityPage } from "./community/CommunityPage";
import { recordPlay } from "./community/client";
import { localBest } from "./community/store";
import { PlayerSession, PlayerWelcome } from "./community/PlayerWelcome";
import { HomeEasterEggs } from "./community/HomeEasterEggs";
import { AchievementToasts } from "./community/AchievementToasts";
import { InputCoach } from "./components/InputCoach";
import { InputBadge } from "./components/InputBadge";
import {
  InputEnvironment,
  useInputEnvironment,
} from "./components/InputEnvironment";
import "./touch.css";
import { useGameInput } from "./vision/useGameInput";
import { ChamGamePage, ChamResultPage, readCham } from "./games/ChamGamePage";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useLocation,
} from "react-router-dom";
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  CircleHelp,
  Crown,
  Dice5,
  Gamepad2,
  Hand,
  Heart,
  Home,
  Languages,
  Maximize2,
  MousePointer2,
  Pause,
  Play,
  Save,
  Settings,
  Smile,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  Users,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import ko from "./locales/ko.json";
import en from "./locales/en.json";
import "./styles.css";
import "./comic.css";
import { ComicDecor, RangeScenery } from "./components/ComicArt";
import { Character } from "./components/Character";
import { gameCharacterMap } from "./assets/characters";
import { shootTargets } from "./assets/characters/shootTargets";
import { CameraProvider, useCamera } from "./vision/CameraProvider";
import { WebcamFrame } from "./components/WebcamFrame";
import { HandMenuCursor } from "./components/HandMenuCursor";
import {
  CircleGamePage,
  CircleResultPage,
  type CircleResult,
} from "./games/CircleGamePage";

import "./game-theme.css";
import { RouteContent } from "./components/RouteContent";
import "./motion.css";
import "./responsive.css";
import { RpsGamePage, RpsResultPage, readRps } from "./games/RpsGamePage";
import { DodgeGamePage, DodgeResultPage, readDodge } from "./games/DodgeGamePage";
import { GameResult } from "./components/GameResult";
import { GameTimer } from "./components/GameTimer";
import {
  SoundManager,
  type SoundCue,
  type PlayOptions,
} from "./audio/soundManager";
import { SoundFeedback } from "./audio/SoundFeedback";
import { musicForPath } from "./audio/music";
import { IntroSequence } from "./components/intro/IntroSequence";
import {
  INTRO_SEEN_KEY,
  titleVisible,
  type IntroPhase,
} from "./components/intro/timeline";

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
void i18n.use(initReactI18next).init({
  resources: { ko: { translation: ko }, en: { translation: en } },
  lng: read("arcade.language", "ko"),
  fallbackLng: "ko",
  interpolation: { escapeValue: false },
});
type GameId = "cham" | "circle" | "shoot" | "rps" | "dodge";
type Result = {
  score: number;
  combo: number;
  accuracy: number;
  hits: number;
  shots: number;
  newBest: boolean;
  evidence?: import("./achievements/types").GameResultDetails;
};
type Records = {
  best: number;
  plays: number;
  day: string;
  daily: number;
  last: Result | null;
};
const emptyRecords: Records = {
  best: 0,
  plays: 0,
  day: "",
  daily: 0,
  last: null,
};
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const Context = createContext({
  sound: true,
  tone: (_type?: SoundCue, _options?: PlayOptions) => {},
  records: emptyRecords,
});
const games: { id: GameId; color: string; duration: number; badge: string }[] =
  [
    { id: "cham", color: "pink", duration: 30, badge: "popular" },
    { id: "circle", color: "cyan", duration: 20, badge: "new" },
    { id: "shoot", color: "lime", duration: 30, badge: "easy" },
    { id: "rps", color: "purple", duration: 30, badge: "new" },
    { id: "dodge", color: "orange", duration: 30, badge: "new" },
  ];

function Button({
  children,
  color = "pink",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  return (
    <button
      {...props}
      className={`arcade-button ${color} ${className}`}
      onClick={(e) => {
        props.onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
function Sticker({
  children,
  color = "yellow",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return <span className={`sticker ${color}`}>{children}</span>;
}
function Logo() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="logo" aria-label="WEBCAM ARCADE">
      <span className="logo-webcam">WEBCAM</span>
      <span className="logo-arcade">
        {"ARCADE".split("").map((x, i) => (
          <b key={i}>{x}</b>
        ))}
      </span>
      <small>{t("tagline")}</small>
      <Star className="logo-star" fill="currentColor" />
    </Link>
  );
}
function Header({
  onSettings,
  onSound,
}: {
  onSettings: () => void;
  onSound: () => void;
}) {
  const { t } = useTranslation();
  const { sound } = useContext(Context);
  const camera = useCamera();
  return (
    <header className="header">
      <Logo />
      <nav className="top-nav">
        <NavLink to="/" end>
          <Home />
          {t("home")}
        </NavLink>
        <NavLink to="/games">
          <Gamepad2 />
          {t("games")}
        </NavLink>
        <NavLink to="/ranking">
          <Crown />
          {t("ranking")}
        </NavLink>
        <NavLink to="/achievements">
          <Star />
          {t("missions")}
        </NavLink>
        {[["events", Smile]].map(([key, Icon]) => (
          <button key={key as string} disabled title={t("soon")}>
            <Icon />
            {t(key as string)}
          </button>
        ))}
      </nav>
      <div className="utilities">
        <button onClick={onSettings} aria-label={t("settings")}>
          <Settings />
          <span>{t("settings")}</span>
        </button>
        <button
          className="lime"
          data-sound-toggle
          onClick={onSound}
          aria-label={sound ? t("soundOn") : t("soundOff")}
        >
          {sound ? <Volume2 /> : <VolumeX />}
          <span>{sound ? t("soundOn") : t("soundOff")}</span>
        </button>
        <button
          className="camera-utility cyan"
          onClick={() =>
            camera.stream ? camera.disconnect() : void camera.connect()
          }
          aria-label={t(camera.stream ? "cameraDisconnect" : "cameraConnect")}
          disabled={camera.state === "requesting"}
        >
          <Camera />
          <small>
            {t(camera.stream ? "cameraConnected" : "cameraConnect")}
          </small>
        </button>
      </div>
    </header>
  );
}
function GameCard({
  id,
  color,
  duration,
  badge,
}: Omit<(typeof games)[number], "id"> & { id: GameId | "gate" }) {
  const { t } = useTranslation();
  const title = t(id === "gate" ? "gate.title" : id);
  return (
    <Link
      to={`/play/${id}`}
      className={`game-card ${color} available`}
      aria-label={`${title} ${t("playNow")}`}
    >
      <Sticker
        color={
          id === "cham"
            ? "orange"
            : id === "circle" || id === "gate"
              ? "yellow"
              : "cyan"
        }
      >
        {id === "cham" && <Crown size={19} />} {t(badge)}
      </Sticker>
      <div className="card-copy">
        <h3>{title}</h3>
        <p>{t(id === "gate" ? "gate.instruction" : `${id}Desc`)}</p>
      </div>
      <Character asset={gameCharacterMap[id]} className="card-character" />
      <div className="card-bottom">
        <span>
          <UserRound size={17} />
          {t("onePlayer")}
        </span>
        <span>
          ◷{" "}
          {id === "dodge"
            ? t("dodgeSurvivalMode")
            : t("seconds", { count: duration })}
        </span>
        {id === "gate" ? <InputBadge kind="body" /> : <InputBadge game={id} />}
        <span className="card-arrow" aria-hidden="true">
          <ArrowRight />
        </span>
      </div>
    </Link>
  );
}
function RecordsBar() {
  const { t } = useTranslation();
  const { records } = useContext(Context);
  const circleBest = read<number>("arcade.circle.best", 0);
  const circlePlays = read<number>("arcade.circle.plays", 0);
  const cham = readCham();
  const rps = readRps();
  const dodge = readDodge();
  const dodgeBest = localBest("dodge", "endless");
  return (
    <section className="records-bar">
      <div className="records-title">
        <Trophy />
        <div>
          <h3>{t("bestRecords")}</h3>
          <small>
            {records.plays + circlePlays + cham.plays + rps.plays + dodge.plays
              ? t("plays", {
                  count:
                    records.plays +
                    circlePlays +
                    cham.plays +
                    rps.plays +
                    dodge.plays,
                })
              : t("noRecords")}
          </small>
        </div>
      </div>
      <div className="record-tile pink">
        <Hand />
        <div>
          <span>{t("cham")}</span>
          <b>
            {cham.plays ? cham.best.toLocaleString() : "—"}
            <small>{cham.plays ? t("points") : ""}</small>
          </b>
        </div>
      </div>
      <div className="record-tile cyan">
        <Target />
        <div>
          <span>{t("circle")}</span>
          <b>
            {circlePlays ? circleBest.toLocaleString() : "—"}
            <small>{circlePlays ? t("points") : ""}</small>
          </b>
        </div>
      </div>
      <div className="record-tile lime">
        <Target />
        <div>
          <span>{t("shoot")}</span>
          <b>
            {records.plays ? records.best.toLocaleString() : "—"}
            <small>{records.plays ? t("points") : ""}</small>
          </b>
        </div>
      </div>
      <div className="record-tile purple">
        <Hand />
        <div>
          <span>{t("rps")}</span>
          <b>
            {rps.plays ? rps.best.toLocaleString() : "—"}
            <small>{rps.plays ? t("points") : ""}</small>
          </b>
        </div>
      </div>
      <div className="record-tile orange">
        <Hand />
        <div>
          <span>{t("dodge")}</span>
          <b>
            {dodgeBest > 0 ? dodgeBest.toLocaleString() : "—"}
            <small>{dodgeBest > 0 ? t("points") : ""}</small>
          </b>
        </div>
      </div>
      <div className="daily-progress">
        <strong>{t("daily")}</strong>
        <div>
          <progress
            max="5"
            value={records.day === today() ? records.daily : 0}
          />
          <span>
            {t("dailyProgress", {
              count: Math.min(5, records.day === today() ? records.daily : 0),
            })}
          </span>
        </div>
      </div>
    </section>
  );
}
function HomePage({ introDone = true }: { introDone?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span /> {t("edition")}
          </span>
          <h1>
            <span className="yellow-text">{t("hero1")}</span>
            <br />
            <span className="pink-text">{t("hero2")}</span>{" "}
            <span className="cyan-text">{t("hero3")}</span>
          </h1>
          <Button className="hero-cta" onClick={() => navigate("/games")}>
            <Play fill="currentColor" />
            {t("start")}
            <ArrowRight />
          </Button>
          <span className="hero-doodle">✦ ✧ ✦</span>
          <span className="hero-spark">✧</span>
        </div>
        <WebcamFrame />
        <div className="hero-mascot">
          <p>{t("move")}</p>
          <Character
            asset="landing"
            size="hero"
            className="hero-character"
            priority
          />
          <Sticker color="pink">{t("playMore")}</Sticker>
          <span className="floating-star">✦</span>
        </div>
      </section>
      <section className="featured">
        <div className="section-heading">
          <Link to="/games" className="view-all-button">
            {t("viewAll")}
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="game-grid">
          {games.slice(0, 3).map((g) => (
            <GameCard key={g.id} {...g} />
          ))}
        </div>
      </section>
      <RecordsBar />
      {introDone && <PlayerWelcome />}
      {introDone && <HomeEasterEggs />}
    </>
  );
}
function GamesPage() {
  const { t } = useTranslation();
  const camera = useCamera();
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();
  return (
    <>
      <div className="page-title">
        <h1>
          <span className="yellow-text">{t("pick1")}</span>{" "}
          <span className="cyan-text">
            <span className="headline-pink">{t("pick2").slice(0, 1)}</span>
            {t("pick2").slice(1)}
          </span>
        </h1>
        <Sparkles size={44} />
      </div>
      <div className="selection-layout">
        <aside className="filter-panel panel">
          <h3>
            <Zap />
            {t("filterTitle")}
          </h3>
          {[
            ["all", Gamepad2],
            ["solo", UserRound],
            ["hand", Hand],
            ["face", Smile],
          ].map(([key, Icon]) => (
            <button
              className={filter === key ? "selected" : ""}
              key={key as string}
              onClick={() => setFilter(key as string)}
            >
              <Icon />
              {t(key as string)}
            </button>
          ))}
          <Character
            asset="landing"
            size="sm"
            className="selection-character"
          />
        </aside>
        <div className="selection-games">
          <div className="game-grid">
            {games
              .filter((g) =>
                filter === "face"
                  ? g.id === "cham"
                  : filter === "hand"
                    ? g.id !== "cham" && g.id !== "dodge"
                    : true,
              )
              .map((g) => (
                <GameCard key={g.id} {...g} />
              ))}
            {filter !== "face" && filter !== "hand" && (
              <GameCard
                id="gate"
                color="purple"
                duration={30}
                badge="gate.prototype"
              />
            )}
          </div>
        </div>
        <aside className="selection-side">
          <section className="panel recommendation">
            <h3>
              <Crown />
              {t("recommend")}
            </h3>
            <div className="recommend-art lime">
              <Character asset="shoot" className="recommend-character" />
              <h2>{t("shoot")}</h2>
            </div>
            <Button onClick={() => navigate("/play/shoot")}>
              <Play />
              {t("playNow")}
            </Button>
          </section>
          <section className="panel readiness">
            <h3>
              <Camera />
              {t("readyTitle")}
            </h3>
            <p>
              <MousePointer2 />
              {t("mouse")}
              <strong>
                <Check size={17} />
                {t("ready")}
              </strong>
            </p>
            <p>
              <Camera />
              {t("camera")}
              <small>
                {t(camera.state === "ready" ? "ready" : "cameraStandby")}
              </small>
            </p>
            <p>
              <Hand />
              {t("hand")}
              <small>
                {t(
                  camera.hand.detected
                    ? "handDetected"
                    : camera.vision === "loading"
                      ? "visionLoading"
                      : "showHand",
                )}
              </small>
            </p>
          </section>
        </aside>
      </div>
      <div className="selection-bottom">
        <RecordsBar />
        <Button
          color="yellow"
          onClick={() =>
            navigate(
              `/play/${games[Math.floor(Math.random() * games.length)].id}`,
            )
          }
        >
          <Dice5 />
          {t("random")}
        </Button>
      </div>
    </>
  );
}

type TargetData = { x: number; y: number; kind: 0 | 1 | 2; id: number };
type ShotFeedback = { kind: "hit"; targetId: number } | { kind: "miss" };
const initialTargets: TargetData[] = [
  { x: 23, y: 57, kind: 0, id: 1 },
  { x: 50, y: 40, kind: 1, id: 2 },
  { x: 77, y: 58, kind: 2, id: 3 },
];
function TargetCharacter({
  kind,
  hit,
}: {
  kind: TargetData["kind"];
  hit: boolean;
}) {
  const sprite = shootTargets[kind];
  return (
    <>
      <img src={sprite.idle} alt="" draggable={false} hidden={hit} />
      <img src={sprite.hit} alt="" draggable={false} hidden={!hit} />
    </>
  );
}
function PlayPage({ onFinish }: { onFinish: (r: Result) => void }) {
  const { compactTouch } = useInputEnvironment();
  const { t } = useTranslation();
  const { tone, records } = useContext(Context);
  const camera = useCamera();
  const [inputMode, setInputMode] = useGameInput();
  const [handPaused, setHandPaused] = useState(false);
  const consumedShot = useRef(camera.shotSequence);
  const canResume =
    inputMode === "mouse" ||
    (camera.hand.detected &&
      camera.state === "ready" &&
      camera.vision === "ready");
  const canResumeRef = useRef(canResume);
  canResumeRef.current = canResume;
  const [phase, setPhase] = useState<"ready" | "playing" | "paused">("ready");
  const previousPhase = useRef(phase);
  useEffect(() => {
    if (previousPhase.current === "playing" && phase === "paused")
      tone("pause");
    if (previousPhase.current === "paused" && phase === "playing")
      tone("resume");
    previousPhase.current = phase;
  }, [phase, tone]);
  const requestedMode = new URLSearchParams(useLocation().search).get("mode");
  const [wave, setWave] = useState(requestedMode === "wave");
  const [endless, setEndless] = useState(requestedMode === "endless");
  const shootMode = endless ? "endless" : wave ? "wave" : "standard";
  const [time, setTime] = useState(endless ? 0 : 30);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(5);
  const [targets, setTargets] = useState(initialTargets);
  const [feedback, setFeedback] = useState<ShotFeedback | null>(null);
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  const stats = useRef({
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    shots: 0,
    lives: 5,
  });
  const elapsed = useRef(0);
  const targetBirth = useRef(new Map<number, number>());
  const fastestHit = useRef(Infinity);
  const lastTime = useRef(0);
  const finished = useRef(false);
  const field = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const finishRef = useRef(() => {});
  const shotRef = useRef<(id?: number) => void>(() => {});
  useEffect(() => {
    if (inputMode === "hand" && camera.hand.detected) {
      setCursor({ x: camera.hand.x * 100, y: camera.hand.y * 100 });
    }
    if (consumedShot.current === camera.shotSequence) return;
    consumedShot.current = camera.shotSequence;
    if (
      inputMode !== "hand" ||
      phase !== "playing" ||
      !camera.hand.detected ||
      document.hidden ||
      document.querySelector("dialog[open]")
    )
      return;
    const fieldRect = field.current?.getBoundingClientRect();
    if (!fieldRect) return;
    const x = fieldRect.left + camera.hand.x * fieldRect.width;
    const y = fieldRect.top + camera.hand.y * fieldRect.height;
    const target = Array.from(
      field.current!.querySelectorAll<HTMLButtonElement>("[data-target-id]"),
    ).find((element) => {
      const rect = element.getBoundingClientRect();
      return (
        x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
      );
    });
    shotRef.current(target ? Number(target.dataset.targetId) : undefined);
  }, [camera.hand, camera.shotSequence, inputMode, phase]);
  useEffect(() => {
    if (
      inputMode !== "hand" ||
      phase !== "playing" ||
      (camera.hand.detected &&
        camera.state === "ready" &&
        camera.vision === "ready")
    )
      return;
    const timer = setTimeout(() => {
      setHandPaused(true);
      setPhase("paused");
    }, 800);
    return () => clearTimeout(timer);
  }, [inputMode, phase, camera.hand.detected, camera.state, camera.vision]);
  finishRef.current = () => {
    if (finished.current) return;
    finished.current = true;
    const s = stats.current;
    onFinish({
      score: s.score,
      combo: s.maxCombo,
      hits: s.hits,
      shots: s.shots,
      accuracy: s.shots ? Math.round((s.hits / s.shots) * 100) : 0,
      newBest: s.score > localBest("shoot", shootMode),
      evidence: {
        inputMode,
        gameMode: shootMode,
        shots: s.shots,
        hits: s.hits,
        misses: s.shots - s.hits,
        maxCombo: s.maxCombo,
        fastestSuccessMs: Number.isFinite(fastestHit.current)
          ? fastestHit.current
          : undefined,
        duration: Math.min(
          endless ? 31536000 : 30,
          (elapsed.current +
            (lastTime.current && phase === "playing"
              ? Math.max(0, performance.now() - lastTime.current)
              : 0)) /
            1000,
        ),
        newBest: s.score > localBest("shoot", shootMode),
        metadata: {
          shootWaveCleared: wave && s.hits === 12 && s.shots === 12,
          passed: wave
            ? s.hits === 12
            : s.hits > 0 &&
              s.shots === s.hits &&
              s.lives > 0 &&
              elapsed.current >= 30000,
        },
      },
    });
    navigate("/result/shoot", { replace: true });
  };
  useEffect(() => {
    if (phase !== "playing") return;
    lastTime.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsed.current += now - lastTime.current;
      lastTime.current = now;
      setTime(
        endless
          ? Math.floor(elapsed.current / 1000)
          : Math.max(0, Math.ceil(30 - elapsed.current / 1000)),
      );
      if (!endless && elapsed.current >= 30000) finishRef.current();
    }, 50);
    return () => clearInterval(timer);
  }, [phase, endless]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 550);
    return () => clearTimeout(timer);
  }, [feedback]);
  useEffect(() => {
    const handle = () => {
      if (document.hidden) setPhase((p) => (p === "playing" ? "paused" : p));
    };
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        setPhase((p) =>
          p === "playing"
            ? "paused"
            : p === "paused" && canResumeRef.current
              ? "playing"
              : p,
        );
    };
    const pause = () => setPhase((p) => (p === "playing" ? "paused" : p));
    window.addEventListener("arcade:pause", pause);
    document.addEventListener("visibilitychange", handle);
    window.addEventListener("keydown", keys);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      window.removeEventListener("keydown", keys);
      window.removeEventListener("arcade:pause", pause);
    };
  }, []);
  function shot(id?: number) {
    if (phase !== "playing" || finished.current) return;
    tone("shoot.fire");
    const s = stats.current;
    s.shots++;
    if (id !== undefined) {
      const now =
        elapsed.current +
        (lastTime.current
          ? Math.max(0, performance.now() - lastTime.current)
          : 0);
      fastestHit.current = Math.min(
        fastestHit.current,
        Math.max(0, now - (targetBirth.current.get(id) ?? 0)),
      );
      targetBirth.current.set(id, now);
      s.hits++;
      s.combo++;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.score = Math.min(
        2147483647,
        s.score + 100 + Math.min(s.combo - 1, 10) * 20,
      );
      setScore(s.score);
      setCombo(s.combo);
      setFeedback({ kind: "hit", targetId: id });
      tone("shoot.hit");
      if (wave && s.hits >= 12) {
        finishRef.current();
        return;
      }
      if (s.combo > 1) tone("game.combo", { step: Math.min(4, s.combo - 2) });
      setTargets((prev) =>
        prev.map((target) =>
          target.id === id
            ? {
                ...target,
                x: target.kind * 29 + 15 + Math.random() * 12,
                y: 32 + Math.random() * 34,
              }
            : target,
        ),
      );
    } else {
      s.combo = 0;
      s.lives--;
      setCombo(0);
      setLives(s.lives);
      setFeedback({ kind: "miss" });
      tone("shoot.miss");
      if (s.lives <= 0) finishRef.current();
    }
  }
  shotRef.current = shot;
  return (
    <>
      <div className="play-top">
        <Link to="/games" className="back-link">
          ← {t("back")}
        </Link>
        <GameTimer seconds={time} duration={endless ? undefined : 30} />
        <Button
          color="white"
          onClick={() =>
            setPhase((p) =>
              p === "playing" ? "paused" : p === "paused" ? "playing" : p,
            )
          }
          disabled={phase === "ready" || (phase === "paused" && !canResume)}
          aria-label={t("pause")}
        >
          <Pause />
        </Button>
      </div>
      <div
        className="input-mode-switch"
        role="group"
        aria-label={t("controls")}
      >
        <button
          className={inputMode === "mouse" ? "active" : ""}
          onClick={() => {
            setInputMode("mouse");
            setHandPaused(false);
          }}
        >
          <MousePointer2 />
          {t(compactTouch ? "touchMode" : "mouseMode")}
        </button>
        <button
          className={inputMode === "hand" ? "active" : ""}
          data-sound={!camera.stream ? "none" : undefined}
          onClick={() => {
            setInputMode("hand");
            if (!camera.stream) void camera.connect();
          }}
        >
          <Hand />
          {t("handMode")}
        </button>
        <span>
          {t(
            inputMode === "hand"
              ? "handHelp"
              : compactTouch
                ? "touchAim"
                : "aim",
          )}
        </span>
      </div>
      <div className="play-layout">
        <aside className="hud">
          {[
            {
              key: "score",
              value: score.toLocaleString(),
              color: "pink",
              icon: <Star />,
            },
            { key: "combo", value: `× ${combo}`, color: "cyan", icon: <Zap /> },
            {
              key: "life",
              value: (
                <span className="hearts">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Heart
                      key={i}
                      fill={i < lives ? "var(--pink)" : "#aaa"}
                      size={25}
                    />
                  ))}
                </span>
              ),
              color: "lime",
              icon: null,
            },
            {
              key: wave ? "waveMode" : "round",
              value: wave ? `${stats.current.hits} / 12` : "1 / 1",
              color: "purple",
              icon: null,
            },
          ].map((s) => (
            <section className={`hud-panel ${s.color}`} key={s.key}>
              <h3>{t(s.key)}</h3>
              <strong>
                {s.icon}
                {s.value}
              </strong>
            </section>
          ))}
        </aside>
        <div
          className="playfield"
          ref={field}
          onPointerMove={(e) => {
            if (inputMode === "hand") return;
            const r = field.current!.getBoundingClientRect();
            setCursor({
              x: ((e.clientX - r.left) / r.width) * 100,
              y: ((e.clientY - r.top) / r.height) * 100,
            });
          }}
          onClick={() => {
            if (inputMode === "mouse") shot();
          }}
        >
          <RangeScenery />
          <div className="sun" />
          <div className="cloud cloud-one" />
          <div className="cloud cloud-two" />
          <div className="hills" />
          <div className="bunting">
            {["pink", "yellow", "cyan", "pink", "yellow", "cyan"].map(
              (c, i) => (
                <span className={c} key={i} />
              ),
            )}
          </div>
          <h1
            key={`${feedback?.kind}-${score}-${lives}`}
            className={`game-command ${feedback ? "bounce-feedback" : ""} ${feedback?.kind === "miss" ? "pink-text" : "yellow-text"}`}
          >
            {t(feedback?.kind ?? "shootCommand")}
          </h1>
          <span className="wood-sign">
            HIT THE
            <br />
            TARGET! <Star fill="var(--yellow)" />
          </span>
          <div className="fence" />
          {targets.map((target) => (
            <button
              key={target.id}
              disabled={phase !== "playing"}
              data-testid={`target-${target.id}`}
              data-target-id={target.id}
              className="target-character"
              style={{ left: `${target.x}%`, top: `${target.y}%` }}
              aria-label={`${t("fire")} ${target.id}`}
              onClick={(e) => {
                e.stopPropagation();
                if (inputMode === "mouse") shot(target.id);
              }}
            >
              <TargetCharacter
                kind={target.kind}
                hit={
                  feedback?.kind === "hit" && feedback.targetId === target.id
                }
              />
            </button>
          ))}
          <div className="range-counter" />
          {endless && (
            <Button
              color="white"
              className="shoot-finish-run"
              data-hand-click
              disabled={phase === "ready"}
              onClick={(e) => {
                e.stopPropagation();
                finishRef.current();
              }}
            >
              <Save aria-hidden="true" size={20} />
              {t("finishRun")}
            </Button>
          )}
          <div
            className={`crosshair ${inputMode === "hand" && camera.hand.detected ? "hand-active" : ""} ${camera.hand.pinched ? "pinched" : ""}`}
            style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
          >
            <Target size={55} />
          </div>
          {phase !== "playing" && (
            <div className="game-overlay" onClick={(e) => e.stopPropagation()}>
              <HandMenuCursor active />
              <div className="game-dialog panel">
                <Sticker>{phase === "ready" ? "READY?" : "PAUSE"}</Sticker>
                <h2>
                  {t(phase === "ready" ? "readyGame" : "paused")}
                  <small className="selected-game-mode">
                    {t("gameMode")} ·{" "}
                    {t(
                      endless
                        ? "endlessMode"
                        : wave
                          ? "waveMode"
                          : "standardMode",
                    )}
                  </small>
                </h2>
                {phase === "ready" && (
                  <div
                    className="game-mode-choice"
                    role="group"
                    aria-label={t("gameMode")}
                  >
                    <button
                      data-hand-click
                      aria-pressed={!wave && !endless}
                      className={!wave && !endless ? "active" : ""}
                      onClick={() => {
                        setWave(false);
                        setEndless(false);
                        setTime(30);
                      }}
                    >
                      {t("standardMode")}
                    </button>
                    <button
                      data-hand-click
                      aria-pressed={wave}
                      className={wave ? "active" : ""}
                      onClick={() => {
                        setWave(true);
                        setEndless(false);
                        setTime(30);
                      }}
                    >
                      {t("waveMode")}
                    </button>
                    <button
                      data-hand-click
                      aria-pressed={endless}
                      className={endless ? "active" : ""}
                      onClick={() => {
                        setWave(false);
                        setEndless(true);
                        setTime(0);
                      }}
                    >
                      {t("endlessMode")}
                    </button>
                  </div>
                )}
                <p>
                  {t(
                    phase === "ready" && endless
                      ? "endlessHint"
                      : phase === "ready" && wave
                        ? "waveDesc"
                        : handPaused
                          ? "handPaused"
                          : inputMode === "hand"
                            ? "handHelp"
                            : "readyDesc",
                  )}
                </p>
                <small>{t("readyDetail")}</small>
                {phase === "ready" && (
                  <InputCoach
                    game="shoot"
                    cameraMode={inputMode === "hand"}
                    onModeChange={(value) =>
                      setInputMode(value ? "hand" : "mouse")
                    }
                  />
                )}
                <Button
                  data-hand-click
                  disabled={
                    inputMode === "hand" &&
                    (!camera.hand.detected ||
                      camera.vision !== "ready" ||
                      camera.state !== "ready")
                  }
                  onClick={() => {
                    setHandPaused(false);
                    consumedShot.current = camera.shotSequence;
                    setPhase("playing");
                    if (phase === "ready") tone("start");
                  }}
                >
                  <Play />
                  {t(phase === "ready" ? "go" : "resume")}
                </Button>
                {inputMode === "hand" && !camera.hand.detected && (
                  <small>{t("handReady")}</small>
                )}
                {inputMode === "hand" && (
                  <button
                    className="mouse-fallback"
                    onClick={() => {
                      setInputMode("mouse");
                      setHandPaused(false);
                    }}
                  >
                    {t(compactTouch ? "touchMode" : "switchMouse")}
                  </button>
                )}
                {phase === "paused" && <Link to="/games">{t("quit")}</Link>}
              </div>
            </div>
          )}
        </div>
        <aside className="play-side">
          <WebcamFrame compact />
          <h1>{t("shoot")}</h1>
          <section className="panel instructions">
            <h2>{t("controls")}</h2>
            <div>
              <MousePointer2 />
              <Target />
            </div>
            <p>
              {t(
                inputMode === "hand"
                  ? "handAim"
                  : compactTouch
                    ? "touchAim"
                    : "aim",
              )}
            </p>
            <p>
              {t(
                inputMode === "hand"
                  ? "handFire"
                  : compactTouch
                    ? "touchFire"
                    : "fire",
              )}
            </p>
            <span className="small-sticker">
              {inputMode === "hand"
                ? "PINCH & POP!"
                : compactTouch
                  ? "TAP & POP!"
                  : "CLICK & POP!"}
            </span>
          </section>
        </aside>
      </div>
      <div className="play-hint panel">
        <CircleHelp />
        <strong>{t("hint")}</strong>
        <span>✦</span>
      </div>
    </>
  );
}
function ResultPage() {
  const { t } = useTranslation();
  const { records, tone } = useContext(Context);
  const navigate = useNavigate();
  const r = records.last;
  if (!r)
    return (
      <div className="empty-state panel">
        <Trophy size={64} />
        <h1>{t("resultEmpty")}</h1>
        <p>{t("resultEmptySub")}</p>
        <Button onClick={() => navigate("/play/shoot")}>{t("start")}</Button>
      </div>
    );
  return (
    <GameResult
      game="shoot"
      score={r.score}
      best={localBest("shoot", r.evidence?.gameMode ?? "standard")}
      stats={[
        { label: t("combo"), value: r.combo },
        { label: t("accuracy"), value: r.accuracy, unit: "%" },
      ]}
      newBest={r.newBest}
      tone={tone}
      replay={`/play/shoot?mode=${r.evidence?.gameMode ?? "standard"}`}
      camera={<WebcamFrame compact />}
      extraAction={
        <Button
          color="purple"
          onClick={() =>
            navigate(
              `/play/${games[Math.floor(Math.random() * games.length)].id}`,
            )
          }
        >
          <Dice5 />
          {t("random")}
        </Button>
      }
    >
      <div className="result-badges">
        {[
          ...(r.accuracy >= 80 && r.hits > 0
            ? [{ key: "badgeAim", icon: Target, color: "cyan" }]
            : []),
          ...(r.combo >= 5
            ? [{ key: "badgeCombo", icon: Zap, color: "pink" }]
            : []),
          { key: "badgeTry", icon: Crown, color: "orange" },
        ].map(({ key, icon: Icon, color }) => (
          <div className={color} key={key}>
            <Icon />
            <strong>{t(key)}</strong>
            <small>{t(`${key}Desc`)}</small>
          </div>
        ))}
      </div>
    </GameResult>
  );
}
function SettingsDialog({
  close,
  motion,
  setMotion,
  music,
  setMusic,
  musicVolume,
  setMusicVolume,
  replayIntro,
}: {
  close: () => void;
  motion: boolean;
  setMotion: (x: boolean) => void;
  music: boolean;
  setMusic: (x: boolean) => void;
  musicVolume: number;
  setMusicVolume: (x: number) => void;
  replayIntro: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="settings-dialog panel"
      onCancel={close}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
    >
      <div className="dialog-heading">
        <h2>{t("settingsTitle")}</h2>
        <button onClick={close} aria-label={t("close")}>
          <X />
        </button>
      </div>
      <label>
        <Languages />
        {t("language")}
        <select
          value={i18n.language}
          onChange={(e) => {
            void i18n.changeLanguage(e.target.value);
            save("arcade.language", e.target.value);
          }}
        >
          <option value="ko">한국어</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        <Sparkles />
        {t("motion")}
        <input
          type="checkbox"
          checked={motion}
          onChange={(e) => setMotion(e.target.checked)}
        />
      </label>
      <label>
        <Volume2 />
        {t("backgroundMusic")}
        <input
          type="checkbox"
          checked={music}
          onChange={(e) => setMusic(e.target.checked)}
        />
      </label>
      <label className="music-volume-control">
        <span>{t("musicVolume")}</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(musicVolume * 100)}
          disabled={!music}
          onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
        />
        <output>{Math.round(musicVolume * 100)}%</output>
      </label>
      <p>
        <Camera />
        {t("privacy")}
      </p>
      <button className="intro-replay-button" onClick={replayIntro}>
        {t("replayIntro")}
      </button>
      <Button onClick={close}>{t("close")}</Button>
    </dialog>
  );
}
function App() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [introActive, setIntroActive] = useState(
    () => pathname === "/" && !read(INTRO_SEEN_KEY, false),
  );
  const [introPhase, setIntroPhase] = useState<IntroPhase>("entry");
  const introBusy = useRef(introActive);
  introBusy.current = introActive;
  const introMusicReady = !introActive || titleVisible(introPhase);
  const homeVisible =
    !introActive || introPhase === "fade" || introPhase === "reveal";
  const musicMix = introActive
    ? introPhase === "reveal"
      ? 0.7
      : 1
    : musicForPath(pathname) === "title"
      ? 0.7
      : 1;
  const [sound, setSound] = useState(() => read("arcade.sound", true));
  const [music, setMusic] = useState(() => read("arcade.music", true));
  const [musicVolume, setMusicVolume] = useState(() => {
    const value = read("arcade.music.volume", 0.65);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.65;
  });
  const [motion, setMotion] = useState(() => read("arcade.motion", false));
  const [settings, setSettings] = useState(false);
  const [records, setRecords] = useState<Records>(() => {
    const stored = read<Records>("arcade.records", emptyRecords);
    return typeof stored.best === "number" && typeof stored.plays === "number"
      ? { ...emptyRecords, ...stored }
      : emptyRecords;
  });
  const [storageError, setStorageError] = useState(false);
  const audio = useRef<SoundManager | null>(null);
  const unlocked = useRef<Promise<boolean> | null>(null);
  const introControlGeneration = useRef(0);
  useEffect(() => {
    const engine = new SoundManager({
      enabled: read("arcade.sound", true),
      musicEnabled: read("arcade.music", true),
      musicVolume: read("arcade.music.volume", 0.65),
    });
    audio.current = engine;
    const unlock = (event: Event) => {
      if (!event.isTrusted || (event instanceof KeyboardEvent && event.repeat))
        return;
      unlocked.current = engine.unlock();
    };
    const hidden = () => {
      if (document.hidden) engine.stop();
      else engine.resumeMusic();
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      document.removeEventListener("visibilitychange", hidden);
      engine.dispose();
      audio.current = null;
      unlocked.current = null;
    };
  }, []);
  useEffect(() => {
    audio.current?.setEnabled(sound);
  }, [sound]);
  useEffect(() => {
    audio.current?.setMusic(introMusicReady ? musicForPath(pathname) : null);
  }, [pathname, introMusicReady]);
  useEffect(() => {
    audio.current?.setMusicMix(musicMix, 0.8);
  }, [musicMix]);
  useEffect(() => {
    audio.current?.setMusicEnabled(music);
    save("arcade.music", music);
  }, [music]);
  useEffect(() => {
    audio.current?.setMusicVolume(musicVolume);
    save("arcade.music.volume", musicVolume);
  }, [musicVolume]);
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? "reduced" : "full";
    save("arcade.motion", motion);
  }, [motion]);
  const tone = useCallback(
    (type: SoundCue = "click", options?: PlayOptions) => {
      const engine = audio.current;
      if (!engine || document.hidden) return;
      if (introBusy.current && !["ui.toggleOn", "ui.toggleOff"].includes(type))
        return;
      if (engine.isReady) engine.play(type, options);
      else if (
        ["click", "ui.click", "ui.toggleOn", "start", "resume"].includes(
          type,
        ) &&
        unlocked.current
      ) {
        void unlocked.current.then(() => {
          if (audio.current === engine && !document.hidden)
            engine.play(type, options);
        });
      }
    },
    [],
  );
  const introUi = useCallback((cue: "ui.hover" | "ui.click" | "ui.back") => {
    const engine = audio.current;
    if (!engine || document.hidden) return;
    const generation = introControlGeneration.current;
    if (engine.isReady) engine.play(cue);
    else if (cue !== "ui.hover" && unlocked.current)
      void unlocked.current.then(() => {
        if (
          audio.current === engine &&
          introControlGeneration.current === generation &&
          !document.hidden
        )
          engine.play(cue);
      });
  }, []);
  const toggleSound = () => {
    if (introBusy.current) introControlGeneration.current++;
    if (sound) tone("ui.toggleOff");
    audio.current?.setEnabled(!sound);
    setSound(!sound);
    save("arcade.sound", !sound);
    if (!sound) tone("ui.toggleOn");
  };
  const introBeat = useCallback((phase: IntroPhase) => {
    setIntroPhase(phase);
    const engine = audio.current;
    if (!engine || document.hidden) return;
    if (phase === "ready") engine.play("game.ready");
    else if (["three", "two", "one"].includes(phase))
      engine.play("game.countdown", {
        step: ["three", "two", "one"].indexOf(phase),
      });
    else if (phase === "go") {
      engine.play("game.start");
      engine.play("navigation.transition");
    } else if (phase === "title") {
      engine.play("sticker.appear");
      engine.setMusic("title");
    } else if (phase === "reveal") engine.setMusicMix(0.7, 0.8);
  }, []);
  const completeIntro = useCallback(
    (skipped: boolean) => {
      introControlGeneration.current++;
      if (skipped) {
        audio.current?.stop();
        audio.current?.setMusicMix(0.7, 0.8);
        audio.current?.setMusic("title");
        introUi("ui.back");
      }
      save(INTRO_SEEN_KEY, true);
      setIntroPhase("complete");
      setIntroActive(false);
      requestAnimationFrame(() => {
        if (!document.querySelector("dialog[open]"))
          document
            .querySelector<HTMLButtonElement>(".hero-cta")
            ?.focus({ preventScroll: true });
      });
    },
    [introUi],
  );
  const replayIntro = () => {
    introControlGeneration.current++;
    setSettings(false);
    audio.current?.stop();
    audio.current?.resetMusic();
    navigate("/");
    setIntroPhase("entry");
    setIntroActive(true);
  };
  function finish(result: Result) {
    recordPlay(
      "shoot",
      result.score,
      result.accuracy,
      result.evidence?.duration ?? 0,
      result.evidence,
    );
    const next = {
      best:
        result.evidence?.gameMode && result.evidence.gameMode !== "standard"
          ? records.best
          : Math.max(records.best, result.score),
      plays: records.plays + 1,
      day: today(),
      daily: (records.day === today() ? records.daily : 0) + 1,
      last: result,
    };
    setRecords(next);
    setStorageError(!save("arcade.records", next));
  }
  function finishCircle(_result: CircleResult) {
    recordPlay(
      "circle",
      _result.score,
      _result.accuracy,
      _result.duration,
      _result.evidence,
    );
    const next = {
      ...records,
      day: today(),
      daily: (records.day === today() ? records.daily : 0) + 1,
    };
    setRecords(next);
    setStorageError(!save("arcade.records", next));
  }
  function finishCham() {
    const next = {
      ...records,
      day: today(),
      daily: (records.day === today() ? records.daily : 0) + 1,
    };
    setRecords(next);
    setStorageError(!save("arcade.records", next));
  }
  return (
    <Context.Provider value={{ sound, tone, records }}>
      <SoundFeedback play={tone} />
      <PlayerSession />
      <AchievementToasts play={tone} />
      {introActive && (
        <IntroSequence
          sound={sound}
          onSound={toggleSound}
          onHover={() => introUi("ui.hover")}
          onPhase={introBeat}
          onComplete={completeIntro}
          onStart={() => {
            introControlGeneration.current++;
            const engine = audio.current;
            if (engine) {
              unlocked.current = engine.unlock();
              engine.prepareMusic("title");
              introUi("ui.click");
            }
          }}
        />
      )}
      {homeVisible && (
        <div
          className={introActive ? "entry-home-reveal" : undefined}
          inert={introActive}
        >
          <RouteContent key={pathname}>
            <div
              className={`app-shell screen-${pathname.startsWith("/play") ? "play" : pathname.startsWith("/result") ? "result" : pathname === "/games" ? "games" : "home"}`}
            >
              <ComicDecor />
              <Header
                onSettings={() => {
                  window.dispatchEvent(new Event("arcade:pause"));
                  setSettings(true);
                }}
                onSound={toggleSound}
              />
              <main>
                <Routes>
                  <Route
                    path="/"
                    element={<HomePage introDone={!introActive} />}
                  />
                  <Route path="/games" element={<GamesPage />} />
                  <Route
                    path="/play/gate"
                    element={<GateGamePage tone={tone} />}
                  />
                  <Route
                    path="/result/gate"
                    element={<GateResultPage tone={tone} />}
                  />
                  <Route
                    path="/play/shoot"
                    element={<PlayPage onFinish={finish} />}
                  />
                  <Route
                    path="/play/circle"
                    element={
                      <CircleGamePage onFinish={finishCircle} tone={tone} />
                    }
                  />
                  <Route path="/result/shoot" element={<ResultPage />} />
                  <Route
                    path="/result/circle"
                    element={<CircleResultPage tone={tone} />}
                  />
                  <Route
                    path="/play/cham"
                    element={<ChamGamePage onFinish={finishCham} tone={tone} />}
                  />
                  <Route
                    path="/result/cham"
                    element={<ChamResultPage tone={tone} />}
                  />
                  <Route
                    path="/play/rps"
                    element={<RpsGamePage onFinish={finishCham} tone={tone} />}
                  />
                  <Route
                    path="/result/rps"
                    element={<RpsResultPage tone={tone} />}
                  />
                  <Route
                    path="/play/dodge"
                    element={
                      <DodgeGamePage onFinish={finishCham} tone={tone} />
                    }
                  />
                  <Route
                    path="/result/dodge"
                    element={<DodgeResultPage tone={tone} />}
                  />
                  <Route path="/ranking" element={<CommunityPage />} />
                  <Route
                    path="/achievements"
                    element={<CommunityPage achievements />}
                  />
                  <Route path="*" element={<Navigate to="/games" replace />} />
                </Routes>
              </main>
              {storageError && <p role="alert">{t("recordError")}</p>}
              <footer>
                <span>WEBCAM ARCADE © 2026</span>
                <span>
                  {t("footer")} <Smile size={16} />
                </span>
                <button
                  onClick={() => {
                    const lang = i18n.language === "ko" ? "en" : "ko";
                    void i18n.changeLanguage(lang);
                    save("arcade.language", lang);
                  }}
                >
                  <Languages size={16} />{" "}
                  {i18n.language === "ko" ? "한국어 / EN" : "EN / 한국어"}
                </button>
              </footer>
            </div>
          </RouteContent>
        </div>
      )}
      {settings && (
        <SettingsDialog
          close={() => setSettings(false)}
          motion={motion}
          setMotion={setMotion}
          music={music}
          setMusic={setMusic}
          musicVolume={musicVolume}
          setMusicVolume={setMusicVolume}
          replayIntro={replayIntro}
        />
      )}
    </Context.Provider>
  );
}
const root =
  import.meta.hot?.data.root ?? createRoot(document.getElementById("root")!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <CameraProvider>
        <InputEnvironment />
        <App />
      </CameraProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
