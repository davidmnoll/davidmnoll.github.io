import { FosWrapperComponent } from '@/posts/post_resources/fos';

const FosPage = () => {
  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-slate-950 via-slate-900 to-black py-16 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        <FosWrapperComponent />
      </div>
    </main>
  );
};

export default FosPage;
