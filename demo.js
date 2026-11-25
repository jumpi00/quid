// Modalità demo (?demo): stessi metodi di api.js ma con dati finti in memoria. Nulla viene salvato.

const uid = () => crypto.randomUUID()
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d) }
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export function createDemoApi () {
  const names = ['Spesa', 'Ristoranti e bar', 'Trasporti', 'Casa', 'Bollette', 'Abbonamenti',
    'Salute', 'Shopping', 'Svago', 'Viaggi', 'Regali', 'Altro']
  const budgets = { Spesa: 400, 'Ristoranti e bar': 150, Trasporti: 80, Abbonamenti: 40, Svago: 60 }
  const cats = names.map((name, i) => ({ id: uid(), name, budget: budgets[name] ?? null, position: i + 1, archived: false }))
  const cat = (n) => cats.find(c => c.name === n).id
  const rules = []
  const rec = [
    { id: uid(), name: 'Affitto', amount: 650, category_id: cat('Casa'), frequency: 'monthly', start_date: daysAgo(1), next_index: 1, mode: 'confirm', active: true },
    { id: uid(), name: 'Netflix', amount: 12.99, category_id: cat('Abbonamenti'), frequency: 'monthly', start_date: daysAgo(-6), next_index: 0, mode: 'auto', active: true }
  ]
  const t = (days, amount, merchant, c, extra = {}) => ({
    id: uid(), amount, merchant, note: '', category_id: c ? cat(c) : null, card: 'Carta',
    source: 'applepay', status: 'confirmed', needs_review: false, recurring_id: null,
    occurred_on: daysAgo(days), created_at: new Date(Date.now() - days * 864e5).toISOString(), ...extra
  })
  const tx = [
    t(0, 23.4, 'Esselunga', 'Spesa'),
    t(0, 1.3, 'Bar Centrale', 'Ristoranti e bar', { needs_review: true }),
    t(1, 2.2, 'ATM Milano', 'Trasporti'),
    t(2, 64.1, 'Esselunga', 'Spesa'),
    t(3, 38, 'Pizzeria Da Mario', 'Ristoranti e bar'),
    t(4, 19.9, 'Libreria Hoepli', null, { needs_review: true }),
    t(6, 9.99, 'Spotify', 'Abbonamenti'),
    t(8, 45, 'Farmacia Centrale', 'Salute', { source: 'manual', card: '' }),
    t(1, 650, 'Affitto', 'Casa', { source: 'recurring', status: 'pending', recurring_id: rec[0].id })
  ]
  const tokens = []
  const clone = (x) => JSON.parse(JSON.stringify(x))
  const wait = () => new Promise(r => setTimeout(r, 60))

  return {
    demo: true,
    start: async () => 0,
    categories: async () => { await wait(); return clone(cats.sort((a, b) => a.position - b.position)) },
    saveCategory: async (c) => {
      if (c.id) Object.assign(cats.find(x => x.id === c.id), c)
      else cats.push({ id: uid(), archived: false, position: cats.length + 1, budget: null, ...c })
    },
    month: async (from, to) => clone(tx.filter(x => x.status === 'confirmed' && x.occurred_on >= from && x.occurred_on <= to)
      .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at))),
    inbox: async () => clone(tx.filter(x => x.status === 'pending' || x.needs_review)
      .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))),
    all: async () => clone(tx),
    saveTx: async (x) => {
      if (x.id) Object.assign(tx.find(y => y.id === x.id), x)
      else tx.push({ ...t(0, 0, ''), source: 'manual', card: '', ...x, id: uid() })
    },
    confirmTx: async (id, patch = {}) => Object.assign(tx.find(y => y.id === id), patch, { status: 'confirmed', needs_review: false }),
    deleteTx: async (id) => tx.splice(tx.findIndex(y => y.id === id), 1),
    setCategory: async (id, categoryId, remember) => {
      const x = tx.find(y => y.id === id)
      Object.assign(x, { category_id: categoryId, needs_review: false })
      if (remember && x.merchant) {
        rules.push({ pattern: norm(x.merchant), category_id: categoryId })
        tx.filter(y => y.needs_review && norm(y.merchant) === norm(x.merchant))
          .forEach(y => Object.assign(y, { category_id: categoryId, needs_review: false }))
      }
    },
    recurring: async () => clone(rec),
    saveRecurring: async (r) => {
      if (r.id) Object.assign(rec.find(y => y.id === r.id), r)
      else rec.push({ next_index: 0, active: true, ...r, id: uid() })
    },
    deleteRecurring: async (id) => {
      for (let i = tx.length - 1; i >= 0; i--) if (tx[i].recurring_id === id && tx[i].status === 'pending') tx.splice(i, 1)
      rec.splice(rec.findIndex(y => y.id === id), 1)
    },
    tokens: async () => clone(tokens.filter(x => !x.revoked_at)),
    createToken: async (label) => {
      const token = 'quid_' + Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
      tokens.push({ id: uid(), label, created_at: new Date().toISOString(), last_used_at: null, revoked_at: null })
      return token
    },
    revokeToken: async (id) => { tokens.find(x => x.id === id).revoked_at = new Date().toISOString() }
  }
}
