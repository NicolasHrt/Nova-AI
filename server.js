import 'dotenv/config';
import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.static('.'));
app.use(express.json());

app.post('/api/chat', async (req, res) => {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify(req.body)
        });

        res.setHeader('Content-Type', 'text/event-stream');
        response.body.pipeTo(new WritableStream({
            write(chunk) {
                res.write(chunk);
            },
            close() {
                res.end();
            }
        }));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
