module.exports = {
  apps: [
    // ──────────────────────────────────────────────
    // 1. BACKEND – En önce başlar, diğer servisler buna bağımlıdır.
    //    wait_ready: Backend HTTP portunu dinlemeye başladığında
    //    process.send('ready') sinyali gönderir.
    //    listen_timeout: 30 saniye içinde sinyal gelmezse PM2 hata verir.
    // ──────────────────────────────────────────────
    {
      name: 'zenith-backend',
      cwd: '/home/mahir/Zenith/backend',
      script: 'node',
      args: '--max-old-space-size=256 dist/main.js',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
      wait_ready: true,
      listen_timeout: 30000,
      restart_delay: 2000,
      kill_timeout: 5000,
      max_memory_restart: '300M',
    },

    // ──────────────────────────────────────────────
    // 2. FRONTEND – Backend'e bağımlılığı yok, paralel başlayabilir.
    // ──────────────────────────────────────────────
    {
      name: 'zenith-frontend',
      cwd: '/home/mahir/Zenith/frontend',
      script: './node_modules/serve/build/main.js',
      args: '-s dist -l 4173 --no-clipboard',
      interpreter: 'node',
      exec_mode: 'fork',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
    },

    // ──────────────────────────────────────────────
    // 3. KAMERA – Backend'e bağımlı.
    //    restart_delay: 5 saniye – Backend yeniden başlarsa
    //    kamera servisi de hemen değil, 5 saniye sonra yeniden başlar.
    //    Python tarafında wait_for_backend=True ile backend'i bekler.
    // ──────────────────────────────────────────────
    {
      name: 'zenith-camera',
      cwd: '/home/mahir/Zenith/ai-service',
      script: '/home/mahir/miniforge3/envs/zenith-ai/bin/python',
      args: 'main.py --service camera',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000,
      kill_timeout: 5000,
      max_memory_restart: '400M',
      env: { DISPLAY: ':0' }
    },

    // ──────────────────────────────────────────────
    // 4. SENSÖR – Backend'e bağımlı.
    // ──────────────────────────────────────────────
    {
      name: 'zenith-sensor',
      cwd: '/home/mahir/Zenith/ai-service',
      script: '/home/mahir/miniforge3/envs/zenith-ai/bin/python',
      args: 'main.py --service sensor',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 5000,
      kill_timeout: 5000,
      max_memory_restart: '100M',
    }
  ],
};
