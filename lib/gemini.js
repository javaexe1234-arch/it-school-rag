/* =========================================================
   Минимальный клиент Gemini API (без зависимостей, Node 18+)
   Ключ передаётся только с сервера — в браузер он не попадает
   ========================================================= */
const BASE = 'https://generativelanguage.googleapis.com/v1beta';

class GeminiClient {
  constructor({ apiKey, model, embedModel = 'gemini-embedding-001', timeoutMs = 30000 }) {
    if (!apiKey) throw new Error('GEMINI_API_KEY не задан');
    this.apiKey = apiKey;
    this.model = model;
    this.embedModel = embedModel;
    this.timeoutMs = timeoutMs;
  }

  /* Временные ошибки Google (перегрузка 503, 500, лимит 429) — повторяем до 2 раз с паузой */
  async request(path, body) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this._request(path, body);
      } catch (e) {
        const retryable = [429, 500, 503].includes(e.status) || e.name === 'TimeoutError';
        if (!retryable || attempt >= 2) throw e;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  async _request(path, body) {
    const res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json.error && json.error.message) || res.statusText;
      const err = new Error(`Gemini ${res.status}: ${msg}`);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  /** Генерация ответа. contents — история в формате Gemini */
  async generate({ system, contents, temperature = 0.2, maxOutputTokens = 2048 }) {
    const json = await this.request(`models/${this.model}:generateContent`, {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature, maxOutputTokens }
    });
    const cand = json.candidates && json.candidates[0];
    const text = cand && cand.content && (cand.content.parts || [])
      .filter(p => p.text && !p.thought)
      .map(p => p.text).join('').trim();
    if (!text) {
      const reason = (cand && cand.finishReason) || (json.promptFeedback && json.promptFeedback.blockReason) || 'empty';
      throw new Error('Пустой ответ модели: ' + reason);
    }
    return text;
  }

  /**
   * Генерация с инструментами (function calling): модель может вызвать функции,
   * сервер выполняет их и возвращает результат модели, пока она не даст текстовый ответ.
   * @param {object[]} tools  functionDeclarations
   * @param {function} execute async (name, args) => object
   * @returns {{ text: string, calls: Array<{name, args, result}> }}
   */
  async generateWithTools({ system, contents, tools, execute, temperature = 0.2, maxOutputTokens = 2048, maxSteps = 4 }) {
    const convo = contents.slice();
    const calls = [];
    for (let step = 0; step <= maxSteps; step++) {
      const json = await this.request(`models/${this.model}:generateContent`, {
        systemInstruction: { parts: [{ text: system }] },
        contents: convo,
        tools: [{ functionDeclarations: tools }],
        toolConfig: { functionCallingConfig: { mode: step < maxSteps ? 'AUTO' : 'NONE' } },
        generationConfig: { temperature, maxOutputTokens }
      });
      const cand = json.candidates && json.candidates[0];
      const parts = (cand && cand.content && cand.content.parts) || [];
      const fnCalls = parts.filter(p => p.functionCall);
      if (!fnCalls.length) {
        const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
        if (!text) {
          const reason = (cand && cand.finishReason) || (json.promptFeedback && json.promptFeedback.blockReason) || 'empty';
          throw new Error('Пустой ответ модели: ' + reason);
        }
        return { text, calls };
      }
      // Ход модели возвращаем как есть (включая служебные подписи мыслей), затем — результаты функций
      convo.push({ role: 'model', parts });
      const responses = [];
      for (const p of fnCalls) {
        const { name, args } = p.functionCall;
        let result;
        try { result = await execute(name, args || {}); }
        catch (e) { result = { ok: false, error: e.code || 'error', message: e.message, ...(e.options ? { options: e.options } : {}) }; }
        calls.push({ name, args, result });
        responses.push({ functionResponse: { name, ...(p.functionCall.id ? { id: p.functionCall.id } : {}), response: result } });
      }
      convo.push({ role: 'user', parts: responses });
    }
    throw new Error('Модель не завершила ответ');
  }

  /** Эмбеддинги документов (пачками по 100) */
  async embedDocuments(items) {
    const out = [];
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);
      const json = await this.request(`models/${this.embedModel}:batchEmbedContents`, {
        requests: batch.map(it => ({
          model: `models/${this.embedModel}`,
          content: { parts: [{ text: it.text }] },
          taskType: 'RETRIEVAL_DOCUMENT',
          title: it.title,
          outputDimensionality: 768
        }))
      });
      out.push(...json.embeddings.map(e => e.values));
    }
    return out;
  }

  async embedQuery(text) {
    const json = await this.request(`models/${this.embedModel}:embedContent`, {
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: 768
    });
    return json.embedding.values;
  }
}

module.exports = { GeminiClient };
