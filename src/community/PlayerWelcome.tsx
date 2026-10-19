import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloudCheck, CloudOff, Star, UserRound } from "lucide-react";
import { communityConfigured, getSyncState, syncRuns } from "./client";
import { playerName, readPlayer, selectPlayer } from "./player";
import "./player.css";

// Keep pending results moving even when the player leaves the home screen.
export function PlayerSession() {
  useEffect(() => {
    const sync = () => {
      void syncRuns().catch(() => {});
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("arcade:player", sync);
    const timer = window.setInterval(() => {
      if (readPlayer() && getSyncState() === "offline") sync();
    }, 30000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("arcade:player", sync);
      clearInterval(timer);
    };
  }, []);
  return null;
}

export function PlayerWelcome() {
  const { i18n } = useTranslation();
  const text = (ko: string, en: string) =>
    i18n.language.startsWith("ko") ? ko : en;
  const [player, setPlayer] = useState(readPlayer);
  const [sync, setSync] = useState(getSyncState);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(player?.nickname || "");
  const dialog = useRef<HTMLDialogElement>(null);
  const open = !player || editing;
  useEffect(() => {
    const changed = () => setPlayer(readPlayer());
    const synced = () => setSync(getSyncState());
    window.addEventListener("arcade:player", changed);
    window.addEventListener("arcade:sync", synced);
    return () => {
      window.removeEventListener("arcade:player", changed);
      window.removeEventListener("arcade:sync", synced);
    };
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const start = (name: string) => {
    selectPlayer(name);
    setPlayer(readPlayer());
    setEditing(false);
  };
  return (
    <>
      {player && (
        <section
          className="player-strip"
          aria-label={text("내 플레이어", "My player")}
        >
          <UserRound aria-hidden="true" />
          <strong>{playerName(player)}</strong>
          <span role="status">
            {sync === "offline" ? (
              <CloudOff aria-hidden="true" />
            ) : (
              <CloudCheck aria-hidden="true" />
            )}
            {text(
              !communityConfigured
                ? "이 기기에 저장 중"
                : sync === "offline"
                  ? "기기에 저장됨 · 연결되면 자동 동기화"
                  : sync === "synced"
                    ? "동기화 완료"
                    : "자동 동기화 중…",
              !communityConfigured
                ? "Saved on this device"
                : sync === "offline"
                  ? "Saved here · will sync when connected"
                  : sync === "synced"
                    ? "Synced"
                    : "Syncing automatically…",
            )}
          </span>
          <button
            disabled={sync === "syncing"}
            onClick={() => {
              setNickname(player.nickname);
              setEditing(true);
            }}
          >
            {text("이름 변경", "Edit name")}
          </button>
        </section>
      )}
      <dialog
        ref={dialog}
        className="player-dialog panel"
        aria-labelledby="player-title"
        onCancel={(event) => {
          if (!player) event.preventDefault();
          else setEditing(false);
        }}
      >
        <div className="player-dialog-badge">
          <Star aria-hidden="true" />
        </div>
        <h2 id="player-title">
          <span className="yellow-text">
            {text("어떤 이름으로 놀까?", "What's your player name?")}
          </span>
        </h2>
        <p>
          {text(
            "닉네임을 정하거나, 나만의 익명 이름으로 시작해요!",
            "Pick a nickname or start with your own anonymous name!",
          )}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (nickname.trim()) start(nickname);
          }}
        >
          <label htmlFor="player-nickname">{text("닉네임", "Nickname")}</label>
          <input
            id="player-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={16}
            required
            autoFocus
            autoComplete="off"
            placeholder={text("최대 16자", "Up to 16 characters")}
          />
          <button className="arcade-button pink" disabled={!nickname.trim()}>
            {text("이 이름으로 시작!", "Play with this name!")}
          </button>
          <button
            type="button"
            className="arcade-button lime"
            onClick={() => start("")}
          >
            {text("익명으로 시작", "Play anonymously")}
          </button>
        </form>
        <small>
          {text(
            "이름과 게임 기록이 공개 랭킹에 표시돼요. 완료한 게임은 자동으로 동기화돼요.",
            "Your name and results appear on the public leaderboard. Completed games sync automatically.",
          )}
        </small>
        {editing && (
          <button className="player-cancel" onClick={() => setEditing(false)}>
            {text("취소", "Cancel")}
          </button>
        )}
      </dialog>
    </>
  );
}
