export { htmlInCanvas4Experiment as experiment } from './experiment.ts';

if (import.meta.hot) {
  import.meta.hot.accept(
    ['./experiment.ts', './params.ts'],
    () => {},
  );
}
