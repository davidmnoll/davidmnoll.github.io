/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useRef } from 'react';
import PostPage from './PostPage';
import thumb from '@/assets/boids-thumb.svg';

export const meta = {
  title: 'Boids Simulation',
  summary:
    'A simple visual experiment showing how flocks of birds can emerge from three basic steering behaviours.',
  image: thumb,
};

interface Boid {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export default function Boids() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const boids: Boid[] = Array.from({ length: 30 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() * 2 - 1) * 1.5,
      vy: (Math.random() * 2 - 1) * 1.5,
    }));

    const maxSpeed = 3;
    const radius = 40;

    const step = () => {
      ctx.clearRect(0, 0, width, height);

      for (const b of boids) {
        let avgVX = 0;
        let avgVY = 0;
        let centerX = 0;
        let centerY = 0;
        let count = 0;
        let avoidX = 0;
        let avoidY = 0;

        for (const other of boids) {
          if (other === b) continue;
          const dx = other.x - b.x;
          const dy = other.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < radius) {
            avgVX += other.vx;
            avgVY += other.vy;
            centerX += other.x;
            centerY += other.y;
            count++;
            if (dist < 20) {
              avoidX -= dx;
              avoidY -= dy;
            }
          }
        }

        if (count > 0) {
          avgVX /= count;
          avgVY /= count;
          centerX /= count;
          centerY /= count;

          // Alignment
          b.vx += (avgVX - b.vx) * 0.05;
          b.vy += (avgVY - b.vy) * 0.05;

          // Cohesion
          b.vx += (centerX - b.x) * 0.0005;
          b.vy += (centerY - b.y) * 0.0005;

          // Separation
          b.vx += avoidX * 0.05;
          b.vy += avoidY * 0.05;
        }

        // Limit speed
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > maxSpeed) {
          b.vx = (b.vx / speed) * maxSpeed;
          b.vy = (b.vy / speed) * maxSpeed;
        }

        b.x += b.vx;
        b.y += b.vy;

        // Wrap around edges
        if (b.x < 0) b.x += width;
        if (b.y < 0) b.y += height;
        if (b.x > width) b.x -= width;
        if (b.y > height) b.y -= height;

        // Draw
        const angle = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, 4);
        ctx.lineTo(-10, -4);
        ctx.closePath();
        ctx.fillStyle = '#22d3ee';
        ctx.fill();
        ctx.restore();
      }

      requestAnimationFrame(step);
    };

    step();
  }, []);

  return (
    <PostPage title={meta.title}>
      <p className="mb-4 max-w-prose">
        Boids models flocking behaviour with three simple rules: separation, alignment and cohesion.
      </p>
      <canvas ref={canvasRef} width={800} height={400} className="w-full border border-muted rounded" />
    </PostPage>
  );
}
