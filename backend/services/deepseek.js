/**
 * Servicio de Inteligencia Artificial con DeepSeek API v3
 * Modelo: deepseek-chat
 * Mini Proyecto #2 - Portal de RRHH con RAG Multiagente (Costa Rica)
 */

function getApiKey() {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Configura DEEPSEEK_API_KEY en el archivo .env del backend.');
  }
  return apiKey;
}

export async function generarRespuestaDeepSeek({
  systemPrompt,
  userMessage,
  temperature = 0.3,
  maxTokens = 1200
}) {
  const apiKey = getApiKey();
  const messages = [];

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: userMessage });

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[DeepSeek API Warning ${res.status}]:`, errText);
      return null;
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.warn('[DeepSeek Exception]:', err.message);
    return null;
  }
}

export default { generarRespuestaDeepSeek };
