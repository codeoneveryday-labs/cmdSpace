const VOICE_ACTIVITY_FLOOR = 0.03;

export function hasDetectedVoiceActivity(level: number): boolean {
  return Number.isFinite(level) && level >= VOICE_ACTIVITY_FLOOR;
}
