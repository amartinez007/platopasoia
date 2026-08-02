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
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Falta LOVABLE_API_KEY", { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image",
            messages: [
              {
                role: "user",
                content: `Fotografía cenital de alta calidad de un ingrediente de cocina: ${prompt}. Sobre una tabla de madera clara, luz natural suave, estilo editorial gastronómico, fondo limpio.`,
              },
            ],
            modalities: ["image", "text"],
            stream: true,
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const raw = await upstream.text();
          let message = `Error al generar la imagen (${upstream.status})`;
          if (upstream.status === 429) {
            message = "Demasiadas solicitudes. Inténtalo de nuevo en unos segundos.";
          } else if (upstream.status === 402) {
            message = "Se han agotado los créditos de IA del espacio de trabajo.";
          } else {
            try {
              const parsedError = JSON.parse(raw) as { error?: { message?: string } };
              if (parsedError.error?.message) message = parsedError.error.message;
            } catch {
              /* respuesta no JSON */
            }
          }
          return new Response(message, { status: upstream.status });
        }

        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
