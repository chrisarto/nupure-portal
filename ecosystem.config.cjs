module.exports = {
  apps: [
    {
      name: 'gotzinger-portal-app',
      script: 'node_modules/.bin/next',
      args: 'start -p 3010',
      cwd: '/var/www/gotzinger-portal',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
    {
      name: 'gotzinger-airtable-sync',
      script: 'scripts/sync-airtable.mjs',
      cwd: '/var/www/gotzinger-portal',
      cron_restart: '*/30 * * * *',   // every 30 minutes
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'gotzinger-email-ingest',
      script: 'scripts/cron-ingest.mjs',
      cwd: '/var/www/gotzinger-portal',
      cron_restart: '0 21,23,2 * * *',   // 7am, 9am, 12pm AEST (UTC)
      autorestart: false,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
