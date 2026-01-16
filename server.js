import 'dotenv/config';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('.'));

// Proxy requests to OpenAI
app.use('/api/chat', createProxyMiddleware({
    target: 'https://api.openai.com',
    changeOrigin: true,
    pathRewrite: { '^/api/chat': '/v1/chat/completions' },
    onProxyReq: (proxyReq) => {
        proxyReq.setHeader('Authorization', `Bearer ${process.env.OPENAI_API_KEY}`);
    }
}));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
