import { FosWrapperComponent } from '@/posts/post_resources/fos';

const FosPage = () => {
  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-black py-16 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <header className="space-y-3 text-center md:text-left">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400/80">Experimental Runtime</p>
          <h1 className="text-4xl font-semibold text-white">Fos: Dependently Typed Holes as Endpoints</h1>
          <p className="text-base text-foreground/70 md:max-w-3xl">
            Explore the React-based AST runtime from “goalsAsTypes.” It demonstrates Todo workflows, Datalog queries, and
            the Narya-inspired higher observational homotopy layer—now with a much clearer presentation.
          </p>
        </header>
        <FosWrapperComponent />
      </div>
    </main>
  );
};

export default FosPage;
