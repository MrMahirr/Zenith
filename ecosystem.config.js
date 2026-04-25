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
      script: 'sudo',
      args: '/home/mahir/miniforge3/envs/zenith-ai/bin/python main.py --service camera',
      env: { DISPLAY: ':0' }
    },
    {
      name: 'zenith-sensor',
      cwd: '/home/mahir/Zenith/ai-service',
      script: 'sudo',
      args: '/home/mahir/miniforge3/envs/zenith-ai/bin/python main.py --service sensor',
    },
    {
      name: 'zenith-led',
      cwd: '/home/mahir/Zenith/ai-service',
      script: 'sudo',
      args: '/home/mahir/miniforge3/envs/zenith-ai/bin/python main.py --service led',
    },
    {
      name: 'zenith-nfc',
      cwd: '/home/mahir/Zenith/ai-service',
      script: 'sudo',
      args: '/home/mahir/miniforge3/envs/zenith-ai/bin/python main.py --service nfc',
    }
  ],
};
