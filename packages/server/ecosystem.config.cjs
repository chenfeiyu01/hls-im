module.exports = {
  apps: [{
    name: 'chat-server',
    script: 'dist/index.js',
    env: {
      PORT: 8090,
      NODE_ENV: 'production'
    }
  }]
} 