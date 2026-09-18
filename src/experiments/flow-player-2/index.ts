export { flowPlayer2Experiment as experiment } from './experiment.ts';

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      './experiment.ts',
      './params.ts',
      './styles.ts',
      './icons.ts',
      './dom.ts',
      './runtime.ts',
      './helpers.ts',
      './mediaSource.ts',
      './providers/types.ts',
      './providers/createProvider.ts',
      './providers/VimeoProvider.ts',
      './providers/YouTubeProvider.ts',
    ],
    () => {},
  );
}
