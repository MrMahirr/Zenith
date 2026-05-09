module.exports = {
  apps: [{
    name: 'test-pm2-serve',
    script: 'serve',
    env: {
      PM2_SERVE_PATH: './dist',
      PM2_SERVE_PORT: 4173,
      PM2_SERVE_SPA: 'true',
      PM2_SERVE_HOMEPAGE: './index.html'
    }
  }]
};
