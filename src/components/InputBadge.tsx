import { Hand, Smile, PersonStanding } from "lucide-react";
import { useTranslation } from "react-i18next";
import { inputKind } from "./input-coach-data";
import type { GameId } from "../community/store";
import "./input-coach.css";
export function InputBadge({
  game,
  kind: given,
}: {
  game?: GameId;
  kind?: "hand" | "face" | "body";
}) {
  const { i18n } = useTranslation();
  const kind = given || (game ? inputKind[game] : "hand");
  const ko = i18n.language.startsWith("ko");
  const Icon =
    kind === "hand" ? Hand : kind === "face" ? Smile : PersonStanding;
  const label =
    kind === "hand"
      ? ko
        ? "손"
        : "Hand"
      : kind === "face"
        ? ko
          ? "얼굴"
          : "Face"
        : ko
          ? "몸"
          : "Body";
  return (
    <span
      className="input-badge"
      aria-label={`${ko ? "웹캠 입력" : "Webcam input"}: ${label}`}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  );
}
