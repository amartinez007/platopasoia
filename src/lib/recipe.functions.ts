import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ prompt: z.string().min(2).max(2000) });

export type Ingredient = { name: string; quantity: string };
export type Step = { text: string; time: string };
export type Recipe = {
  title: string;
  servings: string;
  totalTime: string;
  ingredients: Ingredient[];
  steps: Step[];
};

const SYSTEM = `Eres un chef profesional. Devuelve SIEMPRE un JSON válido con esta forma exacta:
{"title":string,"servings":string,"totalTime":string,"ingredients":[{"name":string,"quantity":string}],"steps":[{"text":string,"time":string}]}
- "quantity" incluye cantidad y unidad (ej: "200 g", "2 cucharadas").
- "steps" en orden cronológico, detallados, indicando temperatura y técnica.
- "time" es la duración estimada de ese paso (ej: "10 min").
Responde en español. Solo JSON, sin texto extra.`;

export const generateRecipe = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<Recipe> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Falta LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: data.prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Demasiadas peticiones, inténtalo en un momento.");
    if (res.status === 402) throw new Error("Se agotaron los créditos de IA del espacio de trabajo.");
    if (!res.ok) throw new Error(`Error de IA (${res.status}): ${await res.text()}`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    let parsed: Recipe;
    try {
      parsed = JSON.parse(cleaned) as Recipe;
    } catch {
      throw new Error("La IA devolvió una respuesta no válida. Inténtalo de nuevo.");
    }

    return {
      title: parsed.title ?? "Receta",
      servings: parsed.servings ?? "",
      totalTime: parsed.totalTime ?? "",
      ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
    };
  });
