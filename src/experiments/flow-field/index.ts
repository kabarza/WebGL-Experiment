export { flowFieldExperiment as experiment } from './FlowFieldExperiment.ts';

// Accept HMR for shader and param changes — triggers React re-mount
// of ExperimentView instead of a full page reload.
if (import.meta.hot) {
  import.meta.hot.accept(
    ['./FlowFieldExperiment.ts', './params.ts'],
    () => {},
  );
}
