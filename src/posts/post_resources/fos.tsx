import FosScopeBuilder from './fosScopeBuilder';

export const FosWrapperComponent = () => (
  <article className="space-y-6 text-white">
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-[0.4em] text-foreground/60">Formal Operating System</p>
      <h1 className="text-3xl font-semibold">FOS Playground (WIP)</h1>
      <p className="text-sm text-foreground/70">
        The experimental planner UI is still in progress. The current iteration lives in
        <code className="mx-1 rounded bg-black/30 px-1">fos.tsx.wip.txt</code> if you need to pick it up.
      </p>
    </header>
    <FosScopeBuilder />
  </article>
);

export default FosWrapperComponent;
