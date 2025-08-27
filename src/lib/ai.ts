type Car = any; type Mod = any;

export async function aiFallback(car: Car, mods: Mod[]) {
  const apiKey = process.env.MISTRAL_API_KEY; // or switch to Anthropic later
  if (!apiKey) return {}; // no AI key -> skip

  const prompt = `You are a cautious automotive tuner.
Given car specs and a list of mods, provide conservative notes about compounding effects, heat, and tune requirements.
Return strictly JSON with keys: {notes: string[]}. Avoid inventing power numbers.`;

  try {
    const resp = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral-medium-latest",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" }
      })
    });
    if (!resp.ok) return {};
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content || "{}");
    if (!parsed || !Array.isArray(parsed.notes)) return {};
    return { notes: parsed.notes };
  } catch {
    return {};
  }
}
