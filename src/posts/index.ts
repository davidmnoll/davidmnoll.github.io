import Boids, { meta as boidsMeta } from './boids';

export interface PostMeta {
  title: string;
  summary: string;
  image: string;
}

export interface Post {
  slug: string;
  meta: PostMeta;
  component: React.ComponentType;
}

export const posts: Post[] = [
  { slug: 'boids', meta: boidsMeta, component: Boids },
];

export default posts;
