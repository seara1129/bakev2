// netlify/functions/extract.js
// Netlify auto-detects this as a serverless function — no config needed.
// Add GROQ_API_KEY in Netlify → Site configuration → Environment variables

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error:{ message:'GROQ_API_KEY not set in Netlify → Site configuration → Environment variables' }})
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')

    const messages = (body.messages || []).map(msg => {
      const blocks = Array.isArray(msg.content)
        ? msg.content
        : [{ type:'text', text: String(msg.content || '') }]
      return {
        role: msg.role || 'user',
        content: blocks.map(b => b.type === 'image'
          ? { type:'image_url', image_url:{ url:`data:${b.source.media_type};base64,${b.source.data}` }}
          : { type:'text', text: String(b.text || '') }
        )
      }
    })

    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
      body: JSON.stringify({ model:'meta-llama/llama-4-scout-17b-16e-instruct', messages, max_tokens: body.max_tokens || 1500, temperature: 0.1 })
    })

    const data = await upstream.json()
    if (data.error) {
      return { statusCode: 400, body: JSON.stringify({ error:{ message: data.error.message }}) }
    }

    const text = data.choices?.[0]?.message?.content || ''
    return {
      statusCode: 200,
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ content:[{ type:'text', text }] })
    }
  } catch(err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error:{ message: err.message || 'Unknown error' }})
    }
  }
}
