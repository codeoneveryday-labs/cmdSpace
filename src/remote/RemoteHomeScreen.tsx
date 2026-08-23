import {
  DiscordIcon,
  FolderAddIcon,
  GithubIcon,
  HeartAddIcon,
  InboxIcon,
  Plug01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type RemoteHomeScreenProps = {
  onAddProject: () => void;
  onImportSession: () => void;
  onSetupProviders: () => void;
};

type ActionCard = {
  icon: typeof FolderAddIcon;
  title: string;
  description: string;
  accent: string;
  key?: string;
  disabled?: boolean;
};

const ACTION_CARDS: ActionCard[] = [
  {
    icon: FolderAddIcon,
    title: "Add a project",
    description: "Open a folder on your machine",
    accent: "#2ea043",
  },
  {
    icon: InboxIcon,
    title: "Import session",
    description: "Bring in recent external CLI sessions",
    accent: "#58a6ff",
    key: "import",
  },
  {
    icon: Plug01Icon,
    title: "Setup providers",
    description: "Configure Claude Code, Codex, and more",
    accent: "#d29922",
    key: "providers",
  },
];

const FOOTER_LINKS = [
  { icon: GithubIcon, label: "Star" },
  { icon: HeartAddIcon, label: "Sponsor" },
  { icon: DiscordIcon, label: "Community" },
];

export function RemoteHomeScreen({
  onAddProject,
  onImportSession,
  onSetupProviders,
}: RemoteHomeScreenProps) {
  const handleCardClick = (card: ActionCard) => {
    if (card.key === "import") onImportSession();
    else if (card.key === "providers") onSetupProviders();
    else onAddProject();
  };

  return (
    <main className="remote-home-screen">
      <header className="remote-home-header">
        <button type="button" className="remote-home-menu" aria-label="Menu">
          <span />
          <span />
          <span />
        </button>
        <img src="/logo.png" alt="cmdSpace" className="remote-home-logo" />
        <span className="remote-home-header-spacer" />
      </header>

      <section className="remote-home-actions">
        {ACTION_CARDS.map((card) => (
          <button
            key={card.title}
            type="button"
            className="remote-home-card"
            style={{ "--remote-accent": card.accent } as React.CSSProperties}
            onClick={() => handleCardClick(card)}
            disabled={card.disabled}
          >
            <span className="remote-home-card-icon">
              <HugeiconsIcon icon={card.icon} size={22} />
            </span>
            <span className="remote-home-card-body">
              <strong>{card.title}</strong>
              <small>{card.description}</small>
            </span>
          </button>
        ))}
      </section>

      <footer className="remote-home-footer">
        {FOOTER_LINKS.map((link) => (
          <button key={link.label} type="button" className="remote-home-footer-link">
            <HugeiconsIcon icon={link.icon} size={15} />
            <span>{link.label}</span>
          </button>
        ))}
      </footer>
    </main>
  );
}
