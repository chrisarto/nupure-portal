// PM2 Ecosystem Config — Gotzinger Portal
module.exports = {
  apps: [
    {
      name: 'gotzinger-portal-app',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: '/var/www/gotzinger-portal',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'gotzinger-airtable-sync',
      script: 'scripts/sync-airtable.mjs',
      cwd: '/var/www/gotzinger-portal',
      node_args: '--env-file=.env.local',
      instances: 1,
      autorestart: false,
      watch: false,
      cron_restart: '*/30 * * * *',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
