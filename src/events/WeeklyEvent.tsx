import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X, PartyPopper, Play, Stamp } from "lucide-react";
import { Character } from "../components/Character";
import { readPlayer } from "../community/player";
import { weeklyEvent, nextKstMidnight, hideKey, eventProgress } from "./weekly";
import "./events.css";

function useEvent() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    const timer = setInterval(update, 60000);
    window.addEventListener("arcade:community", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("arcade:community", update);
    };
  }, []);
  return weeklyEvent();
}
function Article({ event }: { event: ReturnType<typeof weeklyEvent> }) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("ko") ? 0 : 1;
  const date = (n: number) =>
    new Intl.DateTimeFormat(lang === 0 ? "ko-KR" : "en-US", {
      timeZone: "Asia/Seoul",
      month: "short",
      day: "numeric",
    }).format(n);
  const remaining = Math.max(1, Math.ceil((event.end - Date.now()) / 86400000));
  return (
    <>
      <p className="event-eyebrow">
        <PartyPopper aria-hidden="true" />
        {lang === 0 ? "이번 주 이벤트" : "THIS WEEK"}
      </p>
      <h1>{event.title[lang]}</h1>
      <div className="event-illustration">
        <Character
          asset={event.game === "gate" ? "pose" : event.game}
          size="lg"
        />
        <b>{lang === 0 ? "같이 놀자!" : "LET’S PLAY!"}</b>
      </div>
      <p className="event-body">{event.body[lang]}</p>
      <p className="event-period">
        {date(event.start)} – {date(event.end - 1)} ·{" "}
        {lang === 0 ? `${remaining}일 남았어요` : `${remaining} days left`}
      </p>
    </>
  );
}
export function WeeklyEventPopup({ enabled }: { enabled: boolean }) {
  const event = useEvent(),
    dialog = useRef<HTMLDialogElement>(null),
    [hide, setHide] = useState(false);
  const { i18n } = useTranslation(),
    ko = i18n.language.startsWith("ko"),
    navigate = useNavigate();
  const seen = useRef(new Set<string>());
  const dismiss = () => {
    seen.current.add(event.id);
    try {
      sessionStorage.setItem(`arcade.event.seen.${event.id}`, "1");
      if (hide) localStorage.setItem(hideKey, String(nextKstMidnight()));
    } catch {}
    dialog.current?.close();
  };
  useEffect(() => {
    if (!enabled) {
      dialog.current?.close();
      return;
    }
    const check = () => {
      if (
        !readPlayer() ||
        seen.current.has(event.id) ||
        dialog.current?.open ||
        document.querySelector("dialog[open]")
      )
        return;
      try {
        if (
          sessionStorage.getItem(`arcade.event.seen.${event.id}`) ||
          Number(localStorage.getItem(hideKey)) > Date.now()
        )
          return;
      } catch {}
      dialog.current?.showModal();
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    const timer = setTimeout(check, 400);
    window.addEventListener("arcade:player", check);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("arcade:player", check);
    };
  }, [enabled, event.id]);
  return (
    <dialog
      ref={dialog}
      className="event-popup"
      aria-label={ko ? "이번 주 이벤트" : "Weekly event"}
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
    >
      <button
        className="event-close"
        aria-label={ko ? "닫기" : "Close"}
        onClick={dismiss}
      >
        <X />
      </button>
      <Article event={event} />
      <div className="event-popup-actions">
        <button
          className="arcade-button pink"
          onClick={() => {
            dismiss();
            navigate("/events");
          }}
        >
          <Play />
          {ko ? "플레이하기" : "Play"}
        </button>
        <label>
          <input
            type="checkbox"
            checked={hide}
            onChange={(e) => setHide(e.target.checked)}
          />
          {ko ? "오늘 하루 보지 않기" : "Don't show again today"}
        </label>
      </div>
    </dialog>
  );
}
export function EventsPage() {
  const event = useEvent(),
    { i18n } = useTranslation(),
    ko = i18n.language.startsWith("ko"),
    values = eventProgress(event);
  const labels = [
    ko ? "서로 다른 게임 3종 완료" : "Finish 3 different games",
    ko ? "이번 주 게임 5회 완료" : "Finish 5 games this week",
    event.label[ko ? 0 : 1],
  ];
  return (
    <section className="events-page panel">
      <Article event={event} />
      <h2>{ko ? "이번 주 미션" : "Weekly missions"}</h2>
      <p>
        {ko
          ? "이 기기의 이번 주 플레이 기록으로 진행돼요."
          : "Progress uses this device's games from this week."}
      </p>
      <div className="event-missions">
        {labels.map((label, i) => (
          <article key={label}>
            <h3>{label}</h3>
            <progress aria-label={label} value={values[i]} max={[3, 5, 1][i]} />
            <strong>
              {values[i]} / {[3, 5, 1][i]}
            </strong>
            <Link
              className="arcade-button cyan"
              to={i === 2 ? event.href : "/games"}
            >
              {ko ? "플레이하기" : "Play"} →
            </Link>
          </article>
        ))}
      </div>
      <div
        className={`event-stamp ${values.every((v, i) => v >= [3, 5, 1][i]) ? "earned" : ""}`}
      >
        <Stamp />
        <strong>
          {values.every((v, i) => v >= [3, 5, 1][i])
            ? ko
              ? "이번 주 스탬프 획득!"
              : "Weekly stamp earned!"
            : ko
              ? "세 미션을 깨고 이번 주 스탬프를 모아봐요!"
              : "Complete all three missions to earn this week's stamp!"}
        </strong>
      </div>
    </section>
  );
}
