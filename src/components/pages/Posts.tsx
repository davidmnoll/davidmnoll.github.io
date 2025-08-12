import React from 'react';
import { Link } from 'react-router-dom';
import posts from '@/posts';

export default function PostsPage() {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-1"
      style={{
        width: '100%',
        padding: '0 3vw',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <h1 className="text-3xl font-bold mb-6">Posts</h1>
      <ul>
        {posts.map((p) => (
          <li key={p.slug} className="mb-8 flex gap-4">
            <Link to={`/posts/${p.slug}`} className="shrink-0">
              <img src={p.meta.image} alt="" className="w-32 h-20 object-cover rounded" />
            </Link>
            <div>
              <h2 className="text-xl font-semibold">
                <Link to={`/posts/${p.slug}`}>{p.meta.title}</Link>
              </h2>
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
