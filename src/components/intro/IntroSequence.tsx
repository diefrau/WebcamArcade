import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX, ArrowRight } from "lucide-react";
import { characterAssets } from "../../assets/characters";
import { EntryGate } from "./EntryGate";
import { CountdownIntro } from "./CountdownIntro";
import { TitleCard } from "./TitleCard";
import { introPhaseAt, titleVisible, type IntroPhase } from "./timeline";
import "./intro.css";

export function IntroSequence({
  onStart,
  onPhase,
  onComplete,
  sound,
  onSound,
  onHover,
}: {
  onStart: () => void;
  onPhase: (phase: IntroPhase) => void;
  onComplete: (skipped: boolean) => void;
  sound: boolean;
  onSound: () => void;
  onHover: () => void;
}) {
  const { i18n } = useTranslation();
  const ko = i18n.language.startsWith("ko");
  const [phase, setPhase] = useState<IntroPhase>("entry");
  const phaseRef = useRef(phase);
  const elapsed = useRef(0);
  const finished = useRef(false);
  const callbacks = useRef({ onStart, onPhase, onComplete });
  callbacks.current = { onStart, onPhase, onComplete };
  const skipButton = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLElement>(null);
  const finish = useCallback((skipped = true) => {
    if (finished.current) return;
    finished.current = true;
    callbacks.current.onComplete(skipped);
  }, []);
  const start = useCallback(() => {
    if (phaseRef.current !== "entry" || finished.current) return;
    callbacks.current.onStart();
    phaseRef.current = "blank";
    setPhase("blank");
    skipButton.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.intro = "active";
    const image = new Image();
    image.src = characterAssets.landing.src;
    return () => {
      document.body.style.overflow = previous;
      delete document.documentElement.dataset.intro;
    };
  }, []);
  useEffect(() => {
    callbacks.current.onPhase(phase);
  }, [phase]);
  const running = phase !== "entry";
  useEffect(() => {
    if (!running) return;
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      if (finished.current) return;
      if (!document.hidden) elapsed.current += Math.max(0, now - last);
      last = now;
      const next = introPhaseAt(elapsed.current);
      if (next === "complete") {
        finish(false);
        return;
      }
      if (next !== phaseRef.current) {
        phaseRef.current = next;
        setPhase(next);
      }
      raf = requestAnimationFrame(tick);
    };
    const visibility = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [running, finish]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish();
      } else if (
        ["Enter", " "].includes(event.key) &&
        !(event.target as Element)?.closest("[data-intro-control]")
      ) {
        event.preventDefault();
        event.stopPropagation();
        phaseRef.current === "entry" ? start() : finish();
      } else if (event.key === "Tab") {
        const buttons = Array.from(
          root.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
        );
        const first = buttons[0],
          last = buttons.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keys, true);
    return () => document.removeEventListener("keydown", keys, true);
  }, [finish, start]);
  const fading = phase === "fade" || phase === "reveal";
  return createPortal(
    <section
      ref={root}
      className={
        "intro-sequence intro-phase-" + phase + (fading ? " is-dissolving" : "")
      }
      role="dialog"
      aria-modal="true"
      aria-label={ko ? "WEBCAM ARCADE 입장" : "Enter WEBCAM ARCADE"}
      data-phase={phase}
      onPointerOver={(event) => {
        if (event.pointerType !== "mouse") return;
        const button = (event.target as Element).closest("button");
        if (
          button &&
          (!(event.relatedTarget instanceof Node) ||
            !button.contains(event.relatedTarget))
        )
          onHover();
      }}
      onClick={() => {
        if (phase !== "entry") finish();
      }}
    >
      <div className="intro-confetti" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      {phase === "entry" ? (
        <EntryGate start={start} />
      ) : titleVisible(phase) ? (
        <TitleCard />
      ) : (
        <CountdownIntro phase={phase} />
      )}
      {phase === "flash" && <div className="intro-wipe" aria-hidden="true" />}
      <button
        className="intro-sound"
        data-intro-control
        data-sound="none"
        aria-label={
          ko
            ? sound
              ? "사운드 끄기"
              : "사운드 켜기"
            : sound
              ? "Mute sound"
              : "Enable sound"
        }
        onClick={(event) => {
          event.stopPropagation();
          onSound();
        }}
      >
        {sound ? (
          <Volume2 aria-hidden="true" />
        ) : (
          <VolumeX aria-hidden="true" />
        )}
      </button>
      <button
        ref={skipButton}
        className="intro-skip"
        data-intro-control
        data-sound="none"
        aria-label={ko ? "인트로 건너뛰기" : "Skip intro"}
        onClick={(event) => {
          event.stopPropagation();
          finish();
        }}
      >
        SKIP <ArrowRight aria-hidden="true" />
      </button>
    </section>,
    document.body,
  );
}
