export { flowPlayerExperiment as experiment } from './experiment.ts';

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      './experiment.ts',
      './params.ts',
      './helpers.ts',
      './styles.ts',
      './icons.ts',
      './ui/Player.ts',
      './ui/ControlBar.ts',
      './ui/Scrubber.ts',
      './ui/Settings.ts',
      './ui/Keyboard.ts',
      './ui/Fullscreen.ts',
      './ui/ConsentGate.ts',
      './ui/PosterLoader.ts',
      './providers/types.ts',
      './providers/createProvider.ts',
      './providers/VimeoProvider.ts',
      './providers/YouTubeProvider.ts',
    ],
    () => {},
  );
}
