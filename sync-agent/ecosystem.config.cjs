module.exports = {
  apps: [
    {
      name: "wowwai-sync",
      script: "index.js",
      cwd: __dirname,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
