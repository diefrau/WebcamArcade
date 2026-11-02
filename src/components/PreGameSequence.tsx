import type { ReactNode } from "react";
import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Character } from "./Character";
import type { CharacterAsset } from "../assets/characters";
export function PreGameSequence({
  title,
  instruction,
  area,
  character,
  ready,
  onStart,
  children,
  autoStartLabel,
}: {
  title: string;
  instruction: string;
  area: string;
  character: CharacterAsset;
  ready: boolean;
  onStart: () => void;
  children?: ReactNode;
  autoStartLabel?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="game-overlay">
      <section className="game-dialog panel">
        <Character asset={character} size="sm" priority />
        <span className="cham-sticker">READY?</span>
        <h2>{title}</h2>
        <p>{instruction}</p>
        <small>{area}</small>
        {children}
        {autoStartLabel ? (
          <p role="status">{autoStartLabel}</p>
        ) : (
          <button
            className="arcade-button pink"
            disabled={!ready}
            onClick={onStart}
          >
            <Play />
            {t("go")}
          </button>
        )}
      </section>
    </div>
  );
}
