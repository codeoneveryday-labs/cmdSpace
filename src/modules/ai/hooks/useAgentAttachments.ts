import { useCallback, useEffect, useRef, useState } from "react";

export type AgentAttachment = {
  label: string;
  context: string;
  kind: "image" | "file" | "url";
  previewUrl?: string;
};

export function revokeAgentAttachmentPreviews(attachments: AgentAttachment[]) {
  for (const attachment of attachments) {
    if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }
}

export function useAgentAttachments() {
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const attachmentsRef = useRef<AgentAttachment[]>([]);
  attachmentsRef.current = attachments;

  useEffect(
    () => () => revokeAgentAttachmentPreviews(attachmentsRef.current),
    [],
  );

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const next = await Promise.all(
      Array.from(files)
        .slice(0, 8)
        .map(async (file): Promise<AgentAttachment> => {
          const localPath = (file as File & { path?: string }).path;
          if (file.type.startsWith("image/")) {
            return {
              label: file.name,
              kind: "image",
              previewUrl: URL.createObjectURL(file),
              context: localPath
                ? `Image file available at: ${localPath}`
                : `Image attachment selected: ${file.name}`,
            };
          }
          return {
            label: file.name,
            kind: "file",
            context: (await file.text()).slice(0, 50_000),
          };
        }),
    );
    setAttachments((current) => [...current, ...next]);
  }, []);

  const handleUrl = useCallback((label = "Attach URL") => {
    const url = window.prompt(label);
    if (!url?.trim()) return;
    setAttachments((current) => [
      ...current,
      {
        label: url.trim(),
        kind: "url",
        context: `URL reference: ${url.trim()}`,
      },
    ]);
  }, []);

  const clearAttachments = useCallback(() => {
    revokeAgentAttachmentPreviews(attachmentsRef.current);
    setAttachments([]);
  }, []);

  return {
    attachments,
    setAttachments,
    handleFiles,
    handleUrl,
    clearAttachments,
  };
}
