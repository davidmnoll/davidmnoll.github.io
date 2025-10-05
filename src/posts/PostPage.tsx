import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeMermaid from 'rehype-mermaid'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'


import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import hljs from "highlight.js/lib/core";
import lean from "highlightjs-lean";

hljs.registerLanguage("lean", lean);


export const getMarkdownPostPage = ({ frontMatter, content }: {
  frontMatter: {
    [key: string]: any;
  }, content: string
}) => () => {

  if (!frontMatter.title) {
    throw new Error("No title in frontmatter")
  }

  return (<PostPage title={frontMatter.title}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeMermaid, rehypeHighlight, rehypeRaw]}
    >{content}</ReactMarkdown>
  </PostPage>)

}



export default function PostPage({ title, children }: { title: string; children: React.ReactNode }) {
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
      <h1 className="text-3xl font-bold mb-4">{title}</h1>
      {children}
    </div>
  );
}
