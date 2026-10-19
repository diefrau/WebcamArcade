import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useCamera } from "../vision/CameraProvider";
import { HomeSecretDetector } from "../vision/homeSecrets";
import { unlockSecret } from "./client";
import { secretDescriptions, type SecretId } from "./secrets";
import "./secrets.css";
export function HomeEasterEggs() {
  const camera = useCamera();
  const { i18n } = useTranslation();
  const detector = useRef(new HomeSecretDetector());
  const [reward, setReward] = useState<SecretId | null>(null);
  useEffect(() => {
    const reset = () => detector.current.reset();
    document.addEventListener("visibilitychange", reset);
    return () => {
      document.removeEventListener("visibilitychange", reset);
      reset();
    };
  }, []);
  useEffect(() => {
    if (
      !camera.homeTracking ||
      camera.state !== "ready" ||
      camera.vision !== "ready" ||
      !camera.homeMotion ||
      document.hidden
    ) {
      detector.current.reset();
      return;
    }
    for (const id of detector.current.update(camera.homeMotion))
      if (unlockSecret(id)) setReward(id);
  }, [camera.homeMotion, camera.homeTracking, camera.state, camera.vision]);
  useEffect(() => {
    if (!reward) return;
    const timer = setTimeout(() => setReward(null), 5500);
    return () => clearTimeout(timer);
  }, [reward]);
  if (!reward) return null;
  const language = i18n.language.startsWith("ko") ? 0 : 1;
  return (
    <aside className="secret-toast" role="status" key={reward}>
      <Sparkles aria-hidden="true" />
      <div>
        <small>
          {language === 0
            ? "비밀 도전과제 발견!"
            : "Secret achievement discovered!"}
        </small>
        <strong>{secretDescriptions[reward].name[language]}</strong>
      </div>
    </aside>
  );
}
