import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const BodySchema = z.object({
  prompt: z.string().trim().min(2).max(2000),
});

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Solicitud no válida", { status: 400 });
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
          return new Response("Entrada no válida", { status: 400 });
        }
        const { prompt } = parsed.data;
        const key = process.env["Secret_OpenAI"];
        if (!key) return new Response("Falta la API key de OpenAI", { status: 500 });

        const upstream = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-image-1-mini",
            prompt: `Fotografía cenital de alta calidad de un ingrediente de cocina: ${prompt}. Sobre una tabla de madera clara, luz natural suave, estilo editorial gastronómico, fondo limpio.`,
            size: "1024x1024",
            quality: "low",
            stream: true,
            partial_images: 1,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          return new Response(await upstream.text(), { status: upstream.status });
        }


        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
