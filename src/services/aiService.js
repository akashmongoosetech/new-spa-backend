import { GoogleGenAI } from '@google/genai';

let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export async function processAiChat(message, history = []) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        reply: `Namaste! Welcome to Aura Luxe Spa Concierge in Bandra West, Mumbai. How may I assist you with your booking today? Our certified male therapists offer Swedish, Deep Tissue, Kerala Abhyanga, and Volcanic Hot Stone therapies.`
      };
    }

    const ai = getAiClient();
    const systemInstruction = `You are Aura Luxe Spa's AI Assistant, located in Bandra West, Mumbai.
You provide courteous, helpful answers about Aura Luxe's Men-to-Men massage therapy and wellness spa services.
Key facts:
- Services: Swedish Relaxation (₹1,999), Deep Tissue Recovery (₹2,499), Kerala Ayurvedic Abhyanga (₹2,799), Volcanic Hot Stone (₹2,999).
- Location: Plot 42, Bandra Reclamation, Bandra West, Mumbai 400050.
- Certified male therapists: Rajesh Varma, Vikram Malhotra, Arjun Nair.
- Timing: Mon - Sun 09:00 AM - 10:00 PM IST.
Be warm, professional, concise, and helpful.`;

    const contents = [
      ...history.map(h => ({
        role: h.sender === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    return { reply: response.text || "Thank you for reaching out to Aura Luxe Spa." };
  } catch (err) {
    console.error("AI service error:", err.message);
    return {
      reply: `Welcome to Aura Luxe Spa Concierge! Our Bandra West sanctuary is open daily from 9:00 AM to 10:00 PM. How may we assist you with your massage therapy booking?`
    };
  }
}
