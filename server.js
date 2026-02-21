import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  try {
    const userMsg = req.body.messages && req.body.messages.length > 0
      ? req.body.messages[req.body.messages.length - 1].content || ''
      : '';

    const wordCount = userMsg.trim().split(/\s+/).length;
    const isDeepQuestion = /plan|strategy|how to|step.?by.?step|explain|detail|breakdown|analyze|help me with|guide/i.test(userMsg);

    let maxTokens = 300;
    if (wordCount > 30 || isDeepQuestion) maxTokens = 600;
    if (wordCount > 80) maxTokens = 800;

    if (req.body.max_tokens) maxTokens = Math.min(req.body.max_tokens, 1000);

    const messages = req.body.messages || [];
    const trimmedMessages = messages.length > 16
      ? messages.slice(messages.length - 16)
      : messages;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: req.body.system,
        messages: trimmedMessages
      })
    });
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = parseInt(process.env.PORT || '5000', 10);
app.listen(PORT, '0.0.0.0', () => console.log('Running on port ' + PORT));
