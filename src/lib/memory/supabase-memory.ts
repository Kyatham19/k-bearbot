import { createAdminClient } from '@/lib/supabase/admin';

type MemoryEntry = {
  id?: string;
  user_id: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[] | null;
};

async function getOpenAIEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const emb = data?.data?.[0]?.embedding;
    if (!emb || !Array.isArray(emb)) return null;
    return emb as number[];
  } catch (err) {
    console.warn('Embedding generation failed:', err);
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export async function upsertMemory(entry: MemoryEntry) {
  const admin = createAdminClient();
  const embedding = await getOpenAIEmbedding(entry.content).catch(() => null);

  const payload: any = {
    user_id: entry.user_id,
    content: entry.content,
    metadata: entry.metadata || null,
    embedding: embedding ? JSON.stringify(embedding) : null,
  };
  if (entry.id) payload.id = entry.id;

  // Use upsert so callers can provide id for updates
  const { data, error } = await admin
    .from('memories')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    console.error('Failed to upsert memory:', error);
    return null;
  }
  return data;
}

export async function queryMemoriesByText(user_id: string, text: string, k = 5) {
  const admin = createAdminClient();
  const queryEmb = await getOpenAIEmbedding(text).catch(() => null);

  // Fallback to simple full-text search if embedding not available
  if (!queryEmb) {
    const { data } = await admin
      .from('memories')
      .select('*')
      .textSearch('content', text, { config: 'english' })
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(k);

    return data || [];
  }

  // Fetch recent candidates then rank in JS by cosine similarity
  const { data: candidates } = await admin
    .from('memories')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(500);

  if (!candidates || candidates.length === 0) return [];

  const parsed = (candidates as any[])
    .map((c) => {
      let emb: number[] | null = null;
      try {
        if (c.embedding) emb = JSON.parse(c.embedding);
      } catch {
        emb = null;
      }
      return {
        ...c,
        _embedding: emb,
        _score: emb ? cosineSimilarity(queryEmb, emb) : 0,
      };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, k);

  return parsed;
}
