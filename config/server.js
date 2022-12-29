module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('API_URL', 'http://localhost:1337'),
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET', '64ee9b86fe34d6a8a9a80692470a1b20'),
    },
    url: env('PUBLIC_ADMIN_URL', '/admin')
  }
});
