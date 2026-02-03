/**
 * lock-screen-particles.js - Canvas particle animation for lock screen
 *
 * Renders floating translucent bubbles on a canvas overlay.
 * Extracted from lock-screen.js for modularity (TASK-121).
 */

const PARTICLE_COUNT = 20;
const COLOR_R = 100;
const COLOR_G = 180;
const COLOR_B = 220;

export class ParticleSystem {
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._particles = [];
    this._animationId = null;

    this._resizeCanvas();
    this._resizeObserver = new ResizeObserver(() => this._resizeCanvas());
    this._resizeObserver.observe(canvas.parentElement);
  }

  start() {
    this._initParticles();
    const animate = () => {
      this._animationId = requestAnimationFrame(animate);
      this._draw();
    };
    animate();
  }

  stop() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  destroy() {
    this.stop();
    this._resizeObserver.disconnect();
  }

  _resizeCanvas() {
    const rect = this._canvas.parentElement.getBoundingClientRect();
    this._canvas.width = rect.width;
    this._canvas.height = rect.height;
  }

  _initParticles() {
    this._particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this._particles.push({
        x: Math.random() * 400,
        y: Math.random() * 800,
        radius: Math.random() * 20 + 10,
        alpha: Math.random() * 0.15 + 0.05,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3 - 0.2,
      });
    }
  }

  _draw() {
    const { width, height } = this._canvas;
    this._ctx.clearRect(0, 0, width, height);

    for (const p of this._particles) {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < -p.radius) p.x = width + p.radius;
      if (p.x > width + p.radius) p.x = -p.radius;
      if (p.y < -p.radius) p.y = height + p.radius;
      if (p.y > height + p.radius) p.y = -p.radius;

      this._ctx.beginPath();
      this._ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this._ctx.fillStyle = `rgba(${COLOR_R}, ${COLOR_G}, ${COLOR_B}, ${p.alpha})`; // lint-ignore: lock screen particles
      this._ctx.fill();
    }
  }
}
