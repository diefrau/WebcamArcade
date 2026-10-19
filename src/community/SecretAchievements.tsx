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
    <section className="secret-section" aria-labelledby="secret-heading">
      <h2 id="secret-heading">
        <Sparkles aria-hidden="true" />
        {lang === 0 ? "비밀 도전과제" : "Secret achievements"}
      </h2>
      <p>
        {lang === 0
          ? "PC 홈에서 웹캠을 켜고, 손과 표정으로 숨겨진 순간을 찾아보세요."
          : "Turn on your webcam on the desktop home screen. Discover hidden moments with hands and expressions."}
      </p>
      <div className="secret-grid">
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
              <h3>{complete ? secretDescriptions[id].name[lang] : "???"}</h3>
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
      </div>
    </section>
  );
}
