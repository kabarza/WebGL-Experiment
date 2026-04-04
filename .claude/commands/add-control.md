# Add Control to Experiment

Add a new DialKit UI control to an experiment — updates the shader uniform, params config, and render wiring in one go.

## Input
$ARGUMENTS — Experiment slug and control description (e.g., `flow-field turbulence float 0-2 default 0.5` or `flow-field bg opacity slider`)

## Steps

1. Parse the input to determine: experiment slug, param name, type (float/color/bool), range, default
2. Edit `src/experiments/<slug>/params.ts`:
   - Add the default value to `defaults`
   - Add the control to the appropriate group in `dialConfig` (pick the best existing folder, or create one if specified)
3. Edit the shader (`src/experiments/<slug>/*.glsl`):
   - Add `uniform float u_<name>;` (or `vec3` for colors, `bool` for toggles)
4. Edit `src/experiments/<slug>/*Experiment.ts` or `experiment.ts`:
   - Add the uniform location lookup
   - Add the `gl.uniform*` call in the render function, reading from `params.<name>`
5. If a WebGPU implementation exists, also update the WGSL uniform struct and `UniformBuffer` field list
6. Run `npm run typecheck` to verify everything compiles
