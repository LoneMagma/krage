type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
/** Optional browser-native agent surface. Uses the exact live game actions. */
export function registerGameTools(read: () => unknown, pause: () => void) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const schema = {
    type: 'object',
    properties: {},
    additionalProperties: false,
  };
  const validate = (input: unknown) => {
    if (
      input === null ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length
    )
      throw new Error('Expected an empty input object.');
  };
  const tools: Tool[] = [
    {
      name: 'read_match_status',
      title: 'Read krage match status',
      description:
        'Read the actual phase, remaining time, player stats, and scoreboard of the current local or online match.',
      inputSchema: schema,
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        validate(input);
        return read();
      },
    },
    {
      name: 'pause_match',
      title: 'Pause krage match',
      description:
        'Open the match menu and release mouse capture. Local bot matches pause; online rooms continue for other players. No effect when a match is not running.',
      inputSchema: schema,
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        validate(input);
        pause();
        return read();
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {
      /* Unsupported experimental registries must not interrupt gameplay. */
    }
  }
  return () => lifecycle.abort();
}
