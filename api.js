// Accesso ai dati su Supabase. Tutte le query passano da RLS (solo i propri dati, solo con 2FA).

const ok = ({ data, error }) => {
  if (error) throw new Error(error.message)
  return data
}
const pick = (o, keys) => Object.fromEntries(keys.filter(k => k in o).map(k => [k, o[k]]))
const TX_FIELDS = ['amount', 'merchant', 'note', 'category_id', 'occurred_on']
const REC_FIELDS = ['name', 'amount', 'category_id', 'frequency', 'start_date', 'next_index', 'mode', 'active']

export function createApi (sb) {
  return {
    start: async () => ok(await sb.rpc('app_start')),

    categories: async () =>
      ok(await sb.from('categories').select('*').order('position').order('name')),
    saveCategory: async (c) => {
      const row = pick(c, ['name', 'budget', 'position', 'archived'])
      return c.id
        ? ok(await sb.from('categories').update(row).eq('id', c.id))
        : ok(await sb.from('categories').insert(row))
    },

    month: async (from, to) =>
      ok(await sb.from('transactions').select('*')
        .eq('status', 'confirmed').gte('occurred_on', from).lte('occurred_on', to)
        .order('occurred_on', { ascending: false }).order('created_at', { ascending: false })),
    inbox: async () =>
      ok(await sb.from('transactions').select('*')
        .or('status.eq.pending,needs_review.eq.true')
        .order('occurred_on').order('created_at')),
    all: async () =>
      ok(await sb.from('transactions').select('*').order('occurred_on').order('created_at')),

    saveTx: async (t) => {
      const row = pick(t, TX_FIELDS)
      return t.id
        ? ok(await sb.from('transactions').update(row).eq('id', t.id))
        : ok(await sb.from('transactions').insert(row))
    },
    confirmTx: async (id, patch = {}) =>
      ok(await sb.from('transactions')
        .update({ ...pick(patch, TX_FIELDS), status: 'confirmed', needs_review: false }).eq('id', id)),
    deleteTx: async (id) => ok(await sb.from('transactions').delete().eq('id', id)),
    setCategory: async (id, categoryId, remember) =>
      ok(await sb.rpc('set_category', { p_tx: id, p_category: categoryId, p_remember: remember })),

    recurring: async () =>
      ok(await sb.from('recurring').select('*').order('name')),
    saveRecurring: async (r) => {
      const row = pick(r, REC_FIELDS)
      return r.id
        ? ok(await sb.from('recurring').update(row).eq('id', r.id))
        : ok(await sb.from('recurring').insert(row))
    },
    deleteRecurring: async (id) => {
      ok(await sb.from('transactions').delete().eq('recurring_id', id).eq('status', 'pending'))
      return ok(await sb.from('recurring').delete().eq('id', id))
    },

    tokens: async () =>
      ok(await sb.from('ingest_tokens').select('id,label,created_at,last_used_at,revoked_at')
        .is('revoked_at', null).order('created_at')),
    createToken: async (label) => ok(await sb.rpc('create_ingest_token', { p_label: label })),
    revokeToken: async (id) =>
      ok(await sb.from('ingest_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id))
  }
}
