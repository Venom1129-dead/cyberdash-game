// CyberDash 2099 — Core Engine & Game Loop
(function () {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // HUD & UI Elements
  const currentScoreEl = document.getElementById('currentScore');
  const highScoreEl = document.getElementById('highScore');
  const speedValEl = document.getElementById('speedVal');
  const uiOverlay = document.getElementById('uiOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySubtitle = document.getElementById('overlaySubtitle');
  const gameOverStats = document.getElementById('gameOverStats');
  const finalScoreEl = document.getElementById('finalScore');
  const newBestBadgeEl = document.getElementById('newBestBadge');
  const actionBtn = document.getElementById('actionBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');

  // Game States
  const STATE = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAMEOVER: 3
  };

  let gameState = STATE.MENU;
  let score = 0;
  let highScore = parseInt(localStorage.getItem('cyberdash_highscore') || '0', 10);
  highScoreEl.textContent = highScore;

  let baseSpeed = 6.0;
  let currentSpeed = baseSpeed;
  let groundY = 320;
  let frameCount = 0;

  // Player Object
  const player = {
    x: 80,
    y: groundY - 40,
    width: 32,
    height: 40,
    vy: 0,
    gravity: 0.68,
    jumpPower: -12.5,
    isGrounded: true,
    jumpCount: 0,
    maxJumps: 2,
    trail: [],
    color: '#00f0ff',

    reset() {
      this.y = groundY - this.height;
      this.vy = 0;
      this.isGrounded = true;
      this.jumpCount = 0;
      this.trail = [];
    },

    jump() {
      if (this.jumpCount < this.maxJumps) {
        this.vy = this.jumpPower;
        this.isGrounded = false;
        this.jumpCount++;
        if (this.jumpCount === 1) {
          window.soundEngine.playJump();
        } else {
          window.soundEngine.playDoubleJump();
          createBurst(this.x + this.width / 2, this.y + this.height, '#ff007f', 12);
        }
      }
    },

    update() {
      this.vy += this.gravity;
      this.y += this.vy;

      // Ground collision
      if (this.y >= groundY - this.height) {
        this.y = groundY - this.height;
        this.vy = 0;
        this.isGrounded = true;
        this.jumpCount = 0;
      }

      // Trail tracking
      if (frameCount % 2 === 0) {
        this.trail.unshift({ x: this.x, y: this.y });
        if (this.trail.length > 5) this.trail.pop();
      }
    },

    draw() {
      // Draw neon motion trail
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        const alpha = (0.25 - (i * 0.05)).toFixed(2);
        ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
        ctx.fillRect(t.x - (i * 4), t.y, this.width, this.height);
      }

      // Draw Main Avatar
      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;

      // Torso / Jetpack frame
      ctx.fillStyle = '#101426';
      ctx.fillRect(this.x, this.y, this.width, this.height);

      // Neon accents
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x + 4, this.y + 4, this.width - 8, 6); // Visor
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(this.x + 8, this.y + 14, 16, 12); // Core reactor

      // Jet Thruster flame if jumping
      if (!this.isGrounded) {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(this.x + 8, this.y + this.height);
        ctx.lineTo(this.x + 16, this.y + this.height + (Math.random() * 12 + 6));
        ctx.lineTo(this.x + 24, this.y + this.height);
        ctx.fill();
      }

      ctx.restore();
    }
  };

  // Obstacles & Pickups
  let obstacles = [];
  let pickups = [];
  let particles = [];
  let nextObstacleTimer = 70;

  function spawnObstacle() {
    const types = ['pylon', 'laser_high', 'double_pylon'];
    const chosen = types[Math.floor(Math.random() * types.length)];

    if (chosen === 'pylon') {
      obstacles.push({
        type: 'pylon',
        x: canvas.width + 20,
        y: groundY - 36,
        width: 24,
        height: 36,
        color: '#ff007f'
      });
    } else if (chosen === 'laser_high') {
      // Low drone/barrier that can be slid under or timed
      obstacles.push({
        type: 'drone',
        x: canvas.width + 20,
        y: groundY - 78,
        width: 32,
        height: 22,
        color: '#ffd700'
      });
    } else {
      // Tall barrier requiring full double jump
      obstacles.push({
        type: 'barrier',
        x: canvas.width + 20,
        y: groundY - 54,
        width: 28,
        height: 54,
        color: '#ff2a2a'
      });
    }

    // Opportunity to spawn an energy data orb
    if (Math.random() < 0.45) {
      pickups.push({
        x: canvas.width + 120,
        y: groundY - 75 - Math.random() * 40,
        radius: 8,
        color: '#00f0ff',
        bobOffset: Math.random() * Math.PI * 2
      });
    }
  }

  function createBurst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 2,
        color,
        life: 1.0,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  // Synthwave Grid Background
  let gridOffset = 0;
  function drawBackground() {
    // Deep starry sky
    ctx.fillStyle = '#070811';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Distant Neon Sun / Horizon Glow
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, groundY, 10,
      canvas.width / 2, groundY, 240
    );
    gradient.addColorStop(0, 'rgba(255, 0, 127, 0.35)');
    gradient.addColorStop(0.5, 'rgba(157, 78, 221, 0.15)');
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, groundY);

    // City Skyline Silhouette
    ctx.fillStyle = '#0c0e1a';
    for (let x = 0; x < canvas.width; x += 45) {
      const h = ((x * 17) % 65) + 30;
      ctx.fillRect(x, groundY - h, 40, h);
    }

    // Ground Floor
    ctx.fillStyle = '#0a0d18';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

    // Horizon line
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    // Moving Synthwave Perspective Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1;

    gridOffset = (gridOffset + currentSpeed) % 40;
    for (let x = -gridOffset; x < canvas.width + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x - 50, canvas.height);
      ctx.stroke();
    }

    // Horizontal grid lines with perspective compression
    for (let y = groundY + 12; y < canvas.height; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // AABB Collision Detection
  function checkCollision(r1, r2) {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  }

  // Core Game Loop
  function gameLoop() {
    frameCount++;

    if (gameState === STATE.PLAYING) {
      // Dynamic speed scaling
      currentSpeed = baseSpeed + (score / 450) * 1.8;
      speedValEl.textContent = (currentSpeed / baseSpeed).toFixed(1) + 'x';

      // Increment score
      score += 1;
      currentScoreEl.textContent = score;

      // Update Player
      player.update();

      // Spawn Obstacles
      nextObstacleTimer -= 1;
      if (nextObstacleTimer <= 0) {
        spawnObstacle();
        const minGap = Math.max(50, 95 - (score / 150));
        nextObstacleTimer = Math.floor(Math.random() * 45) + minGap;
      }

      // Update Obstacles
      for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= currentSpeed;

        // Collision check
        if (checkCollision(player, obs)) {
          triggerGameOver();
          return;
        }

        // Remove off-screen
        if (obs.x + obs.width < -10) {
          obstacles.splice(i, 1);
        }
      }

      // Update Pickups
      for (let i = pickups.length - 1; i >= 0; i--) {
        const p = pickups[i];
        p.x -= currentSpeed;

        // Check pickup overlap
        const dx = (player.x + player.width / 2) - p.x;
        const dy = (player.y + player.height / 2) - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < player.width / 2 + p.radius) {
          // Collected
          score += 150;
          currentScoreEl.textContent = score;
          window.soundEngine.playScoreChime();
          createBurst(p.x, p.y, p.color, 15);
          pickups.splice(i, 1);
          continue;
        }

        if (p.x + p.radius < -10) {
          pickups.splice(i, 1);
        }
      }

      // Update Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const pt = particles[i];
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= pt.decay;
        if (pt.life <= 0) {
          particles.splice(i, 1);
        }
      }
    }

    // Render Stage
    drawBackground();

    // Draw Pickups
    pickups.forEach(p => {
      ctx.save();
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      const bob = Math.sin(frameCount * 0.1 + p.bobOffset) * 4;
      ctx.arc(p.x, p.y + bob, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw Obstacles
    obstacles.forEach(obs => {
      ctx.save();
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 8;
      ctx.fillStyle = obs.color;
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

      // Warning stripe detail
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(obs.x + 4, obs.y + 4, obs.width - 8, 3);
      ctx.restore();
    });

    // Draw Player
    player.draw();

    // Draw Particles
    particles.forEach(pt => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    if (gameState === STATE.PLAYING || gameState === STATE.PAUSED) {
      requestAnimationFrame(gameLoop);
    }
  }

  // Game Management Functions
  function startGame() {
    window.soundEngine.init();
    score = 0;
    currentScoreEl.textContent = '0';
    currentSpeed = baseSpeed;
    speedValEl.textContent = '1.0x';
    obstacles = [];
    pickups = [];
    particles = [];
    nextObstacleTimer = 60;
    player.reset();

    gameState = STATE.PLAYING;
    uiOverlay.classList.add('hidden');
    pauseOverlay.classList.add('hidden');
    requestAnimationFrame(gameLoop);
  }

  function triggerGameOver() {
    gameState = STATE.GAMEOVER;
    window.soundEngine.playCrash();
    createBurst(player.x + 16, player.y + 20, '#ff007f', 30);
    createBurst(player.x + 16, player.y + 20, '#ffd700', 20);

    let isNewBest = false;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('cyberdash_highscore', highScore);
      highScoreEl.textContent = highScore;
      isNewBest = true;
    }

    // Update Game Over Modal
    overlayTitle.textContent = 'CRASHED';
    overlaySubtitle.textContent = 'CIRCUIT BREACH DETECTED';
    finalScoreEl.textContent = score;
    newBestBadgeEl.textContent = isNewBest ? 'YES! (+Record)' : 'NO';
    newBestBadgeEl.style.color = isNewBest ? '#ffd700' : '#8e9bb0';
    gameOverStats.classList.remove('hidden');
    actionBtn.querySelector('.btn-text').textContent = 'REBOOT SYSTEM';
    uiOverlay.classList.remove('hidden');
  }

  function togglePause() {
    if (gameState === STATE.PLAYING) {
      gameState = STATE.PAUSED;
      pauseOverlay.classList.remove('hidden');
    } else if (gameState === STATE.PAUSED) {
      gameState = STATE.PLAYING;
      pauseOverlay.classList.add('hidden');
      requestAnimationFrame(gameLoop);
    }
  }

  // Event Listeners
  actionBtn.addEventListener('click', () => {
    startGame();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (gameState === STATE.PLAYING) {
        player.jump();
      } else if (gameState === STATE.MENU || gameState === STATE.GAMEOVER) {
        startGame();
      }
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (gameState === STATE.PLAYING || gameState === STATE.PAUSED) {
        togglePause();
      }
    }
  });

  // Touch and click jumping on canvas
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === STATE.PLAYING) {
      player.jump();
    }
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    if (gameState === STATE.PLAYING) {
      player.jump();
    }
  });

  pauseOverlay.addEventListener('click', () => {
    togglePause();
  });

  // Initial draw render
  drawBackground();
  player.draw();
})();
