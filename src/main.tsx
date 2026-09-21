import { useGameInput } from "./vision/useGameInput";
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
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
  RotateCcw,
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
import { CameraProvider, useCamera } from "./vision/CameraProvider";
import { WebcamFrame } from "./components/WebcamFrame";
import {
  CircleGamePage,
  CircleResultPage,
  type CircleResult,
} from "./games/CircleGamePage";

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
type GameId = "cham" | "circle" | "shoot";
type Result = {
  score: number;
  combo: number;
  accuracy: number;
  hits: number;
  shots: number;
  newBest: boolean;
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
  tone: (_type?: string) => {},
  records: emptyRecords,
});
const games: { id: GameId; color: string; duration: number; badge: string }[] =
  [
    { id: "cham", color: "pink", duration: 30, badge: "popular" },
    { id: "circle", color: "cyan", duration: 20, badge: "new" },
    { id: "shoot", color: "lime", duration: 30, badge: "easy" },
  ];

function Mascot({ mini = false }: { mini?: boolean }) {
  return (
    <svg
      className={mini ? "mascot mini" : "mascot"}
      viewBox="0 0 300 330"
      aria-hidden="true"
    >
      <g stroke="var(--ink)" strokeWidth="8" strokeLinejoin="round">
        <path
          fill="var(--cyan)"
          d="M81 145C32 56 57 16 82 31c22 12 34 66 37 100M168 126c8-81 32-112 52-95 22 22-3 76-13 111"
        />
        <path fill="var(--pink)" d="M55 230C-2 216 5 176 32 178l52 32" />
        <path
          fill="var(--paper)"
          d="M63 282C13 305 5 271 35 248l26-19c-15-77 28-115 89-117 77-4 117 50 101 111 67-39 65 18 17 48-17 38-66 57-123 54-42-1-66-15-82-43Z"
        />
        <path fill="var(--lime)" d="M242 298 291 134l36 42-36 155" />
      </g>
      <ellipse cx="122" cy="186" rx="10" ry="18" />
      <path
        d="m183 174-14 13 17 7"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M133 213q17 12 34-3c-2 54-30 52-34 3"
        fill="var(--pink)"
        stroke="var(--ink)"
        strokeWidth="6"
      />
      <ellipse
        cx="92"
        cy="217"
        rx="16"
        ry="9"
        fill="var(--pink)"
        opacity=".5"
      />
      <ellipse
        cx="199"
        cy="210"
        rx="16"
        ry="9"
        fill="var(--pink)"
        opacity=".5"
      />
    </svg>
  );
}
function GameArt({ id }: { id: GameId }) {
  return (
    <svg className="game-art" viewBox="0 0 260 200" aria-hidden="true">
      {id === "shoot" ? (
        <>
          <g transform="translate(177 89) rotate(12)">
            <ellipse
              rx="62"
              ry="76"
              fill="#ff6258"
              stroke="#111"
              strokeWidth="5"
            />
            <ellipse rx="46" ry="60" fill="#fff7e7" />
            <ellipse rx="31" ry="43" fill="#ff6258" />
            <ellipse rx="17" ry="26" fill="#fff7e7" />
            <ellipse rx="8" ry="13" fill="#34c8ff" />
          </g>
          <path
            d="m178 86-62-10m9-3-17 1 10 12"
            stroke="#111"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <g fill="#fff7e7" stroke="#111" strokeWidth="6">
            <circle cx="76" cy="107" r="25" />
            <path d="M31 199q0-52 41-65l49-24q12-2 10 9l-24 24-12 56" />
          </g>
        </>
      ) : id === "circle" ? (
        <>
          <ellipse
            cx="137"
            cy="99"
            rx="80"
            ry="68"
            fill="none"
            stroke="#ffd927"
            strokeWidth="16"
            transform="rotate(-30 137 99)"
          />
          <path
            d="M88 48c76-63 156 16 115 84"
            fill="none"
            stroke="#ff4fa3"
            strokeWidth="15"
            strokeLinecap="round"
          />
          <g
            fill="#fff7e7"
            stroke="#111"
            strokeWidth="6"
            strokeLinejoin="round"
          >
            <circle cx="131" cy="70" r="23" />
            <path d="m116 98-33-15q-18-5-13 10l35 31-20 36q-8 16 8 17l37-31 21 34q12 10 18-3l-15-55 38-26q12-15-4-19l-43 22Z" />
          </g>
        </>
      ) : (
        <>
          <path
            d="m137 18 12 34 39-20-5 38 48 8-35 30 37 31-47 6 4 39-39-19-19 33-16-36-36 13 5-38-35-14 35-20-14-38 39 9Z"
            fill="#ffd927"
          />
          <g
            fill="#fff7e7"
            stroke="#111"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m119 112-29-12q-16-10-7-18 5-4 24 4L96 48q-3-14 9-14l22 44 10-49q5-12 15-3l-6 54 30-25q14-8 16 5l-35 46-11 37-42 46-39-18Z" />
            <path d="M34 189 53 143q-6-28 10-30 17-18 25-4 23-3 25 14 15 6 9 23l-18 14-14 39" />
          </g>
        </>
      )}
      <path
        d="m35 23 5 12 14 1-10 9 2 14-12-7-12 7 3-14-10-10 14-1Z"
        fill="#fff7e7"
        stroke="#111"
        strokeWidth="3"
      />
    </svg>
  );
}
function Button({
  children,
  color = "pink",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { color?: string }) {
  const { tone } = useContext(Context);
  return (
    <button
      {...props}
      className={`arcade-button ${color} ${className}`}
      onClick={(e) => {
        tone("click");
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
        {[
          ["ranking", Crown],
          ["missions", Star],
          ["events", Smile],
        ].map(([key, Icon]) => (
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
      <span className="health-sticker">{t("health")}</span>
    </header>
  );
}
function GameCard({ id, color, duration, badge }: (typeof games)[number]) {
  const { t } = useTranslation();
  const available = id === "shoot" || id === "circle";
  return (
    <Link
      to={available ? `/play/${id}` : "/games"}
      className={`game-card ${color} ${available ? "available" : ""}`}
      aria-label={`${t(id)} ${available ? t("playNow") : t("soon")}`}
    >
      <Sticker
        color={id === "cham" ? "orange" : id === "circle" ? "yellow" : "cyan"}
      >
        {id === "cham" && <Crown size={19} />} {t(badge)}
      </Sticker>
      <div className="card-copy">
        <h3>{t(id)}</h3>
        <p>{t(`${id}Desc`)}</p>
      </div>
      <Character asset={gameCharacterMap[id]} className="card-character" />
      <div className="card-bottom">
        <span>
          <UserRound size={17} />
          {t("onePlayer")}
        </span>
        <span>◷ {t("seconds", { count: duration })}</span>
        {available ? (
          <span className="card-arrow">
            <ArrowRight />
          </span>
        ) : (
          <small>{t("soon")}</small>
        )}
      </div>
    </Link>
  );
}
function RecordsBar() {
  const { t } = useTranslation();
  const { records } = useContext(Context);
  const circleBest = read<number>("arcade.circle.best", 0);
  const circlePlays = read<number>("arcade.circle.plays", 0);
  return (
    <section className="records-bar">
      <div className="records-title">
        <Trophy />
        <div>
          <h3>{t("bestRecords")}</h3>
          <small>
            {records.plays
              ? t("plays", { count: records.plays })
              : t("noRecords")}
          </small>
        </div>
      </div>
      <div className="record-tile pink">
        <Hand />
        <div>
          <span>{t("cham")}</span>
          <b>—</b>
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
function HomePage() {
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
          <p>
            {t("intro")}
            <br />
            {t("intro2")}
          </p>
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
          <h2>
            <Zap size={23} fill="currentColor" />
            {t("featured")}
          </h2>
          <Link to="/games">
            {t("viewAll")}
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="game-grid">
          {games.map((g) => (
            <GameCard key={g.id} {...g} />
          ))}
        </div>
      </section>
      <RecordsBar />
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
        <p>{t("pickSub")}</p>
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
              .filter((g) => filter !== "face" || g.id === "cham")
              .map((g) => (
                <GameCard key={g.id} {...g} />
              ))}
            {filter !== "face" &&
              [
                {
                  key: "futureRps",
                  color: "purple",
                  art: "cham",
                  input: "hand",
                },
                {
                  key: "futureDodge",
                  color: "orange",
                  art: "circle",
                  input: "body",
                },
                {
                  key: "futurePose",
                  color: "purple",
                  art: "circle",
                  input: "body",
                },
              ]
                .filter((game) => filter !== "hand" || game.input === "hand")
                .map((game) => (
                  <article
                    className={`future-card ${game.color}`}
                    key={game.key}
                    aria-label={`${t(game.key)} ${t("soon")}`}
                  >
                    <Sticker
                      color={game.color === "orange" ? "pink" : "yellow"}
                    >
                      {t("soon")}
                    </Sticker>
                    <div className="card-copy">
                      <h3>{t(game.key)}</h3>
                      <p>{t(`${game.key}Desc`)}</p>
                    </div>
                    <Character
                      asset={
                        gameCharacterMap[
                          game.key as "futureRps" | "futureDodge" | "futurePose"
                        ]
                      }
                      className="card-character"
                    />
                    <div className="card-bottom">
                      <span>
                        <UserRound size={17} />
                        {t("onePlayer")}
                      </span>
                      <span>◷ {t("seconds", { count: 30 })}</span>
                      <small>{t("soon")}</small>
                    </div>
                  </article>
                ))}
          </div>
          <div className="upcoming-panel">
            <Sparkles />
            <div>
              <h3>{t("upcoming")}</h3>
              <p>{t("upcomingDesc")}</p>
            </div>
            <span>✦</span>
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
            <p>{t("recommendSub")}</p>
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
        <Button color="yellow" onClick={() => navigate("/play/shoot")}>
          <Dice5 />
          {t("random")}
        </Button>
      </div>
    </>
  );
}

type TargetData = { x: number; y: number; kind: number; id: number };
const initialTargets: TargetData[] = [
  { x: 23, y: 57, kind: 0, id: 1 },
  { x: 50, y: 40, kind: 1, id: 2 },
  { x: 77, y: 58, kind: 2, id: 3 },
];
function TargetCharacter({ kind }: { kind: number }) {
  return (
    <svg viewBox="0 0 140 180" aria-hidden="true">
      <g stroke="#111" strokeWidth="5" strokeLinejoin="round">
        {kind === 0 ? (
          <path
            fill="#ffd927"
            d="M31 77C12 22 115 17 108 78c48 14 19 65-34 68C17 146-4 98 31 77Z"
          />
        ) : kind === 1 ? (
          <path
            fill="#fff7e7"
            d="M38 77C0 8 43-7 58 61l17-1c12-65 58-64 39 6-3 8-6 13-9 18 44 81-96 80-67-7Z"
          />
        ) : (
          <path
            fill="#34c8ff"
            d="m68 21 25 44 44 5-32 36 8 47-42-19-46 20 8-47L2 72l46-9Z"
          />
        )}
      </g>
      <ellipse cx="54" cy="86" rx="5" ry="8" />
      <ellipse cx="85" cy="86" rx="5" ry="8" />
      <path d="M62 98q9 13 16-1" fill="#ff4fa3" stroke="#111" strokeWidth="3" />
      <circle
        cx="71"
        cy="128"
        r="30"
        fill="#ff6258"
        stroke="#111"
        strokeWidth="3"
      />
      <circle cx="71" cy="128" r="20" fill="#fff7e7" />
      <circle cx="71" cy="128" r="10" fill="#ff6258" />
      <path
        d="M15 168h112v12H15Z"
        fill="#b8793c"
        stroke="#111"
        strokeWidth="4"
      />
    </svg>
  );
}
function PlayPage({ onFinish }: { onFinish: (r: Result) => void }) {
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
  const [time, setTime] = useState(30);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(5);
  const [targets, setTargets] = useState(initialTargets);
  const [feedback, setFeedback] = useState("");
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
      newBest: s.score > records.best,
    });
    tone("result");
    navigate("/result/shoot", { replace: true });
  };
  useEffect(() => {
    if (phase !== "playing") return;
    lastTime.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsed.current += now - lastTime.current;
      lastTime.current = now;
      setTime(Math.max(0, Math.ceil(30 - elapsed.current / 1000)));
      if (elapsed.current >= 30000) finishRef.current();
    }, 50);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 550);
    return () => clearTimeout(timer);
  }, [feedback, score, lives]);
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
    const s = stats.current;
    s.shots++;
    if (id !== undefined) {
      s.hits++;
      s.combo++;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      s.score += 100 + Math.min(s.combo - 1, 10) * 20;
      setScore(s.score);
      setCombo(s.combo);
      setFeedback("hit");
      tone("score");
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
      setFeedback("miss");
      tone("fail");
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
        <div className="timer-bar">
          <span>◷ {t("time")}</span>
          <progress max="30" value={time} />
          <b>
            {time}
            <small>s</small>
          </b>
        </div>
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
          {t("mouseMode")}
        </button>
        <button
          className={inputMode === "hand" ? "active" : ""}
          onClick={() => {
            setInputMode("hand");
            if (!camera.stream) void camera.connect();
          }}
        >
          <Hand />
          {t("handMode")}
        </button>
        <span>{t(inputMode === "hand" ? "handHelp" : "aim")}</span>
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
            { key: "round", value: "1 / 1", color: "purple", icon: null },
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
            className={`game-command ${feedback === "miss" ? "pink-text" : "yellow-text"}`}
          >
            {t(feedback || "shootCommand")}
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
              <TargetCharacter kind={target.kind} />
            </button>
          ))}
          <div className="range-counter" />
          <div
            className={`crosshair ${inputMode === "hand" && camera.hand.detected ? "hand-active" : ""} ${camera.hand.pinched ? "pinched" : ""}`}
            style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
          >
            <Target size={55} />
          </div>
          {phase !== "playing" && (
            <div className="game-overlay" onClick={(e) => e.stopPropagation()}>
              <div className="game-dialog panel">
                <Sticker>{phase === "ready" ? "READY?" : "PAUSE"}</Sticker>
                <h2>{t(phase === "ready" ? "readyGame" : "paused")}</h2>
                <p>
                  {t(
                    handPaused
                      ? "handPaused"
                      : inputMode === "hand"
                        ? "handHelp"
                        : "readyDesc",
                  )}
                </p>
                <small>{t("readyDetail")}</small>
                <Button
                  disabled={
                    inputMode === "hand" &&
                    (!camera.hand.detected ||
                      camera.vision !== "ready" ||
                      camera.state !== "ready")
                  }
                  onClick={() => {
                    setHandPaused(false);
                    setPhase("playing");
                    tone("start");
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
                    {t("switchMouse")}
                  </button>
                )}
                {phase === "paused" && <Link to="/games">{t("quit")}</Link>}
              </div>
            </div>
          )}
        </div>
        <aside className="play-side">
          <WebcamFrame compact />
          <section className="panel instructions">
            <h2>{t("controls")}</h2>
            <div>
              <MousePointer2 />
              <Target />
            </div>
            <p>{t(inputMode === "hand" ? "handAim" : "aim")}</p>
            <p>{t(inputMode === "hand" ? "handFire" : "fire")}</p>
            <span className="small-sticker">
              {inputMode === "hand" ? "PINCH & POP!" : "CLICK & POP!"}
            </span>
          </section>
          <Mascot mini />
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
  const { records } = useContext(Context);
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
    <>
      <h1 className="result-heading">
        <span className="yellow-text">
          {Array.from(t("clear")).map((letter, index) => (
            <span className="clear-letter" key={index}>
              {letter}
            </span>
          ))}
        </span>
        <span>✦</span>
      </h1>
      <div className="result-layout">
        <aside className="result-moment">
          <WebcamFrame compact />
          <p>
            {t("nice")} <Smile />
          </p>
          <Mascot />
        </aside>
        <section className="result-panel panel">
          <div className="result-game">
            <div className="result-thumbnail lime">
              <GameArt id="shoot" />
            </div>
            <div>
              <Sticker>{t(r.newBest ? "newBest" : "keepGoing")}</Sticker>
              <h2>{t("shoot")}</h2>
              <p>{t("shootDesc")}</p>
            </div>
          </div>
          <div className="result-stats">
            <div>
              <span className="pink">SCORE</span>
              <b>{r.score.toLocaleString()}</b>
            </div>
            <div>
              <span className="cyan">COMBO</span>
              <b>{r.combo}</b>
            </div>
            <div>
              <span className="lime">{t("accuracy")}</span>
              <b>
                {r.accuracy}
                <small>%</small>
              </b>
            </div>
          </div>
          <div className="best-comparison">
            <Crown fill="var(--yellow)" />
            <strong>{t("best")}</strong>
            <b>{records.best.toLocaleString()}</b>
          </div>
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
        </section>
        <aside className="result-side panel">
          <h3>
            <Trophy />
            {t("localTitle")}
          </h3>
          {[
            { key: "missionPlay", done: true },
            { key: "missionScore", done: r.score > 1000 },
            { key: "missionAccuracy", done: r.accuracy >= 80 && r.hits > 0 },
          ].map((m) => (
            <p key={m.key}>
              <span className={`mission-check ${m.done ? "done" : ""}`}>
                {m.done && <Check size={20} />}
              </span>
              {t(m.key)}
            </p>
          ))}
          <div className="personal-stat">
            <span>{t("plays", { count: records.plays })}</span>
            <Trophy />
            <b>{records.best.toLocaleString()}</b>
            <small>{t("best")}</small>
          </div>
          <p className="local-note">{t("localNote")}</p>
        </aside>
      </div>
      <div className="result-actions">
        <Button onClick={() => navigate("/play/shoot")}>
          <RotateCcw />
          {t("replay")}
        </Button>
        <Button color="cyan" onClick={() => navigate("/games")}>
          <Play />
          {t("next")}
        </Button>
        <Button color="white" onClick={() => navigate("/")}>
          <Home />
          {t("toHome")}
        </Button>
        <Button color="purple" onClick={() => navigate("/play/shoot")}>
          <Dice5 />
          {t("random")}
        </Button>
      </div>
    </>
  );
}
function SettingsDialog({
  close,
  motion,
  setMotion,
}: {
  close: () => void;
  motion: boolean;
  setMotion: (x: boolean) => void;
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
      <p>
        <Camera />
        {t("privacy")}
      </p>
      <Button onClick={close}>{t("close")}</Button>
    </dialog>
  );
}
function App() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [sound, setSound] = useState(() => read("arcade.sound", true));
  const [motion, setMotion] = useState(() => read("arcade.motion", false));
  const [settings, setSettings] = useState(false);
  const [records, setRecords] = useState<Records>(() => {
    const stored = read<Records>("arcade.records", emptyRecords);
    return typeof stored.best === "number" && typeof stored.plays === "number"
      ? { ...emptyRecords, ...stored }
      : emptyRecords;
  });
  const [storageError, setStorageError] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
  useEffect(() => {
    document.documentElement.dataset.motion = motion ? "reduced" : "full";
    save("arcade.motion", motion);
  }, [motion]);
  function tone(type = "click") {
    if (!sound) return;
    try {
      audio.current ??= new AudioContext();
      const ac = audio.current;
      void ac.resume();
      const oscillator = ac.createOscillator(),
        gain = ac.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        type === "fail"
          ? 140
          : type === "score"
            ? 740
            : type === "result"
              ? 880
              : 440,
        ac.currentTime,
      );
      oscillator.frequency.exponentialRampToValueAtTime(
        type === "fail" ? 70 : 1000,
        ac.currentTime + 0.1,
      );
      gain.gain.setValueAtTime(0.035, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(ac.destination);
      oscillator.start();
      oscillator.stop(ac.currentTime + 0.2);
    } catch {
      /* Sound is optional. */
    }
  }
  function finish(result: Result) {
    const next = {
      best: Math.max(records.best, result.score),
      plays: records.plays + 1,
      day: today(),
      daily: (records.day === today() ? records.daily : 0) + 1,
      last: result,
    };
    setRecords(next);
    setStorageError(!save("arcade.records", next));
  }
  function finishCircle(_result: CircleResult) {
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
      <div
        className={`app-shell screen-${pathname.startsWith("/play") ? "play" : pathname.startsWith("/result") ? "result" : pathname === "/games" ? "games" : "home"}`}
      >
        <ComicDecor />
        <Header
          onSettings={() => {
            window.dispatchEvent(new Event("arcade:pause"));
            setSettings(true);
          }}
          onSound={() => {
            setSound(!sound);
            save("arcade.sound", !sound);
          }}
        />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/games" element={<GamesPage />} />
            <Route
              path="/play/shoot"
              element={<PlayPage onFinish={finish} />}
            />
            <Route
              path="/play/circle"
              element={<CircleGamePage onFinish={finishCircle} />}
            />
            <Route path="/result/shoot" element={<ResultPage />} />
            <Route path="/result/circle" element={<CircleResultPage />} />
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
      {settings && (
        <SettingsDialog
          close={() => setSettings(false)}
          motion={motion}
          setMotion={setMotion}
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
    <BrowserRouter>
      <CameraProvider>
        <App />
      </CameraProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
