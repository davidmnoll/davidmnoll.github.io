import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postsDir = path.join(__dirname, '../src/posts/md');
const imagesDir = path.join(__dirname, '../public/blog-images');

// Create images directory if it doesn't exist
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Google Cloud Vertex AI Configuration
const PROJECT_ID = process.env.GCP_PROJECT_ID;
const LOCATION = process.env.GCP_LOCATION || 'us-central1';
const ACCESS_TOKEN = process.env.GCP_ACCESS_TOKEN; // Get via: gcloud auth print-access-token

async function generateWithVertexAI(prompt) {
  if (!PROJECT_ID || !ACCESS_TOKEN) {
    throw new Error('GCP_PROJECT_ID and GCP_ACCESS_TOKEN must be set');
  }

  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/imagegeneration:predict`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [
        {
          prompt: prompt
        }
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: '16:9', // Good for blog thumbnails
        safetyFilterLevel: 'block_some',
        personGeneration: 'allow_adult'
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vertex AI request failed: ${error}`);
  }

  const data = await response.json();

  // Response contains base64 encoded image
  const base64Image = data.predictions[0].bytesBase64Encoded;
  return Buffer.from(base64Image, 'base64');
}

// Check which posts are missing images
function checkMissingImages() {
  const files = fs.readdirSync(postsDir).filter(file => file.endsWith('.md'));
  const missing = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/, '');
    const fullImagePath = path.join(imagesDir, `${slug}.png`);

    if (!fs.existsSync(fullImagePath)) {
      missing.push(slug);
    }
  }

  return missing;
}

// Main function
async function generateImages() {
  const slug = process.argv[2];

  // If no slug provided, show status
  if (!slug) {
    console.log('Usage: npm run generate-images <slug>\n');

    const missing = checkMissingImages();

    if (missing.length === 0) {
      console.log('✓ All blog posts have images!\n');
    } else {
      console.log(`⚠️  ${missing.length} blog post(s) missing images:\n`);
      missing.forEach(s => console.log(`  - ${s}`));
      console.log('\nRun: npm run generate-images <slug>');
    }
    return;
  }

  const filePath = path.join(postsDir, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    console.error(`✗ Blog post not found: ${slug}.md`);
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(fileContent);

  const imagePath = `/blog-images/${slug}.png`;
  const fullImagePath = path.join(imagesDir, `${slug}.png`);

  // Warn if image already exists
  if (fs.existsSync(fullImagePath)) {
    console.log(`⚠️  Warning: Image already exists for ${slug}`);
    console.log('Proceeding anyway...\n');
  }

  // Create prompt from title and summary
  const imagePrompt = `Blog post illustration: "${data.title}". ${data.summary}. Digital art, professional, clean, modern aesthetic, high quality.`;

  console.log(`Generating image for: ${data.title}`);
  console.log(`Prompt: ${imagePrompt}\n`);

  try {
    const imageBuffer = await generateWithVertexAI(imagePrompt);
    fs.writeFileSync(fullImagePath, imageBuffer);

    // Update the markdown file with the new image path
    const newContent = fileContent.replace(
      /image:\s*["'].*["']/,
      `image: "${imagePath}"`
    );
    fs.writeFileSync(filePath, newContent, 'utf-8');

    console.log(`✓ Generated image for ${slug}`);
  } catch (error) {
    console.error(`✗ Failed to generate image for ${slug}:`, error.message);
  }
}

generateImages().catch(console.error);
