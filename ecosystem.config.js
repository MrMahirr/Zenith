module.exports = {
  apps: [
    {
      name: 'zenith-backend',
      cwd: '/home/mahir/Zenith/backend',
      script: 'node',
      args: 'dist/main.js',
      interpreter: 'none',
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 2000,
      kill_timeout: 5000,
    },
    {
      name: 'zenith-frontend',
      cwd: '/home/mahir/Zenith/frontend',
      script: '/usr/bin/npm',
      args: 'run serve:prod',
      shell: true,
      env: {
        NODE_ENV: 'production',
      },
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
    }
  ],
};
