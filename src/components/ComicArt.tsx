const star = "M0,-22 7,-7 23,-5 12,7 15,23 0,15 -15,23 -12,7 -23,-5 -7,-7Z";
export function FutureArt({ pose = false }: { pose?: boolean }) {
  const path = pose
    ? "M133 91 110 125 77 108 61 72M114 119l41 18 39-30 24-47M137 125l-27 49-30 23M148 133l28 42 28 20"
    : "M147 87l-28 43-42-23-34-27M126 123l45 5 19-34M126 129l-34 40-42 5M131 139l29 34 34-13";
  return (
    <svg className="game-art" viewBox="0 0 260 220" aria-hidden="true">
      <path
        d={path}
        stroke="#111"
        strokeWidth="31"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={path}
        stroke="#fffbed"
        strokeWidth="21"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pose ? 150 : 157}
        cy="63"
        r="24"
        fill="#fffbed"
        stroke="#111"
        strokeWidth="5"
      />
      <path
        d={star}
        fill="#ffd927"
        stroke="#111"
        strokeWidth="3"
        transform="translate(41 41) scale(.6)"
      />
      {pose ? (
        <>
          <path
            d={star}
            fill="#fffbed"
            transform="translate(210 35) scale(.7)"
          />
          <path
            d={star}
            fill="#ff4fa3"
            transform="translate(40 150) scale(.5)"
          />
        </>
      ) : (
        <>
          <path
            d="m187 56 42-24m-28 38 43-15M22 112l36 14m-48 5 42 12"
            stroke="#34c8ff"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="m225 80 10-24 15 5-17 22Z"
            fill="#ff4fa3"
            stroke="#111"
            strokeWidth="3"
          />
        </>
      )}
    </svg>
  );
}
export function ComicDecor() {
  return (
    <svg
      className="comic-decor"
      viewBox="0 0 1600 920"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="comic-dots"
          width="22"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="5" cy="5" r="4" fill="#f5cd21" opacity=".7" />
          <circle cx="17" cy="15" r="2" fill="#f5cd21" />
        </pattern>
      </defs>
      <path
        d="M-20 179 1450 100 1640 196 1580 844 38 885Z"
        fill="#fff46b"
        opacity=".76"
      />
      <path
        d="M0 175 1600 118v166L0 338Zm0 515 1600-32v381L0 854Z"
        fill="url(#comic-dots)"
      />
      <path d="m0 555 1600-91v82L0 655Z" fill="#fffbed" />
      <path
        d="m-40 316 139 44-130 15 117 55-119-17m1530-197 72-95-26 118 67-51-32 91"
        stroke="#34c8ff"
        strokeWidth="24"
        fill="none"
        strokeLinecap="round"
      />
      <g fill="#ff4fa3">
        {[
          [430, 180, -32],
          [1530, 505, 32],
          [31, 774, 40],
          [980, 207, 10],
          [1480, 860, -20],
          [95, 527, 40],
        ].map(([x, y, r], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width="18"
            height="60"
            rx="7"
            transform={`rotate(${r} ${x} ${y})`}
          />
        ))}
      </g>
      <g fill="#a8ea39">
        {[
          [410, 800, -42],
          [1590, 650, 12],
          [30, 460, -30],
          [1190, 150, -30],
        ].map(([x, y, r], i) => (
          <rect
            key={i}
            x={x}
            y={y}
            width="16"
            height="45"
            rx="5"
            transform={`rotate(${r} ${x} ${y})`}
          />
        ))}
      </g>
      <g stroke="#111" strokeWidth="4" strokeLinejoin="round">
        {[
          [29, 203, "#ffd927", 0.8],
          [411, 316, "#34c8ff", 0.75],
          [1550, 824, "#ffd927", 1.2],
          [1080, 464, "#ff4fa3", 1],
          [430, 858, "#ffd927", 0.7],
          [25, 671, "#a8ea39", 1],
        ].map(([x, y, c, s], i) => (
          <path
            key={i}
            d={star}
            fill={c as string}
            transform={`translate(${x} ${y}) scale(${s})`}
          />
        ))}
      </g>
      <g transform="translate(1530 147) rotate(10)">
        <circle r="30" fill="#ffeb27" stroke="#111" strokeWidth="5" />
        <ellipse cx="-10" cy="-7" rx="4" ry="6" />
        <ellipse cx="10" cy="-7" rx="4" ry="6" />
        <path
          d="M-15 7q15 22 30 0"
          fill="none"
          stroke="#111"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function RangeScenery() {
  return (
    <svg
      className="range-scenery"
      viewBox="0 0 1000 650"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#22c5f5" />
          <stop offset="1" stopColor="#d8ffff" />
        </linearGradient>
        <linearGradient id="wood" x2="0" y2="1">
          <stop stopColor="#ecb36c" />
          <stop offset="1" stopColor="#bb783d" />
        </linearGradient>
        <pattern
          id="planks"
          width="86"
          height="260"
          patternUnits="userSpaceOnUse"
        >
          <rect width="86" height="260" fill="url(#wood)" />
          <path d="M2 0v260M78 0v260" stroke="#8e542b" strokeWidth="5" />
          <path
            d="M17 12v155m45-97v160M34 95v128"
            stroke="#f8c785"
            strokeWidth="3"
            opacity=".5"
          />
        </pattern>
      </defs>
      <path fill="url(#sky)" d="M0 0h1000v650H0Z" />
      <g fill="white">
        {[
          [60, 120, 1],
          [350, 215, 0.8],
          [870, 150, 1.5],
        ].map(([x, y, s], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
            <ellipse rx="110" ry="40" />
            <circle cx="-35" cy="-30" r="47" />
            <circle cx="20" cy="-35" r="64" />
            <circle cx="75" cy="-5" r="40" />
          </g>
        ))}
      </g>
      <path
        fill="#91cc69"
        d="M0 308q70-140 150 0 70-100 150-20 80-120 170-20 80-150 170 0 80-130 160-10 150-70 200 30v260H0Z"
      />
      <path
        fill="#55ae61"
        d="M0 360q90-125 155-25 140-130 250-13 80-80 150-10 100-100 200-10 130-105 245 0v300H0Z"
      />
      <path d="M80 220v325M913 220v325" stroke="#96613a" strokeWidth="24" />
      <path d="M75 220v325M907 220v325" stroke="#d39853" strokeWidth="12" />
      <path
        d="M82 238q410 110 830 0"
        fill="none"
        stroke="#724422"
        strokeWidth="3"
      />
      {Array.from({ length: 10 }, (_, i) => (
        <path
          key={i}
          d={`M${98 + i * 80} ${247 + Math.sin((i / 9) * Math.PI) * 50}l55 12-27 48Z`}
          fill={["#ff65a2", "#ffd94a", "#36c7f5"][i % 3]}
        />
      ))}
      <path
        d="M0 369h1000v281H0Z"
        fill="url(#planks)"
        stroke="#925e35"
        strokeWidth="7"
      />
      <path d="M0 408h1000M0 476h1000" stroke="#945727" strokeWidth="16" />
      <path d="M0 399h1000M0 466h1000" stroke="#eeb16c" strokeWidth="17" />
      <g fill="#286f45" stroke="#397844" strokeWidth="5">
        {[
          [15, 594],
          [969, 580],
          [76, 640],
          [880, 646],
        ].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle cx="-45" cy="-12" r="55" />
            <circle cx="5" cy="-38" r="70" />
            <circle cx="70" cy="5" r="55" />
          </g>
        ))}
      </g>
      <path
        d="M92 533h790v117H92Z"
        fill="url(#planks)"
        stroke="#754520"
        strokeWidth="7"
      />
      <path
        d="M74 512h833v34H74Z"
        fill="#efb570"
        stroke="#875326"
        strokeWidth="7"
      />
      <path d="M84 516h817" stroke="#ffd197" strokeWidth="7" />
      {Array.from({ length: 8 }, (_, i) => (
        <path
          key={i}
          d={`M${138 + i * 91} 548h65l-32 60Z`}
          fill={["#ffd947", "#ff6cac", "#33bcf0"][i % 3]}
        />
      ))}
      <g stroke="#654321" strokeWidth="6">
        <path d="M0 470 100 492 91 650H0Z" fill="#bd814b" />
        <path
          d="m3 486 82 17m-79 16 77 16M26 497l-4 153M57 501l-3 149"
          fill="none"
        />
        <path d="m961 460 39-15v205h-82Z" fill="#be874d" />
        <path d="m931 514 69-27m-75 71 75-25m-53-55-6 153" fill="none" />
      </g>
    </svg>
  );
}
