export const musicTracks = {
  title: {
    url: new URL("../assets/audio/bgm/WebArcMainTitle.mp3", import.meta.url)
      .href,
    gain: 0.9,
  },
  bounce: {
    url: new URL("../assets/audio/bgm/WebArcBounce.mp3", import.meta.url).href,
    gain: 0.75,
  },
  quick: {
    url: new URL("../assets/audio/bgm/WebArcQS.mp3", import.meta.url).href,
    gain: 0.7,
  },
  leisure: {
    url: new URL("../assets/audio/bgm/WebArcLTR.mp3", import.meta.url).href,
    gain: 0.8,
  },
} as const;
export type MusicTrack = keyof typeof musicTracks;
export function musicForPath(path: string): MusicTrack {
  const game = path.match(/^\/(?:play|result)\/([^/]+)/)?.[1];
  return game === "circle"
    ? "leisure"
    : game === "cham" || game === "dodge"
      ? "quick"
      : game === "shoot" || game === "rps"
        ? "bounce"
        : "title";
}
