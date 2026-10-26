import type { GameId } from "../community/store";
import { Hand, Target, Smile, MoveHorizontal } from "lucide-react";
export function InputDemo({ game }: { game: GameId }) {
  return (
    <svg
      className={`input-demo demo-${game}`}
      viewBox="0 0 320 86"
      aria-hidden="true"
    >
      {game === "shoot" ? (
        <>
          <path className="demo-guide" d="M80 44H232" />
          <path d="m218 34 16 10-16 10" className="demo-guide" />
          <g className="demo-hand">
            <Hand x="28" y="20" width="50" height="50" />
          </g>
          <Target
            x="236"
            y="16"
            width="58"
            height="58"
            className="demo-target"
          />
          <circle className="demo-bullet" cx="96" cy="44" r="7" />
        </>
      ) : game === "circle" ? (
        <>
          <circle className="demo-guide" cx="162" cy="43" r="32" />
          <circle className="demo-draw" cx="162" cy="43" r="32" />
          <g className="demo-draw-hand">
            <Hand x="135" y="1" width="34" height="34" />
          </g>
          <circle className="demo-open-point" cx="246" cy="43" r="8" />
        </>
      ) : game === "cham" ? (
        <>
          <path
            className="demo-guide"
            d="m86 32-18 12 18 12m148-24 18 12-18 12"
          />
          <g className="demo-face">
            <Smile x="134" y="16" width="52" height="52" />
            <circle cx="160" cy="45" r="3" />
          </g>
        </>
      ) : game === "rps" ? (
        <>
          {["✊", "✋", "✌"].map((symbol, i) => (
            <g className={`demo-rps-step step-${i}`} key={symbol}>
              <circle cx={80 + i * 80} cy="42" r="29" />
              <text x={80 + i * 80} y="54" textAnchor="middle" fontSize="33">
                {symbol}
              </text>
            </g>
          ))}
        </>
      ) : (
        <>
          <path className="demo-guide" d="M48 69H272" />
          <MoveHorizontal x="140" y="4" width="40" height="25" />
          <g className="demo-body">
            <circle cx="160" cy="37" r="10" />
            <path d="M160 47v20m-19-12 19-7 19 7" />
            <rect x="143" y="70" width="34" height="11" rx="5" />
          </g>
        </>
      )}
    </svg>
  );
}
