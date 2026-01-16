export async function POST(request) {
    const body = await request.json();

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const error = await response.json();
        return Response.json({ error: error.error?.message || 'API Error' }, { status: response.status });
    }

    // Stream the response
    return new Response(response.body, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
