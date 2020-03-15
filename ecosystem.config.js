const path = require('path')

const appRoot = path.resolve(__dirname)

// Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
module.exports = {
  apps : [
    {
      name: 'server',
      script: '/srv/brewpi/brewpi/server/server.js',
      instances: 1,
      autorestart: true,
      watch: ['/srv/brewpi/brewpi/server'],
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        NODE_PATH: appRoot,
        REACT_APP_SERVER_PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        NODE_PATH: appRoot,
        REACT_APP_ENV: 'production',
        REACT_APP_SERVER_PORT: 3001
      },
      args: [
        '--color'
      ]
    },
    {
      name: 'client',
<<<<<<< HEAD
      cwd: '/srv/brewpi/brewpi',
=======
      cwd: '/srv/brewpi/client',
>>>>>>> test
      script: 'npm',
      args: 'start',
      instances: 1,
      max_memory_restart: '1G',
      args: [
        'start',
        '--color'
      ]
    },
    // {
    //   name: 'docker',
    //   // cwd: '/srv/brewpi'
    //   // interpreter: '/usr/bin/docker-compose',
    //   // args: 'up',
    //   script: '/srv/brewpi/docker/index.js',
    //   instances: 1,
    //   autorestart: true,
    //   watch: ['/srv/brewpi/docker'],
    //   max_memory_restart: '2G'
    // }
  ],
  deploy : {
    production : {
      user : 'node',
      host : '212.83.163.1',
      ref  : 'origin/master',
      repo : 'git@github.com:repo.git',
      path : '/var/www/build',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};
