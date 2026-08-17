/* eslint-disable react-refresh/only-export-components */
import PostPage from './PostPage';
import { CoinductiveLangDemo } from './post_resources/coinductiveLang';

export const meta = {
  title: 'A Toy Coinductive Language',
  summary:
    'An vibe-coded stub of a small language for working with infinite streams.',
  image: '/blog-images/coinductiveLang.svg',
  date: '2026-06-03',
  draft: true
};

export default function CoinductiveLang() {
  return (
    <PostPage title={meta.title}>
      <div className="prose prose-invert max-w-none mb-8">
        <p>
          Coinduction is the dual of induction. Induction starts from a base case
          and recursively steps from there, whereas coinduction consumes the current step and moves to another one.
        </p>
        <p>
          An infinite bitstring interpreted as a number is 2-adic.  There are many resources on this, but long story short in the 2-adics,
          a number followed by an infinite string of 1's is negative.  For instance ........11111 = -1.  If we add 1, the chain
          of carries produce an infinite number of 0's.  This might seem like a clever trick, but it turns out to go
          significantly deeper.
        </p>
        {/* <pre className="bg-gray-900 p-4 rounded overflow-x-auto">
          {`fib = cons(0, cons(1, zipWith(add, fib, tail(fib))))`}
        </pre> */}
        <p>
          A weakness of numerical encodings is the lack of functoriality of the encodings.  Taking certain operations numerically
          should line up with the corresponding evaluation semantics.
        </p>
      </div>

      <CoinductiveLangDemo />

      <div className="prose prose-invert max-w-none mt-8">
        <h2>Why This Matters</h2>
        <p>
          Coinduction appears throughout computer science:
        </p>
        <ul>
          <li>Lazy evaluation in Haskell</li>
          <li>Reactive streams and observables</li>
          <li>Bisimulation for process equivalence</li>
          <li>Greatest fixed points in model checking</li>
          <li>Productive definitions in proof assistants like Coq and Agda</li>
        </ul>
        <p>
          Understanding coinduction gives you a powerful mental model for reasoning about
          infinite and interactive computations.
        </p>
      </div>
    </PostPage>
  );
}
