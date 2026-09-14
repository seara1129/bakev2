// api/extract.js — Vercel serverless function
//
// Uses Groq (free, no credit card) by default.
// Swap to OpenRouter by changing the three lines marked "── SWITCH ──"
//
// GROQ setup (recommended):
//   1. console.groq.com → sign up → API Keys → Create key
//   2. Vercel → Settings → Environment Variables → GROQ_API_KEY = gsk_...
//
// OpenRouter setup (alternative, if Groq vision model is unavailable):
//   1. openrouter.ai → sign up → Keys → Create key  
//   2. Vercel → Settings → Environment Variables → OPENROUTER_API_KEY = sk-or-...
//   3. Change the three lines below marked "── SWITCH ──"

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return }

  // ── SWITCH: change these three lines to swap providers ──────────────────
  const key       = process.env.GROQ_API_KEY                              // env var name
  const url       = 'https://api.groq.com/openai/v1/chat/completions'    // API endpoint
  const model     = 'llama-3.2-11b-vision-preview'                        // vision model
  // OpenRouter alternative values:
  //   key   = process.env.OPENROUTER_API_KEY
  //   url   = 'https://openrouter.ai/api/v1/chat/completions'
  //   model = 'nvidia/llama-3.1-nemotron-nano-8b-v1:free'  ← check openrouter.ai/models
  // ────────────────────────────────────────────────────────────────────────

  if (!key) {
    res.status(500).json({ error:{message:'API key env variable is not set in Vercel → Settings → Environment Variables'} })
    return
  }

  // Convert Anthropic-style messages → OpenAI format (used by Groq + OpenRouter)
  const messages = (req.body.messages || []).map(msg => {
    const blocks = Array.isArray(msg.content)
      ? msg.content
      : [{ type:'text', text: msg.content }]

    return {
      role: msg.role || 'user',
      content: blocks.map(b => {
        if (b.type === 'image') {
          // Anthropic: { source: { media_type, data } }
          // OpenAI:    { image_url: { url: "data:mime;base64,..." } }
          return { type:'image_url', image_url:{ url:`data:${b.source.media_type};base64,${b.source.data}` } }
        }
        return { type:'text', text: b.text }
      })
    }
  })

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens:  req.body.max_tokens || 1500,
        temperature: 0.1   // low temperature = more consistent JSON output
      })
    })

    const data = await upstream.json()

    if (data.error) {
      // Provider returned an error (wrong model name, rate limit, etc.)
      res.status(400).json({ error:{ message: data.error.message || JSON.stringify(data.error) } })
      return
    }

    // Convert OpenAI response → Anthropic-shaped response so the frontend
    // doesn't need to know which provider is running underneath
    const text = data.choices?.[0]?.message?.content || ''
    res.status(200).json({ content:[{ type:'text', text }] })

  } catch (err) {
    res.status(500).json({ error:{ message: err.message } })
  }
}

