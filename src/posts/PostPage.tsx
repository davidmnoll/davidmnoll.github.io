import React from 'react';

export default function PostPage({ title, children }: { title: string; children: React.ReactNode }) {
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
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      {children}
    </div>
  );
}
