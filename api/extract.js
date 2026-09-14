module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return }

  const key   = process.env.GROQ_API_KEY
  const url   = 'https://api.groq.com/openai/v1/chat/completions'
  const model = 'meta-llama/llama-4-scout-17b-16e-instruct'

  if (!key) {
    res.status(500).json({ error:{ message:'GROQ_API_KEY not set in Vercel → Settings → Environment Variables' }})
    return
  }

  const messages = (req.body.messages || []).map(msg => {
    const blocks = Array.isArray(msg.content)
      ? msg.content
      : [{ type:'text', text: msg.content }]
    return {
      role: msg.role || 'user',
      content: blocks.map(b => b.type === 'image'
        ? { type:'image_url', image_url:{ url:`data:${b.source.media_type};base64,${b.source.data}` }}
        : { type:'text', text: b.text }
      )
    }
  })

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
      body: JSON.stringify({ model, messages, max_tokens: req.body.max_tokens || 1500, temperature: 0.1 })
    })
    const data = await upstream.json()
    if (data.error) { res.status(400).json({ error:{ message: data.error.message }}); return }
    const text = data.choices?.[0]?.message?.content || ''
    res.status(200).json({ content:[{ type:'text', text }] })
  } catch (err) {
    res.status(500).json({ error:{ message: err.message }})
  }
}
