// Activation modes for vision experiments. "Clap" owns the sticky handoff
// behavior (two-hand activate, one-hand follow). "DoublePinch" is a toggle:
// two quick index-thumb pinches turn the effect on/off; middle-thumb distance
// drives size while active, and the effect anchors to the thumb tip.
// Modes are wired through DialKit's preset system (each preset bakes a
// mode into its values), so the preset dropdown doubles as a mode picker.

export const ACTIVATION_MODES = ['Clap', 'DoublePinch'] as const;
export type ActivationMode = (typeof ACTIVATION_MODES)[number];
