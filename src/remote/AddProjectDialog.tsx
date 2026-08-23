import {
  FolderAddIcon,
  GithubIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";

type AddProjectDialogProps = {
  hostname: string;
  onClose: () => void;
  onSearchDirectory: () => void;
};

type AddProjectMethod = {
  icon: typeof Search01Icon;
  title: string;
  description: string;
  accent: string;
  onClick: () => void;
  disabled?: boolean;
};

export function AddProjectDialog({
  hostname,
  onClose,
  onSearchDirectory,
}: AddProjectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [methods, setMethods] = useState<AddProjectMethod[]>([]);

  useEffect(() => {
    const noop = () => {};
    const methods: AddProjectMethod[] = [
      {
        icon: Search01Icon,
        title: "Search for directory",
        description: `Find a directory on ${hostname || "this machine"}`,
        accent: "#58a6ff",
        onClick: onSearchDirectory,
      },
      {
        icon: GithubIcon,
        title: "Clone from GitHub",
        description: "Search projects available to your GitHub account",
        accent: "#2ea043",
        onClick: noop,
        disabled: true,
      },
      {
        icon: FolderAddIcon,
        title: "New directory",
        description: `Create an empty directory on ${hostname || "this machine"}`,
        accent: "#d29922",
        onClick: noop,
        disabled: true,
      },
    ];
    setMethods(methods);
  }, [hostname, onSearchDirectory]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredMethods = normalizedQuery
    ? methods.filter((method) =>
        `${method.title} ${method.description}`.toLowerCase().includes(normalizedQuery),
      )
    : methods;

  return (
    <div className="remote-modal-backdrop" onClick={onClose}>
      <section
        className="remote-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Add project"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="remote-modal-header">
          <h2>Add project{hostname ? ` ${hostname}` : ""}</h2>
          <button type="button" className="remote-modal-close" aria-label="Close" onClick={onClose}>×</button>
        </header>

        <label className="remote-modal-search">
          <HugeiconsIcon icon={Search01Icon} size={16} />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search methods..."
            aria-label="Search methods"
            autoFocus
          />
        </label>

        <div className="remote-modal-methods">
          {filteredMethods.map((method) => (
            <button
              key={method.title}
              type="button"
              className="remote-modal-method"
              onClick={method.onClick}
              disabled={method.disabled}
            >
              <span className="remote-modal-method-icon" style={{ color: method.accent }}>
                <HugeiconsIcon icon={method.icon} size={20} />
              </span>
              <span className="remote-modal-method-body">
                <strong>{method.title}</strong>
                <small>{method.description}</small>
              </span>
            </button>
          ))}
          {filteredMethods.length === 0 ? (
            <p className="remote-modal-empty">No matching methods.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
