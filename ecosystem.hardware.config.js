module.exports = {
  apps: [
    {
      name: 'zenith-led',
      cwd: '/home/mahir/Zenith/ai-service',
      script: 'sudo',
      args: '/home/mahir/miniforge3/envs/zenith-ai/bin/python main.py --service led',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 3000,
      kill_timeout: 5000,
    },
    {
      name: 'zenith-nfc',
      cwd: '/home/mahir/Zenith/ai-service',
      script: '/home/mahir/miniforge3/envs/zenith-ai/bin/python',
      args: 'main.py --service nfc',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 3000,
      kill_timeout: 5000,
    },
  ],
};
