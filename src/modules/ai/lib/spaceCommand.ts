export type SpaceCommand = {
  kind: "play-music";
  query: string;
};

export function parseSpaceCommand(transcript: string): SpaceCommand | null {
  const request = transcript.replace(/\s+/g, " ").trim();
  if (!/\bspace\b/i.test(request)) return null;
  if (!/\b(?:music|song|playlist)\b/i.test(request)) return null;
  if (!/\b(?:terminal|tab)\b/i.test(request)) return null;

  const play = /\bplay\s+(.+?)(?:\s+(?:please|for me|thanks?))?[.!?]*$/i.exec(request);
  if (!play) return null;
  const query = play[1].replace(/^(?:a|an|the|some)\s+/i, "").trim();
  return query ? { kind: "play-music", query } : null;
}
