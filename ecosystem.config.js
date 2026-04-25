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
      name: 'zenith-ai',
      cwd: '/home/mahir/zenith/ai-service',
      // Conda ortamının kendi izole Python'unu doğrudan çağırıyoruz:
      script: '/home/mahir/miniforge3/envs/zenith-ai/bin/python',
      args: 'main.py',
      env: {
        DISPLAY: ':0'
      }
    }
  ],
};
