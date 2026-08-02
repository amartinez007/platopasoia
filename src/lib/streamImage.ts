import { flushSync } from "react-dom";

type Frame = { b64_json?: string; type?: string; error?: { message?: string } };

export async function streamImage(
  prompt: string,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `No se pudo generar la imagen (${res.status})`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let sawCompleted = false;
  let streamError: string | undefined;

  const handleBlock = (block: string) => {
    let eventName = "";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    const data = dataLines.join("\n");
    if (!data || data === "[DONE]") return;

    let payload: Frame | undefined;
    try {
      payload = JSON.parse(data) as Frame;
    } catch {
      return;
    }

    if (eventName === "error" || payload.type === "error") {
      streamError = payload.error?.message ?? "Error al generar la imagen";
      return;
    }
    if (!payload.b64_json) return;
    const isFinal =
      eventName === "image_generation.completed" || payload.type === "image_generation.completed";
    flushSync(() => {
      onFrame(`data:image/png;base64,${payload!.b64_json}`, isFinal);
    });
    if (isFinal) sawCompleted = true;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleBlock(block);
      }
    }
    if (buffer.trim()) handleBlock(buffer);
  } finally {
    reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);
  if (!sawCompleted) throw new Error("La generación de imagen terminó sin completarse");
}
