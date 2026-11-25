import { SUPABASE_URL, SUPABASE_KEY } from './config.js?v=202611252123'
import { createApi } from './api.js?v=202611252123'
import { createDemoApi } from './demo.js?v=202611252123'

const GUIDE_URL = 'https://github.com/jumpi00/quid/blob/main/docs/comando-rapido.md'
const $app = document.getElementById('app')
const $sheet = document.getElementById('sheet')
const isDemo = new URLSearchParams(location.search).has('demo')

let sb = null
let api = null
const state = { view: 'mese', month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), cats: [], inbox: [], tx: new Map(), rec: [], email: '' }

// ---------------------------------------------------------------- utilità

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const money = (n) => eur.format(Number(n) || 0)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const todayIso = () => iso(new Date())
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const fmtDay = (s) => parseDate(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtShort = (s) => parseDate(s).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
const amountInput = (n) => n == null ? '' : String(n).replace('.', ',')
const catName = (id) => state.cats.find(c => c.id === id)?.name ?? 'Da categorizzare'
const activeCats = () => state.cats.filter(c => !c.archived)
const FREQ = { weekly: 'Ogni settimana', monthly: 'Ogni mese', yearly: 'Ogni anno' }
const SOURCE = { applepay: 'Apple Pay', manual: 'A mano', recurring: 'Ricorrente' }

// "12,50" / "1.234,56" / "€ 7" -> numero (stessa logica di parse_amount in SQL)
function parseAmount (t) {
  const s = String(t ?? '').replace(/[^0-9,.]/g, '')
  if (!s) return NaN
  const pc = s.lastIndexOf(','); const pd = s.lastIndexOf('.')
  let p = Math.max(pc, pd)
  if (p >= 0 && !(pc >= 0 && pd >= 0)) {
    const decs = s.length - p - 1
    if (decs < 1 || decs > 2) p = -1
  }
  const int = (p >= 0 ? s.slice(0, p) : s).replace(/[,.]/g, '')
  const dec = p >= 0 ? s.slice(p + 1) : ''
  return Math.round(Number(int + (dec ? '.' + dec : '')) * 100) / 100
}

// stessa logica di recurring_date in SQL (fine mese: 31 gen -> 28 feb -> 31 mar)
function recDate (start, freq, idx) {
  const d = parseDate(start)
  if (freq === 'weekly') { d.setDate(d.getDate() + 7 * idx); return iso(d) }
  const m = d.getMonth() + (freq === 'monthly' ? idx : 12 * idx)
  const last = new Date(d.getFullYear(), m + 1, 0).getDate()
  return iso(new Date(d.getFullYear(), m, Math.min(d.getDate(), last)))
}

let toastTimer
function toast (msg) {
  document.querySelector('.toast')?.remove()
  const el = document.createElement('div')
  el.className = 'toast'
  el.setAttribute('role', 'status')
  el.textContent = msg
  document.body.append(el)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.remove(), 3000)
}

async function guard (fn) {
  try { return await fn() } catch (e) { console.error(e); toast(e.message || 'Errore') }
}

// ---------------------------------------------------------------- avvio e accesso

async function boot () {
  if (isDemo) {
    api = createDemoApi()
    state.email = 'demo'
    return main()
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    $app.innerHTML = `<h1 class="brand"><img class="logo" src="icons/logo.svg?v=202611252123" alt="">Quid</h1><p class="muted">Configurazione mancante: aggiungi URL e chiave di Supabase in config.js.</p>
      <p><a href="?demo">Apri la demo</a></p>`
    return
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'quid-auth' }
  })
  api = createApi(sb)
  await authGate()
}

async function authGate () {
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return renderLogin()
  state.email = session.user.email
  const { data: aal, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) return renderLogin(error.message)
  if (aal.currentLevel === 'aal2') return main()
  if (aal.nextLevel === 'aal2') return renderMfaVerify()
  return renderMfaEnroll()
}

function renderLogin (msg = '') {
  $app.innerHTML = `
    <h1 class="brand"><img class="logo" src="icons/logo.svg?v=202611252123" alt="">Quid</h1>
    <form id="login">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="email" required>
      <div class="sheet-foot"><button class="primary" type="submit">Inviami il codice</button></div>
    </form>
    <form id="code" hidden>
      <p class="muted">Se l'indirizzo è autorizzato riceverai un codice via email.</p>
      <label for="otp">Codice ricevuto via email</label>
      <input id="otp" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required>
      <div class="sheet-foot"><button class="primary" type="submit">Accedi</button></div>
    </form>
    <div class="err" ${msg ? '' : 'hidden'}>${esc(msg)}</div>`
  const err = $app.querySelector('.err')
  const fail = (m) => { err.textContent = m; err.hidden = false }
  let email = ''
  $app.querySelector('#login').addEventListener('submit', async (e) => {
    e.preventDefault()
    email = new FormData(e.target).get('email').trim().toLowerCase()
    e.submitter.disabled = true
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
    e.submitter.disabled = false
    // non diciamo se l'email esiste: mostriamo comunque il campo codice
    if (error && /rate|limit|seconds/i.test(error.message)) return fail('Troppi tentativi: riprova tra qualche minuto.')
    e.target.hidden = true
    $app.querySelector('#code').hidden = false
    $app.querySelector('#otp').focus()
  })
  $app.querySelector('#code').addEventListener('submit', async (e) => {
    e.preventDefault()
    e.submitter.disabled = true
    const token = new FormData(e.target).get('otp').trim()
    const { error } = await sb.auth.verifyOtp({ email, token, type: 'email' })
    e.submitter.disabled = false
    if (error) return fail('Codice non valido o scaduto.')
    authGate()
  })
}

async function renderMfaEnroll () {
  // elimina eventuali configurazioni lasciate a metà
  const { data: list } = await sb.auth.mfa.listFactors()
  for (const f of (list?.all || []).filter(f => f.status !== 'verified')) await sb.auth.mfa.unenroll({ factorId: f.id })
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Quid ' + new Date().toISOString().slice(0, 10) })
  if (error) return renderLogin(error.message)
  $app.innerHTML = `
    <h1 class="brand"><img class="logo" src="icons/logo.svg?v=202611252123" alt="">Quid</h1>
    <h2>Attiva la verifica in due passaggi</h2>
    <p class="muted">Obbligatoria. Inquadra il codice con un'app di autenticazione (Password di iPhone, Google Authenticator, 1Password…) oppure copia la chiave.</p>
    <img class="qr" alt="Codice QR per l'app di autenticazione">
    <div class="mono">${esc(data.totp.secret)}</div>
    <form id="mfa">
      <label for="totp">Codice a 6 cifre generato dall'app</label>
      <input id="totp" name="totp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required>
      <div class="sheet-foot"><button class="primary" type="submit">Attiva</button></div>
    </form>
    <div class="err" hidden></div>
    <div class="sheet-foot"><button type="button" data-act="logout">Esci</button></div>`
  $app.querySelector('.qr').src = data.totp.qr_code
  $app.querySelector('#mfa').addEventListener('submit', async (e) => {
    e.preventDefault()
    const code = new FormData(e.target).get('totp').trim()
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code })
    if (error) { const err = $app.querySelector('.err'); err.textContent = 'Codice non valido, riprova.'; err.hidden = false; return }
    authGate()
  })
}

async function renderMfaVerify () {
  const { data } = await sb.auth.mfa.listFactors()
  const factor = data?.totp?.find(f => f.status === 'verified')
  if (!factor) return renderMfaEnroll()
  $app.innerHTML = `
    <h1 class="brand"><img class="logo" src="icons/logo.svg?v=202611252123" alt="">Quid</h1>
    <form id="mfa">
      <label for="totp">Codice dell'app di autenticazione</label>
      <input id="totp" name="totp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required autofocus>
      <div class="sheet-foot"><button class="primary" type="submit">Verifica</button></div>
    </form>
    <div class="err" hidden></div>
    <div class="sheet-foot"><button type="button" data-act="logout">Esci</button></div>`
  $app.querySelector('#mfa').addEventListener('submit', async (e) => {
    e.preventDefault()
    const code = new FormData(e.target).get('totp').trim()
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
    if (error) { const err = $app.querySelector('.err'); err.textContent = 'Codice non valido, riprova.'; err.hidden = false; return }
    authGate()
  })
}

// ---------------------------------------------------------------- app

async function main () {
  await guard(() => api.start())
  await refresh()
}

async function refresh () {
  await guard(async () => {
    const [cats, inbox] = await Promise.all([api.categories(), api.inbox()])
    state.cats = cats
    state.inbox = inbox
    inbox.forEach(t => state.tx.set(t.id, t))
  })
  await render()
}

const TABS = [['mese', 'Mese'], ['inbox', 'Conferme'], ['ricorrenti', 'Ricorrenti'], ['impostazioni', 'Impostazioni']]

async function render () {
  const n = state.inbox.length
  $app.innerHTML = `
    ${api.demo ? '<div class="demo">Modalità demo: dati finti, nulla viene salvato.</div>' : ''}
    <h1 class="brand"><img class="logo" src="icons/logo.svg?v=202611252123" alt="">Quid</h1>
    <nav>${TABS.map(([k, l]) => `<button data-nav="${k}" ${state.view === k ? 'aria-current="page"' : ''}>${l}${k === 'inbox' && n ? ` ${n}` : ''}</button>`).join('')}</nav>
    <div id="view"></div>
    <button class="add" data-act="add">Aggiungi spesa</button>`
  const v = $app.querySelector('#view')
  await guard(() => VIEWS[state.view](v))
}

const VIEWS = {
  async mese (v) {
    const y = state.month.getFullYear(); const m = state.month.getMonth()
    const tx = await api.month(iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0)))
    tx.forEach(t => state.tx.set(t.id, t))
    const total = tx.reduce((s, t) => s + Number(t.amount), 0)
    const spent = new Map()
    tx.forEach(t => spent.set(t.category_id, (spent.get(t.category_id) || 0) + Number(t.amount)))
    const budgetTotal = activeCats().reduce((s, c) => s + (Number(c.budget) || 0), 0)
    const rows = state.cats
      .filter(c => spent.get(c.id) || (!c.archived && Number(c.budget)))
      .map(c => ({ id: c.id, name: c.name, spent: spent.get(c.id) || 0, budget: Number(c.budget) || 0 }))
    if (spent.get(null)) rows.push({ id: null, name: 'Da categorizzare', spent: spent.get(null), budget: 0 })
    rows.sort((a, b) => b.spent - a.spent)

    const days = new Map()
    tx.forEach(t => { if (!days.has(t.occurred_on)) days.set(t.occurred_on, []); days.get(t.occurred_on).push(t) })
    const pending = state.inbox.length
    const label = state.month.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

    v.innerHTML = `
      <div class="month-nav">
        <button data-act="prev">Prec.</button><h2>${esc(label)}</h2><button data-act="next">Succ.</button>
      </div>
      <div class="summary">
        <div><span>Speso</span><strong>${money(total)}</strong></div>
        <div><span>Budget</span><strong>${budgetTotal ? money(budgetTotal) : '—'}</strong></div>
        <div><span>Rimasto</span><strong>${budgetTotal ? money(budgetTotal - total) : '—'}</strong></div>
      </div>
      ${pending ? `<button class="notice" data-nav="inbox">${pending} ${pending === 1 ? 'spesa' : 'spese'} da confermare</button>` : ''}
      <h3>Categorie</h3>
      ${rows.length ? rows.map(r => `
        <button class="cat ${r.budget && r.spent > r.budget ? 'over' : ''}" ${r.id ? `data-act="edit-cat" data-id="${r.id}"` : 'data-nav="inbox"'}>
          <div class="row"><span class="with-ico"><i class="ico" aria-hidden="true"></i>${esc(r.name)}</span><span>${money(r.spent)}${r.budget ? ` / ${money(r.budget)}` : ''}</span></div>
          ${r.budget ? `<div class="bar"><i data-pct="${Math.min(100, Math.round(r.spent / r.budget * 100))}"></i></div>` : ''}
        </button>`).join('') : '<p class="empty">Nessuna spesa questo mese.</p>'}
      <h3>Movimenti</h3>
      ${[...days].map(([d, list]) => `
        <div class="day">${esc(fmtDay(d))}</div>
        ${list.map(txRow).join('')}`).join('') || '<p class="empty">Ancora niente.</p>'}`
    v.querySelectorAll('.bar i').forEach(i => { i.style.width = i.dataset.pct + '%' })
  },

  async inbox (v) {
    state.inbox = await api.inbox()
    state.inbox.forEach(t => state.tx.set(t.id, t))
    const pend = state.inbox.filter(t => t.status === 'pending')
    const review = state.inbox.filter(t => t.status !== 'pending')
    v.innerHTML = `
      <h3>Spese ricorrenti in scadenza</h3>
      ${pend.map(t => `
        <article class="card">
          <div class="row"><strong>${esc(t.merchant || 'Spesa')}</strong><span class="amt">${money(t.amount)}</span></div>
          <div class="muted">Scadenza ${esc(fmtShort(t.occurred_on))} · ${esc(catName(t.category_id))}</div>
          <div class="actions">
            <button class="primary" data-act="confirm" data-id="${t.id}">Conferma</button>
            <button data-act="edit-pending" data-id="${t.id}">Modifica</button>
            <button data-act="skip" data-id="${t.id}">Salta</button>
            <button data-act="stop-rec" data-id="${t.recurring_id || ''}" ${t.recurring_id ? '' : 'disabled'}>Elimina ricorrenza</button>
          </div>
        </article>`).join('') || '<p class="empty">Nessuna ricorrente da confermare.</p>'}
      <h3>Da controllare</h3>
      <p class="muted">Pagamenti Apple Pay con la categoria scelta in automatico. Confermando, Quid la ricorda per la prossima volta.</p>
      ${review.map(t => `
        <article class="card" data-id="${t.id}">
          <div class="row"><strong>${esc(t.merchant || 'Spesa')}</strong><span class="amt">${money(t.amount)}</span></div>
          <div class="muted">${esc(SOURCE[t.source] || '')} · ${esc(fmtShort(t.occurred_on))}${t.card ? ' · ' + esc(t.card) : ''}</div>
          <label for="c-${t.id}">Categoria</label>
          <select id="c-${t.id}" name="category">
            <option value="">Da categorizzare</option>
            ${activeCats().map(c => `<option value="${c.id}" ${c.id === t.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
          ${t.merchant ? `<label class="check"><input type="checkbox" name="remember" checked>Usa sempre questa categoria per “${esc(t.merchant)}”</label>` : ''}
          <div class="actions">
            <button class="primary" data-act="confirm-review" data-id="${t.id}">Conferma</button>
            <button data-act="edit" data-id="${t.id}">Modifica</button>
          </div>
        </article>`).join('') || '<p class="empty">Tutto in ordine.</p>'}`
  },

  async ricorrenti (v) {
    state.rec = await api.recurring()
    v.innerHTML = `
      <p class="muted">Alla scadenza la spesa compare in “Conferme”: la confermi, la modifichi, la salti o elimini la ricorrenza. Quelle automatiche vengono registrate da sole.</p>
      ${state.rec.map(r => `
        <button class="tx" data-act="edit-rec" data-id="${r.id}">
          <span>${esc(r.name)}<small>${FREQ[r.frequency]} · prossima ${esc(fmtShort(recDate(r.start_date, r.frequency, r.next_index)))} · ${r.mode === 'auto' ? 'automatica' : 'chiede conferma'}${r.active ? '' : ' · in pausa'}</small></span>
          <span class="amt">${money(r.amount)}</span>
        </button>`).join('') || '<p class="empty">Nessuna spesa ricorrente.</p>'}
      <div class="actions"><button data-act="new-rec">Nuova spesa ricorrente</button></div>`
  },

  async impostazioni (v) {
    const tokens = await api.tokens()
    v.innerHTML = `
      <h3>Categorie e budget mensili</h3>
      ${state.cats.map(c => `
        <button class="tx" data-act="edit-cat" data-id="${c.id}">
          <span>${esc(c.name)}${c.archived ? '<small>archiviata</small>' : ''}</span>
          <span class="amt">${c.budget ? money(c.budget) : 'nessun budget'}</span>
        </button>`).join('')}
      <div class="actions"><button data-act="new-cat">Nuova categoria</button></div>

      <h3>Apple Pay</h3>
      <p class="muted">Ogni iPhone collegato ha un token personale. Se perdi il telefono, revocalo.</p>
      ${tokens.map(t => `
        <div class="list-row">
          <span>${esc(t.label)}<small class="muted"><br>${t.last_used_at ? 'ultimo uso ' + esc(new Date(t.last_used_at).toLocaleString('it-IT')) : 'mai usato'}</small></span>
          <button data-act="revoke" data-id="${t.id}">Revoca</button>
        </div>`).join('') || '<p class="empty">Nessun iPhone collegato.</p>'}
      <div class="actions"><button data-act="new-token">Collega un iPhone</button></div>

      <h3>Dati</h3>
      <div class="actions"><button data-act="export">Esporta tutto in CSV</button></div>

      <h3>Account</h3>
      <p class="muted">${esc(state.email)}</p>
      ${api.demo ? '' : '<div class="actions"><button data-act="logout">Esci</button></div>'}`
  }
}

function txRow (t) {
  const title = t.merchant || catName(t.category_id)
  const sub = [t.merchant ? catName(t.category_id) : '', SOURCE[t.source], t.needs_review ? 'da controllare' : ''].filter(Boolean).join(' · ')
  return `<button class="tx" data-act="edit" data-id="${t.id}">
    <i class="ico" aria-hidden="true"></i><span class="grow">${esc(title)}<small>${esc(sub)}</small></span><span class="amt">${money(t.amount)}</span></button>`
}

// ---------------------------------------------------------------- schede (dialog)

function openSheet (html, onSubmit) {
  $sheet.innerHTML = html
  const form = $sheet.querySelector('form')
  const err = $sheet.querySelector('.err')
  $sheet.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $sheet.close()))
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = form.querySelector('[type="submit"]')
    btn.disabled = true
    try {
      await onSubmit(new FormData(form), form)
    } catch (x) {
      if (err) { err.textContent = x.message; err.hidden = false } else toast(x.message)
    } finally { btn.disabled = false }
  })
  $sheet.showModal()
  return $sheet
}

const head = (title) => `<div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="link" data-close>Chiudi</button></div>`
const catChips = (selected) => `<div class="chips">${activeCats().map(c => `
  <label><input type="radio" name="category" value="${c.id}" ${c.id === selected ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div>`

function readAmount (fd) {
  const amount = parseAmount(fd.get('amount'))
  if (!(amount > 0 && amount < 1000000)) throw new Error('Importo non valido')
  return amount
}

// mode: 'new' | 'edit' | 'confirm'
function openTx (t, mode) {
  const title = { new: 'Nuova spesa', edit: 'Modifica spesa', confirm: 'Conferma spesa' }[mode]
  const s = openSheet(`<form>
    ${head(title)}
    <label for="amount">Importo (€)</label>
    <input id="amount" name="amount" class="big" inputmode="decimal" autocomplete="off" required value="${esc(amountInput(t?.amount))}" ${mode === 'new' ? 'autofocus' : ''}>
    <label>Categoria</label>${catChips(t?.category_id)}
    <label for="merchant">Descrizione</label>
    <input id="merchant" name="merchant" maxlength="120" autocomplete="off" value="${esc(t?.merchant)}">
    <label for="date">Data</label>
    <div class="date-wrap"><input id="date" name="date" type="date" required value="${esc(t?.occurred_on || todayIso())}"></div>
    <label for="note">Nota</label>
    <textarea id="note" name="note" maxlength="500">${esc(t?.note)}</textarea>
    ${mode === 'edit' && t.merchant ? `<label class="check"><input type="checkbox" name="remember" ${t.needs_review ? 'checked' : ''}>Se cambi categoria, usala sempre per “${esc(t.merchant)}”</label>` : ''}
    <div class="err" hidden></div>
    <div class="sheet-foot">
      ${mode === 'edit' ? '<button type="button" data-del>Elimina</button>' : ''}
      <button class="primary" type="submit">${mode === 'confirm' ? 'Conferma' : 'Salva'}</button>
    </div>
  </form>`, async (fd) => {
    const row = {
      amount: readAmount(fd),
      category_id: fd.get('category') || null,
      merchant: fd.get('merchant').trim(),
      occurred_on: fd.get('date'),
      note: fd.get('note').trim()
    }
    if (mode === 'new') await api.saveTx(row)
    else if (mode === 'confirm') await api.confirmTx(t.id, row)
    else {
      await api.saveTx({ id: t.id, ...row })
      if (row.category_id !== t.category_id || t.needs_review) {
        await api.setCategory(t.id, row.category_id, fd.get('remember') === 'on')
      }
    }
    s.close()
    toast(mode === 'new' ? 'Spesa aggiunta' : 'Salvato')
    refresh()
  })
  s.querySelector('[data-del]')?.addEventListener('click', () => guard(async () => {
    if (!confirm('Eliminare questa spesa?')) return
    await api.deleteTx(t.id)
    s.close()
    toast('Spesa eliminata')
    refresh()
  }))
}

function openRec (r) {
  const next = r ? recDate(r.start_date, r.frequency, r.next_index) : todayIso()
  const s = openSheet(`<form>
    ${head(r ? 'Spesa ricorrente' : 'Nuova spesa ricorrente')}
    <label for="name">Nome</label>
    <input id="name" name="name" maxlength="80" required value="${esc(r?.name)}" placeholder="Affitto, Netflix, palestra…">
    <label for="amount">Importo previsto (€)</label>
    <input id="amount" name="amount" inputmode="decimal" autocomplete="off" required value="${esc(amountInput(r?.amount))}">
    <label>Categoria</label>${catChips(r?.category_id)}
    <label for="frequency">Frequenza</label>
    <select id="frequency" name="frequency">
      ${Object.entries(FREQ).map(([k, l]) => `<option value="${k}" ${(r?.frequency || 'monthly') === k ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
    <label for="date">Prossima scadenza</label>
    <div class="date-wrap"><input id="date" name="date" type="date" required value="${esc(next)}"></div>
    <label>Alla scadenza</label>
    <label class="check"><input type="radio" name="mode" value="confirm" ${r?.mode !== 'auto' ? 'checked' : ''}>Chiedimi di confermare</label>
    <label class="check"><input type="radio" name="mode" value="auto" ${r?.mode === 'auto' ? 'checked' : ''}>Registrala da sola</label>
    ${r ? `<label class="check"><input type="checkbox" name="active" ${r.active ? 'checked' : ''}>Attiva</label>` : ''}
    <div class="err" hidden></div>
    <div class="sheet-foot">
      ${r ? '<button type="button" data-del>Elimina</button>' : ''}
      <button class="primary" type="submit">Salva</button>
    </div>
  </form>`, async (fd) => {
    const row = {
      name: fd.get('name').trim(),
      amount: readAmount(fd),
      category_id: fd.get('category') || null,
      frequency: fd.get('frequency'),
      mode: fd.get('mode')
    }
    const date = fd.get('date')
    if (!r || date !== next || row.frequency !== r.frequency) Object.assign(row, { start_date: date, next_index: 0 })
    if (r) row.active = fd.get('active') === 'on'
    await api.saveRecurring(r ? { id: r.id, ...row } : row)
    await api.start()
    s.close()
    toast('Salvato')
    refresh()
  })
  s.querySelector('[data-del]')?.addEventListener('click', () => guard(async () => {
    if (!confirm(`Eliminare la ricorrenza “${r.name}”? Le spese già confermate restano.`)) return
    await api.deleteRecurring(r.id)
    s.close()
    toast('Ricorrenza eliminata')
    refresh()
  }))
}

function openCat (c) {
  const s = openSheet(`<form>
    ${head(c ? 'Categoria' : 'Nuova categoria')}
    <label for="name">Nome</label>
    <input id="name" name="name" maxlength="40" required value="${esc(c?.name)}">
    <label for="budget">Budget mensile (€, vuoto = nessuno)</label>
    <input id="budget" name="budget" inputmode="decimal" autocomplete="off" value="${esc(amountInput(c?.budget))}">
    ${c ? `<label class="check"><input type="checkbox" name="archived" ${c.archived ? 'checked' : ''}>Archiviata (non compare più nelle scelte)</label>` : ''}
    <div class="err" hidden></div>
    <div class="sheet-foot"><button class="primary" type="submit">Salva</button></div>
  </form>`, async (fd) => {
    const raw = fd.get('budget').trim()
    const budget = raw ? parseAmount(raw) : null
    if (raw && !(budget >= 0)) throw new Error('Budget non valido')
    const row = { name: fd.get('name').trim(), budget }
    if (c) row.archived = fd.get('archived') === 'on'
    else row.position = state.cats.length + 1
    await api.saveCategory(c ? { id: c.id, ...row } : row)
    s.close()
    refresh()
  })
}

function openNewToken () {
  const s = openSheet(`<form>
    ${head('Collega un iPhone')}
    <label for="label">Nome del dispositivo</label>
    <input id="label" name="label" maxlength="40" value="iPhone" required>
    <div class="err" hidden></div>
    <div class="sheet-foot"><button class="primary" type="submit">Genera token</button></div>
  </form>`, async (fd) => {
    const token = await api.createToken(fd.get('label').trim())
    const base = (SUPABASE_URL || 'https://TUO-PROGETTO.supabase.co') + '/rest/v1/rpc/'
    const field = (label, value) => `<label>${label}</label><div class="mono">${esc(value)}</div>
      <div class="actions"><button type="button" data-copy="${esc(value)}">Copia</button></div>`
    $sheet.innerHTML = `${head('Token creato')}
      <p><strong>Copialo adesso: non verrà più mostrato.</strong> Nel database resta solo una sua impronta cifrata.</p>
      ${field('Token', token)}
      ${field('Indirizzo per i pagamenti', base + 'ingest_applepay')}
      ${field('Indirizzo per il controllo giornaliero', base + 'daily_check')}
      ${field('Chiave pubblica (intestazione apikey)', SUPABASE_KEY || 'chiave-pubblica')}
      <p><a href="${GUIDE_URL}" target="_blank" rel="noopener noreferrer">Guida: come creare il Comando Rapido</a></p>
      <div class="sheet-foot"><button class="primary" type="button" data-close>Fatto</button></div>`
    $sheet.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { s.close(); refresh() }))
    $sheet.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
      await navigator.clipboard.writeText(b.dataset.copy)
      toast('Copiato')
    }))
  })
}

async function exportCsv () {
  const all = await api.all()
  const cell = (v) => {
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s   // evita formule eseguite da Excel/Numbers
    return '"' + s.replace(/"/g, '""') + '"'
  }
  const rows = [['data', 'importo', 'descrizione', 'categoria', 'fonte', 'stato', 'carta', 'nota']]
    .concat(all.map(t => [t.occurred_on, String(t.amount).replace('.', ','), t.merchant, catName(t.category_id),
      SOURCE[t.source], t.status === 'pending' ? 'da confermare' : 'confermata', t.card, t.note]))
  const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `quid-${todayIso()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ---------------------------------------------------------------- azioni

const ACTIONS = {
  add: () => openTx(null, 'new'),
  edit: (id) => openTx(state.tx.get(id), 'edit'),
  'edit-pending': (id) => openTx(state.tx.get(id), 'confirm'),
  prev: () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); render() },
  next: () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); render() },
  confirm: async (id) => { await api.confirmTx(id); toast('Confermata'); refresh() },
  skip: async (id) => {
    if (!confirm('Saltare questa scadenza? La ricorrenza continua dalla prossima.')) return
    await api.deleteTx(id); toast('Scadenza saltata'); refresh()
  },
  'stop-rec': async (id) => {
    if (!confirm('Eliminare la ricorrenza? Non arriveranno più richieste.')) return
    await api.deleteRecurring(id); toast('Ricorrenza eliminata'); refresh()
  },
  'confirm-review': async (id, btn) => {
    const card = btn.closest('.card')
    const cat = card.querySelector('select').value || null
    const remember = card.querySelector('[name="remember"]')?.checked ?? false
    await api.setCategory(id, cat, remember)
    toast('Confermata')
    refresh()
  },
  'edit-rec': (id) => openRec(state.rec.find(r => r.id === id)),
  'new-rec': () => openRec(null),
  'edit-cat': (id) => openCat(state.cats.find(c => c.id === id)),
  'new-cat': () => openCat(null),
  'new-token': () => openNewToken(),
  revoke: async (id) => {
    if (!confirm('Revocare questo token? Il Comando Rapido di quel dispositivo smetterà di funzionare.')) return
    await api.revokeToken(id); toast('Token revocato'); render()
  },
  export: () => exportCsv(),
  logout: async () => { await sb?.auth.signOut(); location.reload() }
}

$app.addEventListener('click', (e) => {
  const nav = e.target.closest('[data-nav]')
  if (nav) { state.view = nav.dataset.nav; render(); window.scrollTo(0, 0); return }
  const btn = e.target.closest('[data-act]')
  if (!btn || !ACTIONS[btn.dataset.act]) return
  guard(() => ACTIONS[btn.dataset.act](btn.dataset.id, btn))
})

// quando torni sull'app (es. dopo un pagamento) aggiorna i dati
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && api && state.cats.length && !$sheet.open) refresh()
})

boot()
