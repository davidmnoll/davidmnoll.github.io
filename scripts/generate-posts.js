import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postsDir = path.join(__dirname, '../src/posts/md');
const outputFile = path.join(__dirname, '../src/posts/generated-posts.ts');

// Read all markdown files
const files = fs.readdirSync(postsDir).filter(file => file.endsWith('.md'));

const posts = files.map(file => {
  const filePath = path.join(postsDir, file);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  const slug = file.replace(/\.md$/, '');

  return {
    slug,
    meta: data,
    content
  };
});

// Generate TypeScript file
const output = `// This file is auto-generated. Do not edit manually.
export const generatedPosts = ${JSON.stringify(posts, null, 2)} as const;
`;

fs.writeFileSync(outputFile, output, 'utf-8');
console.log(`Generated posts file with ${posts.length} posts`);
