import { Link } from 'react-router-dom';
import { posts } from '@/posts';

export default function PostsPage() {
  const sortedPosts = [...posts]
    .filter((p) => !p.meta.draft)
    .sort((a, b) => {
      const dateA = new Date(a.meta.date || '1970-01-01');
      const dateB = new Date(b.meta.date || '1970-01-01');
      return dateB.getTime() - dateA.getTime();
    });

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-1"
      style={{
        width: '100%',
        padding: '3vw 6vw',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <h1 className="text-3xl font-bold mb-6">Blog</h1>
      <ul>
        {sortedPosts.map((p) => (
          <li key={p.slug} className="mb-8 flex gap-4">
            <Link to={`/blog/${p.slug}`} className="shrink-0">
              <img src={p.meta.image} alt="" className="w-32 h-20 object-cover rounded" />
            </Link>
            <div>
              <h2 className="text-xl font-semibold">
                <Link to={`/blog/${p.slug}`}>{p.meta.title}</Link>
              </h2>
              <p className="text-xs text-foreground/50 mb-1">
                {new Date(p.meta.date || '').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="text-sm text-foreground/70">
                {p.meta.summary.slice(0, 100)}...
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
