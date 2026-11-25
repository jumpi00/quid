# Quid

Gestionale spese personale: registra in automatico i pagamenti Apple Pay (tramite Comandi Rapidi), permette l'aggiunta a mano, categorizza con regole che imparano dalle correzioni, gestisce budget e spese ricorrenti da confermare.

- App: PWA statica (HTML/CSS/JS, nessuna build) su GitHub Pages
- Dati: Supabase (Postgres, regione UE) con RLS e verifica in due passaggi obbligatoria
- Demo con dati finti: aggiungi `?demo` all'indirizzo

## Sicurezza

- Ogni tabella ha Row Level Security: ogni riga appartiene a un utente, e l'app legge e scrive solo con una sessione verificata in due passaggi (`aal2`).
- Il ruolo anonimo può chiamare solo `ingest_applepay`, `daily_check` (entrambe richiedono un token personale) e `keepalive`.
- I token dei Comandi Rapidi sono 256 bit casuali. Nel database c'è solo l'hash SHA-256, e si possono revocare dall'app.
- Iscrizioni chiuse: gli account si creano solo dalla dashboard di Supabase.
- Content Security Policy restrittiva: nessuno script esterno, la libreria Supabase è nel repo (`vendor/`).
- Dal telefono arrivano solo importo, esercente e nome della carta: mai numeri di carta o dati bancari.

## Setup Supabase (una volta)

1. Nuovo progetto, regione UE.
2. SQL Editor → esegui `sql/001_schema.sql`, poi `sql/002_dictionary.sql`.
3. Authentication → Sign In / Providers → **Allow new users to sign up: OFF**.
4. Authentication → Users → **Add user** → la tua email, "Auto Confirm User".
5. Authentication → Emails → template **Magic Link**: aggiungi `{{ .Token }}` nel testo, così arriva il codice.
6. Authentication → URL Configuration → Site URL `https://jumpi00.github.io/quid/`.
7. Project Settings → API: copia Project URL e **publishable key** in `config.js`.

## Comando Rapido

Vedi [docs/comando-rapido.md](docs/comando-rapido.md).

## Sviluppo

```bash
python3 -m http.server 5230
```

Prima di ogni rilascio: `tools/bump.sh` (aggiorna `?v=` per evitare file vecchi in cache).
