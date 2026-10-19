import { LockKeyhole, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { secretDescriptions, secretIds, type SecretId } from "./secrets";
import "./secrets.css";
export function SecretAchievements({
  unlocked = {},
}: {
  unlocked?: Partial<Record<SecretId, boolean>>;
}) {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith("ko") ? 0 : 1;
  return (
    <>
      {secretIds.map((id) => {
        const complete = unlocked[id] === true;
        return (
          <article
            key={id}
            className={`panel achievement secret-achievement ${complete ? "unlocked" : "secret-locked"}`}
          >
            {complete ? (
              <Sparkles aria-hidden="true" />
            ) : (
              <LockKeyhole aria-hidden="true" />
            )}
            <h2>{complete ? secretDescriptions[id].name[lang] : "???"}</h2>
            {complete && <p>{secretDescriptions[id].detail[lang]}</p>}
            <strong>
              {complete
                ? lang === 0
                  ? "비밀 발견!"
                  : "Secret found!"
                : lang === 0
                  ? "미발견"
                  : "Undiscovered"}
            </strong>
          </article>
        );
      })}
    </>
  );
}
