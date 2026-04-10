module.exports = {
  apps: [
    {
      name: 'flashcred-server',
      script: 'xvfb-run',
      args: '--auto-servernum --server-args="-screen 0 1366x768x24" node dist/index.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        RPA_HEADLESS: 'false'
      },
      max_memory_restart: '1.2G',
      error_file: 'logs/err.log',
      out_file: 'logs/out.log',
      min_uptime: '15s',
      restart_delay: 5000
    }
  ]
};
