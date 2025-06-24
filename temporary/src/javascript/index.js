class ParticleNetwork {
    constructor() {
        this.canvas = document.getElementById('particles');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.connections = [];
        this.maxDistance = 140;
        this.particleCount = window.innerWidth < 768 ? 100 : 300;

        this.mouse = { x: null, y: null, radius: 100 };

        this.resize();
        this.createParticles();
        this.animate();

        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1
            });
        }
    }

    updateParticles() {
        this.particles.forEach(particle => {
            // Mouse push effect
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = particle.x - this.mouse.x;
                const dy = particle.y - this.mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.mouse.radius;

                if (dist < minDist && dist > 0) {
                    const force = (minDist - dist) / minDist * 0.03;
                    const angle = Math.atan2(dy, dx);
                    const pushX = Math.cos(angle) * force;
                    const pushY = Math.sin(angle) * force;
                    particle.vx += pushX;
                    particle.vy += pushY;
                }
            }

            // Damp velocity to stabilize speed
            const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
            if (speed > 3) {
                const factor = 3 / speed;
                particle.vx *= factor;
                particle.vy *= factor;
            }

            // Move particle
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Bounce off walls
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;

            // Clamp position
            particle.x = Math.max(0, Math.min(this.canvas.width, particle.x));
            particle.y = Math.max(0, Math.min(this.canvas.height, particle.y));
        });
    }

    drawParticles() {
        this.ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
        this.particles.forEach(particle => {
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawConnections() {
        this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.15)';
        this.ctx.lineWidth = 3;

        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.maxDistance) {
                    const opacity = (this.maxDistance - distance) / this.maxDistance * 0.3;
                    this.ctx.strokeStyle = `rgba(16, 185, 129, ${opacity})`;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.stroke();
                }
            }
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.updateParticles();
        this.drawConnections();
        this.drawParticles();
        
        requestAnimationFrame(() => this.animate());
    }
}

new ParticleNetwork();
