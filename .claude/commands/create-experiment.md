# Create New WebGL Experiment

Create a new WebGL experiment based on the user's description.

## Input
$ARGUMENTS — A description of the desired visual effect (e.g., "particle storm with gravity", "voronoi cells with animated borders")

## Steps

1. Generate a short name from the description (2-3 words, e.g., "Particle Storm")
2. Run the scaffold script:
   ```bash
   npx tsx scripts/new-experiment.ts --name "<generated name>"
   ```
3. Open the generated files in `src/experiments/<slug>/`
4. Edit `shader.glsl` — Write the fragment shader implementing the described effect. Use the fullscreen quad vertex shader (already set up). Available uniforms: `u_time`, `u_resolution`. Add more uniforms as needed.
5. Edit `params.ts` — Add DialKit controls for all tunable parameters in the shader. Use the format:
   - Numbers: `paramName: [default, min, max, step]`
   - Colors: `paramName: '#hexcolor'`
   - Booleans: `paramName: false`
6. Edit `experiment.ts` — Wire up the new uniforms to match the shader
7. Edit `meta.ts` — Write an accurate description and tags
8. Run `npm run dev` and verify the experiment loads in the gallery

## Reference
Look at `src/experiments/flow-field/` for a complete example of a production experiment with both WebGPU and WebGL implementations, full uniform wiring, and DialKit controls.
