import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChefHat, Clock, ImageIcon, Loader2, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { generateRecipe, type Recipe } from "@/lib/recipe.functions";
import { streamImage } from "@/lib/streamImage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZenvorIA — Recetas con IA, ingredientes e imágenes" },
      {
        name: "description",
        content:
          "Escribe lo que quieres cocinar y ZenvorIA crea la lista de ingredientes en checklist, genera una imagen de cada ingrediente y el paso a paso con tiempos.",
      },
      { property: "og:title", content: "ZenvorIA — Recetas con IA" },
      {
        property: "og:description",
        content:
          "Checklist de ingredientes, imágenes generadas con IA y procedimiento paso a paso con tiempos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type ImgState = { src: string; final: boolean; loading: boolean };

function Index() {
  const create = useServerFn(generateRecipe);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [images, setImages] = useState<Record<number, ImgState>>({});

  async function onCreate() {
    if (prompt.trim().length < 3) {
      toast.error("Describe qué quieres cocinar");
      return;
    }
    setLoading(true);
    setRecipe(null);
    setChecked({});
    setImages({});
    try {
      const result = await create({ data: { prompt } });
      setRecipe(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear la receta");
    } finally {
      setLoading(false);
    }
  }

  async function onImage(index: number, name: string) {
    setImages((prev) => ({ ...prev, [index]: { src: "", final: false, loading: true } }));
    try {
      await streamImage(name, (src, final) => {
        setImages((prev) => ({ ...prev, [index]: { src, final, loading: !final } }));
      });
    } catch (error) {
      setImages((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      toast.error(error instanceof Error ? error.message : "No se pudo generar la imagen");
    }
  }

  return (
    <div className="min-h-screen">
      <Toaster position="top-center" />

      <header className="mx-auto max-w-3xl px-5 pt-16 pb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <Sparkles className="size-3.5 text-primary" /> Cocina con inteligencia artificial
        </span>
        <h1 className="mt-5 text-5xl leading-[1.05] font-black tracking-tight sm:text-6xl">
          Zenvor<span className="text-primary">IA</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
          Cuéntame qué te apetece cocinar. Te devuelvo la lista de ingredientes en checklist, una
          imagen de cada uno y el procedimiento paso a paso con tiempos.
        </p>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24">
        <Card className="shadow-soft border-border/70 p-5">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Ej: Una lasaña vegetariana para 4 personas, sin lactosa, en menos de una hora"
            className="min-h-28 resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
          />
          <div className="flex justify-end border-t border-border pt-4">
            <Button size="lg" onClick={onCreate} disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Cocinando…
                </>
              ) : (
                <>
                  <ChefHat className="size-4" /> Crear receta
                </>
              )}
            </Button>
          </div>
        </Card>

        {recipe ? (
          <div className="mt-12 space-y-12">
            <section>
              <h2 className="text-3xl font-bold tracking-tight">{recipe.title}</h2>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {recipe.totalTime ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4 text-primary" /> {recipe.totalTime}
                  </span>
                ) : null}
                {recipe.servings ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-4 text-primary" /> {recipe.servings}
                  </span>
                ) : null}
              </div>
            </section>

            <section>
              <h3 className="mb-4 text-xl font-bold">Ingredientes</h3>
              <ul className="space-y-3">
                {recipe.ingredients.map((ingredient, index) => {
                  const image = images[index];
                  return (
                    <li key={`${ingredient.name}-${index}`}>
                      <Card className="shadow-soft border-border/70 gap-0 overflow-hidden p-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <Checkbox
                            id={`ing-${index}`}
                            checked={!!checked[index]}
                            onCheckedChange={(value) =>
                              setChecked((prev) => ({ ...prev, [index]: value === true }))
                            }
                          />
                          <label
                            htmlFor={`ing-${index}`}
                            className={`flex-1 cursor-pointer text-sm ${
                              checked[index] ? "text-muted-foreground line-through" : ""
                            }`}
                          >
                            <span className="font-semibold">{ingredient.quantity}</span>{" "}
                            {ingredient.name}
                          </label>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5"
                            disabled={image?.loading}
                            onClick={() => onImage(index, ingredient.name)}
                          >
                            {image?.loading ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <ImageIcon className="size-3.5" />
                            )}
                            {image ? "Regenerar" : "Generar imagen"}
                          </Button>
                        </div>

                        {image?.src ? (
                          <img
                            src={image.src}
                            alt={`Imagen generada de ${ingredient.name}`}
                            className={`mt-4 aspect-square w-full max-w-56 rounded-xl object-cover transition-[filter] duration-500 ${
                              image.final ? "blur-0" : "blur-xl"
                            }`}
                          />
                        ) : null}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h3 className="mb-4 text-xl font-bold">Procedimiento</h3>
              <ol className="space-y-4">
                {recipe.steps.map((step, index) => (
                  <li key={index} className="flex gap-4">
                    <span className="bg-gradient-warm text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                      {index + 1}
                    </span>
                    <Card className="shadow-soft border-border/70 flex-1 gap-2 p-4">
                      <p className="text-sm leading-relaxed">{step.text}</p>
                      {step.time ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="size-3.5 text-primary" /> {step.time}
                        </span>
                      ) : null}
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
