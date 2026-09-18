export { flowPlayer4Experiment as experiment } from './experiment.ts';

if (import.meta.hot) {
  import.meta.hot.accept(
    [
      './experiment.ts',
      './params.ts',
      './helpers.ts',
      './styles.ts',
      './icons.ts',
      './Player.ts',
      './JsControlBar.ts',
      './DomControlBar.ts',
      './StateBridge.ts',
      './Scrubber.ts',
      './Settings.ts',
      './Keyboard.ts',
      './Fullscreen.ts',
      './PosterLoader.ts',
      './providers/types.ts',
      './providers/createProvider.ts',
      './providers/VimeoProvider.ts',
      './providers/YouTubeProvider.ts',
      './providers/HlsProvider.ts',
      './providers/Mp4Provider.ts',
    ],
    () => {},
  );
}
