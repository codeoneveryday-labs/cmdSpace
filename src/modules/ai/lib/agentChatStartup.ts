type RuntimeSession = {
  sessionId: string;
  attachmentToken: string;
};

type AgentChatStartupRuntime = {
  attach: (chatId: string) => Promise<RuntimeSession>;
  start: (input: {
    provider: string;
    cwd: string;
    prompt: string;
    chatId: string;
    model?: string;
    nativeSessionId: string | null;
  }) => Promise<RuntimeSession>;
};

type AgentChatStartupInput = {
  runtime: AgentChatStartupRuntime;
  chatId: string;
  provider: string;
  cwd: string;
  nativeSessionId: string | null;
};

export function createAgentChatStartup(input: AgentChatStartupInput) {
  type Admission = {
    sessionId: string;
    attachmentToken: string;
    started: boolean;
  };
  let residentAttach: Promise<Admission> | null = null;
  let coldStart: Promise<Admission> | null = null;

  function attachResident(): Promise<Admission> {
    if (!residentAttach) {
      const request = input.runtime
        .attach(input.chatId)
        .then(({ sessionId, attachmentToken }) => ({
          sessionId,
          attachmentToken,
          started: false,
        }));
      residentAttach = request;
    }
    return residentAttach;
  }

  function startFirstPrompt(prompt: string, model?: string): Promise<Admission> {
    if (!coldStart) {
      const request = input.runtime
        .start({
          provider: input.provider,
          cwd: input.cwd,
          prompt,
          chatId: input.chatId,
          model,
          nativeSessionId: input.nativeSessionId,
        })
        .then(({ sessionId, attachmentToken }) => ({
          sessionId,
          attachmentToken,
          started: true,
        }));
      coldStart = request;
      void request.catch(() => {
        if (coldStart === request) coldStart = null;
      });
    }
    return coldStart;
  }

  function admitFirstPrompt(prompt: string, model?: string) {
    return attachResident().catch(() => startFirstPrompt(prompt, model));
  }

  function recoverFirstPrompt(prompt: string, model?: string) {
    residentAttach = null;
    coldStart = null;
    return admitFirstPrompt(prompt, model);
  }

  return { attachResident, admitFirstPrompt, recoverFirstPrompt };
}
