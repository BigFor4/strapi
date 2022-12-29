module.exports = ({ env }) => ({
    email: {
        provider: 'sendgrid',
        providerOptions: {
            apiKey: env('SENDGRID_API_KEY'),
        },
        settings: {
            defaultFrom: 'haidang11082001@gmail.com',
            defaultReplyTo: 'haidang11082001@gmail.com'
        },
    }
});
