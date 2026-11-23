import { WeeklyEventPopup, EventsPage } from "./events/WeeklyEvent";
import { Button, Sticker } from "./components/ArcadePrimitives";
import {
  ShootGamePage,
  ShootResultPage,
  GateGamePage,
  GateResultPage,
  CommunityPage,
  ChamGamePage,
  ChamResultPage,
  CircleGamePage,
  CircleResultPage,
  RpsGamePage,
  RpsResultPage,
  DodgeGamePage,
  DodgeResultPage,
  SliceGamePage,
  SliceResultPage,
  HockeyGamePage,
  HockeyResultPage,
  BubbleGamePage,
  BubbleResultPage,
  useRoutePrefetch,
} from "./routes/lazyPages";
import { readCham } from "./games/chamRecords";
import { readRps } from "./games/rpsRecords";
import { readDodge } from "./games/dodgeRecords";
import { HOCKEY_SECONDS } from "./games/hockeyConfig";
import { BUBBLE_SHOTS } from "./games/bubbleConfig";
import { recordPlay } from "./community/client";
import { localBest, type GameId } from "./community/store";
import { PlayerSession, PlayerWelcome } from "./community/PlayerWelcome";
import { HomeEasterEggs } from "./community/HomeEasterEggs";
import { AchievementToasts } from "./community/AchievementToasts";
import { InputBadge } from "./components/InputBadge";
import { inputKind } from "./components/input-coach-data";
import {
  InputEnvironment,
  useInputEnvironment,
} from "./components/InputEnvironment";
import "./touch.css";
import React, {
  Suspense,
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
  Crown,
  Dice5,
  Gamepad2,
  Hand,
  Home,
  Languages,
  MousePointer2,
  Play,
  Settings,
  Smile,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import ko from "./locales/ko.json";
import en from "./locales/en.json";
// Shared dialog sizing must precede the global game theme, including on cold routes.
import "./components/input-coach.css";
// RPS, Dodge and Gate reuse the cham toolbar, stage and dialog layout classes.
import "./games/cham.css";
import "./styles.css";
import "./comic.css";
import { ComicDecor } from "./components/ComicArt";
import { Character } from "./components/Character";
import { gameCharacterMap } from "./assets/characters";
import { CameraProvider, useCamera } from "./vision/CameraProvider";
import { WebcamFrame } from "./components/WebcamFrame";
import type { CircleResult } from "./games/CircleGamePage";

import "./game-theme.css";
import { RouteContent } from "./components/RouteContent";
import "./motion.css";
import "./responsive.css";
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
import {
  emptyShootRecords as emptyRecords,
  type ShootRecords as Records,
  type ShootResult as Result,
} from "./games/shootRecords";
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
const Context = createContext({
  sound: true,
  tone: (_type?: SoundCue, _options?: PlayOptions) => {},
  records: emptyRecords,
});
type GameCardEntry = { id: GameId; color: string; badge: string } &
  ({ duration: number; shots?: never } | { shots: number; duration?: never });
const games: GameCardEntry[] =
  [
    { id: "cham", color: "pink", duration: 30, badge: "popular" },
    { id: "circle", color: "cyan", duration: 20, badge: "new" },
    { id: "shoot", color: "lime", duration: 30, badge: "easy" },
    { id: "rps", color: "purple", duration: 30, badge: "new" },
    { id: "dodge", color: "orange", duration: 30, badge: "new" },
    { id: "slice", color: "orange", duration: 30, badge: "new" },
    { id: "face-hockey", color: "cyan", duration: HOCKEY_SECONDS, badge: "new" },
    { id: "bubble-shooter", color: "purple", shots: BUBBLE_SHOTS, badge: "new" },
  ];

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
        <NavLink to="/events">
          <Smile />
          {t("events")}
        </NavLink>
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
  shots,
  badge,
}: GameCardEntry) {
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
          {shots === undefined && "◷ "}
          {id === "dodge"
            ? t("dodgeSurvivalMode")
            : shots !== undefined
              ? t("bubbleShots", { count: shots })
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
                filter !== "face" && filter !== "hand" || inputKind[g.id] === filter,
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

function PlayPage({ onFinish }: { onFinish: (r: Result) => void }) {
  const { records, tone } = useContext(Context);
  return <ShootGamePage onFinish={onFinish} records={records} tone={tone} />;
}
function ResultPage() {
  const { records, tone } = useContext(Context);
  return (
    <ShootResultPage
      records={records}
      tone={tone}
      randomGames={games.map((game) => game.id)}
    />
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
  useRoutePrefetch();
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
      <WeeklyEventPopup
        enabled={homeVisible && !introActive && pathname === "/"}
      />
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
      <Suspense fallback={null}>
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
                      element={
                        <ChamGamePage onFinish={finishCham} tone={tone} />
                      }
                    />
                    <Route
                      path="/result/cham"
                      element={<ChamResultPage tone={tone} />}
                    />
                    <Route
                      path="/play/rps"
                      element={
                        <RpsGamePage onFinish={finishCham} tone={tone} />
                      }
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
                    <Route
                      path="/play/slice"
                      element={<SliceGamePage tone={tone} onFinish={finishCham} />}
                    />
                    <Route
                      path="/result/slice"
                      element={<SliceResultPage tone={tone} />}
                    />
                    <Route
                      path="/play/face-hockey"
                      element={<HockeyGamePage tone={tone} onFinish={finishCham} />}
                    />
                    <Route
                      path="/result/face-hockey"
                      element={<HockeyResultPage tone={tone} />}
                    />
                    <Route path="/play/bubble-shooter" element={<BubbleGamePage tone={tone} onFinish={finishCham} />} />
                    <Route path="/result/bubble-shooter" element={<BubbleResultPage tone={tone} />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/ranking" element={<CommunityPage />} />
                    <Route
                      path="/achievements"
                      element={<CommunityPage achievements />}
                    />
                    <Route
                      path="*"
                      element={<Navigate to="/games" replace />}
                    />
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
      </Suspense>
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
