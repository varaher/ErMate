/**
 * Side-effect module: installs the AI usage fetch hook.
 * MUST stay the first import in server.ts so every AI SDK client created later uses the hooked fetch.
 */
import { installAiUsageFetchHook } from "./aiUsage.ts";

installAiUsageFetchHook();