import type { ProviderId } from "@/modules/ai/config";
import { BrandIcon } from "@/components/BrandIcon";
import { getProviderBrandIcon } from "@/components/brandIcons";
import {
  AiAudioIcon,
  AiCloudIcon,
  AiVoiceIcon,
  ChatGptIcon,
  CloudIcon,
  CloudServerIcon,
  FlashIcon,
  FileAudioIcon,
  CpuIcon,
  GlobeIcon,
  GoogleIcon,
  AmazonIcon,
  MicrosoftIcon,
  MicIcon,
  RobotIcon,
  SpeechIcon,
  VoiceIcon,
  DatabaseIcon,
  AudioWaveIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const ICON_BY_PROVIDER = {
  openai: ChatGptIcon,
  deepgram: AudioWaveIcon,
  google: GoogleIcon,
  assemblyai: AiAudioIcon,
  speechmatics: SpeechIcon,
  elevenlabs: VoiceIcon,
  aws: AmazonIcon,
  azure: MicrosoftIcon,
  gladia: CloudIcon,
  soniox: MicIcon,
  groq: FlashIcon,
  inworld: RobotIcon,
  rev: FileAudioIcon,
  verbit: SpeechIcon,
  nuance: AiVoiceIcon,
  ibm: DatabaseIcon,
  cloudflare: CloudServerIcon,
  fireworks: AiCloudIcon,
  together: GlobeIcon,
  replicate: DatabaseIcon,
  nvidia: CpuIcon,
  "fish-audio": VoiceIcon,
} as const satisfies Record<ProviderId, typeof ChatGptIcon>;

type Props = {
  provider: ProviderId;
  size?: number;
  className?: string;
};

export function ProviderIcon({ provider, size = 12, className }: Props) {
  const brandIcon = getProviderBrandIcon(provider);
  if (brandIcon) {
    return <BrandIcon name={brandIcon} size={size} className={className} />;
  }

  return (
    <HugeiconsIcon
      icon={ICON_BY_PROVIDER[provider]}
      size={size}
      strokeWidth={1.75}
      className={className}
    />
  );
}
