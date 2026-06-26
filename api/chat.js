const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.TO_EMAIL;
const FROM_EMAIL = process.env.FROM_EMAIL || 'leads@leadgenbot.com';
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || `You are a helpful sales assistant for a business. Your goals:
1. Answer visitor questions about the business, products, and services
2. Naturally collect lead information (name, email, phone) during conversation
3. Be friendly, professional, and persuasive
4. If someone asks something outside your knowledge, politely say you'll have someone reach out`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { message, history = [], leadCaptured = false } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const contents = [
      ...history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800
          }
        })
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error('Gemini API error:', geminiResp.status, errText);
      return res.status(502).json({ error: 'AI service error' });
    }

    const geminiData = await geminiResp.json();
    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

    let newLeadCaptured = leadCaptured;
    let leadInfo = null;

    if (!leadCaptured) {
      const allText = [...contents.map(c => c.parts[0].text), reply].join(' ');
      leadInfo = extractLeadInfo(allText);
      if (leadInfo) {
        newLeadCaptured = true;
        sendLeadNotification(leadInfo, history, message, reply).catch(e =>
          console.error('Email send failed:', e)
        );
      }
    }

    return res.status(200).json({
      reply,
      leadCaptured: newLeadCaptured
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function extractLeadInfo(text) {
  const lower = text.toLowerCase();
  let name = null, email = null, phone = null;

  const nameMatch = text.match(/(?:my name is|I am|I'm|calls?\s+me|name['"]?\s*:\s*)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (nameMatch) name = nameMatch[1].trim();

  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
  const emailMatch = text.match(emailRegex);
  if (emailMatch) email = emailMatch[0];

  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const phoneMatch = text.match(phoneRegex);
  if (phoneMatch) phone = phoneMatch[0].trim();

  if (name || email || phone) {
    return { name, email, phone };
  }
  return null;
}

async function sendLeadNotification(leadInfo, history, lastMessage, lastReply) {
  if (!RESEND_API_KEY || !TO_EMAIL) return;

  const fields = [];
  if (leadInfo.name) fields.push(`**Name:** ${leadInfo.name}`);
  if (leadInfo.email) fields.push(`**Email:** ${leadInfo.email}`);
  if (leadInfo.phone) fields.push(`**Phone:** ${leadInfo.phone}`);

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: `New Lead: ${leadInfo.name || leadInfo.email || 'Unknown'}`,
      html: `
        <h2>New Lead Captured</h2>
        ${fields.join('<br>')}
        <h3>Last Message:</h3>
        <p>${lastMessage}</p>
        <h3>Bot Reply:</h3>
        <p>${lastReply}</p>
        <h3>Full Conversation:</h3>
        <pre>${JSON.stringify(history.map(m => ({ role: m.role, text: m.text })), null, 2)}</pre>
      `
    })
  });
}
