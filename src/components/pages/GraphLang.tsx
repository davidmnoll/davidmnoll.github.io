import { GraphLangPlayground } from '@/posts/post_resources/graphlang';

const GraphLangPage = () => {
  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-black py-16 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <header className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-foreground/50">GraphLang</p>
          <h1 className="text-4xl font-semibold">Dependency graphs with geometric addresses</h1>
          <p className="text-sm text-foreground/60">
            Inspired by <a className="text-emerald-300 underline" href="https://spacechimplives.substack.com/p/computing-with-geometry">Computing with Geometry</a> — experiment with matrix-addressed dependencies and constructor parsers.
          </p>
        </header>
        <GraphLangPlayground />
      </div>
    </main>
  );
};

export default GraphLangPage;
