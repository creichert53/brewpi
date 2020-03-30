const path = require('path')

const appRoot = path.resolve(__dirname)

// Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
module.exports = {
  apps : [
    {
      name: 'server',
      script: '/srv/brewpi/server/index.js',
      instances: 1,
      autorestart: true,
      watch: ['/srv/brewpi/server'],
      max_memory_restart: '1G',
      args: [
        '--color'
      ]
    },
    {
      name: 'client',
      cwd: '/srv/brewpi/client',
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
