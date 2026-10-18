import { useEffect, useState } from "react";
export function readInputEnvironment() {
  const touch = navigator.maxTouchPoints > 0;
  const coarse = matchMedia("(pointer: coarse)").matches;
  return { touch, compactTouch: touch && (coarse || innerWidth <= 900) };
}
export function useInputEnvironment() {
  const [input, setInput] = useState(readInputEnvironment);
  useEffect(() => {
    const query = matchMedia("(pointer: coarse)");
    const update = () => setInput(readInputEnvironment());
    window.addEventListener("resize", update);
    query.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      query.removeEventListener("change", update);
    };
  }, []);
  return input;
}
export function InputEnvironment() {
  const input = useInputEnvironment();
  useEffect(() => {
    document.documentElement.dataset.input = input.compactTouch
      ? "touch"
      : "pointer";
    document.documentElement.dataset.touch = String(input.touch);
  }, [input.touch, input.compactTouch]);
  return null;
}
