import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useChat, type UIMessage } from "@ai-sdk/react";
import {
  Add01Icon,
  AiChat02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  CodeIcon,
  Delete02Icon,
  Key01Icon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMemo } from "react";
import { AgentSwitcher } from "./AgentSwitcher";
import { AiChatView } from "./AiChat";
import { AiInputBar, AiInputBarConnect } from "./AiInputBar";
import { TodoStrip } from "./TodoStrip";
import { useComposer } from "../lib/composer";
import { getOrCreateChat, useChatStore } from "../store/chatStore";

type Props = {
  hasComposer: boolean;
  onConnectProvider: () => void;
};

export function AiSidebarHelper({ hasComposer, onConnectProvider }: Props) {
  const sessionId = useChatStore((s) => s.activeSessionId);

  return (
    <section className="flex h-full min-h-0 flex-col bg-card">
      {sessionId ? (
        <HelperBody
          sessionId={sessionId}
          hasComposer={hasComposer}
          onConnectProvider={onConnectProvider}
        />
      ) : (
        <HelperLoading onConnectProvider={onConnectProvider} />
      )}
    </section>
  );
}

function HelperBody({
  sessionId,
  hasComposer,
  onConnectProvider,
}: {
  sessionId: string;
  hasComposer: boolean;
  onConnectProvider: () => void;
}) {
  const chat = useMemo(() => getOrCreateChat(sessionId), [sessionId]);
  const helpers = useChat<UIMessage>({ chat });
  const newSession = useChatStore((s) => s.newSession);
  const sessions = useChatStore((s) => s.sessions);
  const activeSession = sessions.find((session) => session.id === sessionId);
  const canCreateNewSession = activeSession?.title !== "New chat";
  const switchSession = useChatStore((s) => s.switchSession);
  const deleteSession = useChatStore((s) => s.deleteSession);
  const step = useChatStore((s) => s.agentMeta.step);
  const isBusy =
    helpers.status === "submitted" || helpers.status === "streaming";

  return (
    <>
      <HelperHeader
        isBusy={isBusy}
        step={step}
        sessionTitle={activeSession?.title ?? "New chat"}
        sessions={sessions}
        activeSessionId={sessionId}
        onNewSession={() => newSession()}
        canCreateNewSession={canCreateNewSession}
        onSwitchSession={switchSession}
        onDeleteSession={deleteSession}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden [&_.text-sm]:text-[12px] [&_p]:leading-relaxed">
        {helpers.messages.length === 0 ? (
          <HelperEmptyState />
        ) : (
          <AiChatView
            messages={helpers.messages}
            status={helpers.status}
            error={helpers.error}
            clearError={helpers.clearError}
            addToolApprovalResponse={helpers.addToolApprovalResponse}
            stop={helpers.stop}
          />
        )}
      </div>
      <TodoStrip sessionId={sessionId} />
      {hasComposer ? (
        <AiInputBar
          openMiniOnSubmit={false}
          showAgentSwitcher={false}
          isBusy={isBusy}
          onStop={helpers.stop}
        />
      ) : (
        <AiInputBarConnect onAdd={onConnectProvider} />
      )}
    </>
  );
}

function HelperHeader({
  isBusy,
  step,
  sessionTitle,
  sessions,
  activeSessionId,
  onNewSession,
  canCreateNewSession,
  onSwitchSession,
  onDeleteSession,
}: {
  isBusy: boolean;
  step: string | null;
  sessionTitle: string;
  sessions: { id: string; title: string; updatedAt: number }[];
  activeSessionId: string;
  onNewSession: () => void;
  canCreateNewSession: boolean;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3">
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-foreground">
          <HugeiconsIcon icon={AiChat02Icon} size={14} strokeWidth={1.85} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-foreground">
            Helper
          </div>
          <div className="truncate text-[10.5px] text-muted-foreground">
            Terminal-aware AI
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {isBusy ? (
          <div className="flex max-w-30 items-center gap-1 text-[10.5px] text-muted-foreground">
            <Spinner className="size-2.5" />
            <span className="truncate">{step ?? "Thinking..."}</span>
          </div>
        ) : null}
        <AgentSwitcher isMiniWindow />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-w-32 gap-1 px-1.5 text-[10.5px] font-medium"
              title="Helper chat history"
            >
              <span className="truncate">{sessionTitle}</span>
              <HugeiconsIcon icon={ArrowDown01Icon} size={12} strokeWidth={1.8} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {sessions.map((session) => (
              <DropdownMenuItem
                key={session.id}
                className="min-w-0"
                onSelect={() => onSwitchSession(session.id)}
              >
                <span className="min-w-0 flex-1 truncate">{session.title}</span>
                {session.id === activeSessionId ? (
                  <span className="text-[10px] text-muted-foreground">Current</span>
                ) : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!canCreateNewSession}
              onSelect={onNewSession}
            >
              <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.8} />
              New chat
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={sessions.length <= 1}
              onSelect={() => onDeleteSession(activeSessionId)}
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} strokeWidth={1.8} />
              Delete current chat
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          disabled={!canCreateNewSession}
          aria-label="New helper chat"
          title="New helper chat"
          onClick={onNewSession}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.8} />
        </Button>
      </div>
    </div>
  );
}

const HELPER_PROMPTS = [
  {
    label: "Ask about this terminal",
    hint: "Use recent shell context",
    icon: TerminalIcon,
    prompt: "Explain what is happening in the current terminal.",
  },
  {
    label: "Fix the last error",
    hint: "Diagnose and suggest next steps",
    icon: AlertCircleIcon,
    prompt: "Find the last error in the terminal and tell me how to fix it.",
  },
  {
    label: "Draft a command",
    hint: "Prepare, don't execute",
    icon: CodeIcon,
    prompt: "Draft the command I should run to ",
  },
];

function HelperEmptyState() {
  const composer = useComposer();

  const pickPrompt = (prompt: string) => {
    composer.setValue(prompt);
    requestAnimationFrame(() => {
      composer.textareaRef.current?.focus();
      composer.textareaRef.current?.setSelectionRange(
        prompt.length,
        prompt.length,
      );
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-end px-3 pb-4 pt-8">
      <div className="rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-card text-foreground">
            <HugeiconsIcon icon={AiChat02Icon} size={16} strokeWidth={1.85} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">
              What should Helper do?
            </div>
            <p className="mt-0.5 text-[11.5px] leading-5 text-muted-foreground">
              It can read terminal context, explain output, draft commands, and
              help with the active workspace.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5">
          {HELPER_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => pickPrompt(item.prompt)}
              className="group flex min-h-12 w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border/70 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:text-foreground">
                <HugeiconsIcon icon={item.icon} size={14} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">
                  {item.label}
                </span>
                <span className="block truncate text-[10.5px] text-muted-foreground">
                  {item.hint}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HelperLoading({
  onConnectProvider,
}: {
  onConnectProvider: () => void;
}) {
  return (
    <>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/60 px-3">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-foreground">
          <HugeiconsIcon icon={AiChat02Icon} size={14} strokeWidth={1.85} />
        </div>
        <div className="min-w-0 text-xs font-semibold text-foreground">
          Helper
        </div>
      </div>
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 text-center",
          "text-xs text-muted-foreground",
        )}
      >
        <Spinner />
        <div>Loading chat session...</div>
      </div>
      <div className="shrink-0 border-t border-border/60 bg-card/40 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center"
          onClick={onConnectProvider}
        >
          <HugeiconsIcon icon={Key01Icon} size={14} strokeWidth={1.8} />
          Connect provider
        </Button>
      </div>
    </>
  );
}
