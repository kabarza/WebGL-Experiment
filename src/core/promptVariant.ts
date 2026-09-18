// ============================================================
// PromptVariant — opt-in per-experiment portable prompt export
// Each experiment can ship a `prompt.ts` that exports an array
// of variants. The Prompt tab in ExportPanel renders them.
// ============================================================

export type PromptMode = 'defaults' | 'current';

export interface PromptOutput {
  markdown: string;
  json: Record<string, unknown>;
}

export interface PromptVariant {
  /** Stable id, e.g. 'react-webgl'. */
  id: string;
  /** Label shown in the variant dropdown. */
  label: string;
  /** Builds the prompt for the chosen value set. */
  build: (values: Record<string, unknown>, mode: PromptMode) => PromptOutput;
}
