import Boids, { meta as boidsMeta } from './boids';
import QRTCP, { meta as qrtcpMeta } from './qrtcp';
import { getMarkdownPostPage } from './PostPage';
import { generatedPosts } from './generated-posts';

export interface PostMeta {
  title: string;
  summary: string;
  image: string;
  date: string;
  draft?: boolean;
}

export interface Post {
  slug: string;
  meta: PostMeta | { [key: string]: any };
  component: React.ComponentType;
}

// Create components from generated posts
const markdownPosts: Post[] = generatedPosts.map(post => ({
  slug: post.slug,
  meta: post.meta,
  component: getMarkdownPostPage({ frontMatter: post.meta, content: post.content })
}));

// Export posts as a static array
export const posts: Post[] = [
  ...markdownPosts,
  { slug: 'boids', meta: boidsMeta, component: Boids },
  { slug: 'qrtcp', meta: qrtcpMeta, component: QRTCP },
];

// Keep the async function for backwards compatibility if needed
export const getPosts = (): Promise<Post[]> => Promise.resolve(posts);

export default getPosts;
