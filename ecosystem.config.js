module.exports = {
  apps: [
    {
      name: 'zenith-backend',
      cwd: '/home/mahir/Zenith/backend',
      script: 'npm',
      args: 'run start',
    },
    {
      name: 'zenith-frontend',
      cwd: '/home/mahir/Zenith/frontend',
      script: 'npm',
      args: 'run dev -- --host',
    },
    {
      name: 'zenith-camera',
      cwd: '/home/mahir/Zenith/ai-service',
      script: '/home/mahir/miniforge3/envs/zenith-ai/bin/python',
      args: 'main.py --service camera',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
      kill_timeout: 5000,
      env: { DISPLAY: ':0' }
    },
    {
      name: 'zenith-sensor',
      cwd: '/home/mahir/Zenith/ai-service',
      script: '/home/mahir/miniforge3/envs/zenith-ai/bin/python',
      args: 'main.py --service sensor',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
      kill_timeout: 5000,
    },
    {
      name: 'zenith-led',
      cwd: '/home/mahir/Zenith/ai-service',
      script: '/home/mahir/miniforge3/envs/zenith-ai/bin/python',
      args: 'main.py --service led',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
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
      kill_timeout: 5000,
    }
  ],
};
