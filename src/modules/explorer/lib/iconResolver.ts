import materialTheme from "material-icon-theme/dist/material-icons.json";

type MaterialTheme = {
  file: string;
  folder: string;
  folderExpanded: string;
  fileNames: Record<string, string>;
  fileExtensions: Record<string, string>;
  folderNames: Record<string, string>;
  folderNamesExpanded: Record<string, string>;
  iconDefinitions: Record<string, { iconPath: string }>;
};

const theme = materialTheme as MaterialTheme;
const FILE_NAME_OVERRIDES: Record<string, string> = {
  "cargo.toml": "rust",
};
const iconModules = import.meta.glob(
  "../../../../node_modules/material-icon-theme/icons/*.svg",
  { eager: true, import: "default", query: "?url" },
) as Record<string, string>;

const iconUrls = new Map(
  Object.entries(iconModules).map(([path, url]) => [path.split("/").pop()!, url]),
);

function extensionOf(name: string): string {
  const dot = name.indexOf(".");
  return dot === -1 || dot === name.length - 1 ? "" : name.slice(dot + 1);
}

function urlFor(iconId: string): string | null {
  const iconPath = theme.iconDefinitions[iconId]?.iconPath;
  if (!iconPath) return null;
  return iconUrls.get(iconPath.split("/").pop()!) ?? null;
}

function fileIconId(name: string): string {
  if (FILE_NAME_OVERRIDES[name]) return FILE_NAME_OVERRIDES[name];
  if (theme.fileNames[name]) return theme.fileNames[name];

  let extension = extensionOf(name);
  while (extension) {
    if (theme.fileExtensions[extension]) return theme.fileExtensions[extension];
    const nextDot = extension.indexOf(".");
    if (nextDot === -1) break;
    extension = extension.slice(nextDot + 1);
  }

  return theme.file;
}

export function fileIconUrl(name: string): string {
  return urlFor(fileIconId(name.toLowerCase())) ?? urlFor(theme.file) ?? "";
}

export function folderIconUrl(name: string, expanded: boolean): string {
  const lower = name.toLowerCase();
  const iconId = expanded
    ? theme.folderNamesExpanded[lower] ?? theme.folderExpanded
    : theme.folderNames[lower] ?? theme.folder;
  return urlFor(iconId) ?? urlFor(expanded ? theme.folderExpanded : theme.folder) ?? "";
}
