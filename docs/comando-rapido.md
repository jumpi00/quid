# Quid · Comandi Rapidi su iPhone

Servono due automazioni, che crei una volta sola:

1. **Pagamento Apple Pay** → registra la spesa in Quid e ti mostra la categoria.
2. **Controllo giornaliero** → crea le spese ricorrenti in scadenza e ti avvisa se c'è qualcosa da confermare.

Prima di tutto, in Quid → **Impostazioni → Collega un iPhone**, genera un token. Ti servono quattro valori, che l'app ti mostra con il pulsante "Copia":

| Valore | Esempio |
|---|---|
| Token | `quid_3f9a…` (64 caratteri dopo `quid_`) |
| Indirizzo per i pagamenti | `https://TUO-PROGETTO.supabase.co/rest/v1/rpc/ingest_applepay` |
| Indirizzo per il controllo giornaliero | `https://TUO-PROGETTO.supabase.co/rest/v1/rpc/daily_check` |
| Chiave pubblica | `sb_publishable_…` |

> Il token è come una password: non condividere il Comando Rapido dopo averlo inserito. Se perdi il telefono, revocalo da Impostazioni.

---

## 1. Automazione "Pagamento Apple Pay"

1. Apri **Comandi Rapidi** → scheda **Automazione** → **+** (o "Nuova automazione").
2. Scegli **Transazione**.
3. In **Carta** seleziona le carte del Wallet che vuoi registrare. Lascia tutte le categorie e gli esercenti.
4. Seleziona **Esegui immediatamente** e disattiva **Notifica quando viene eseguito**. → **Avanti**.
5. Scegli **Nuovo comando rapido vuoto** e aggiungi queste azioni:

**Azione A: "Ottieni contenuti dell'URL"**
- URL: l'indirizzo per i pagamenti (`…/rpc/ingest_applepay`)
- Tocca la freccia per espandere:
  - **Metodo**: `POST`
  - **Intestazioni** (aggiungi due righe):
    - `apikey` → la chiave pubblica
    - `Content-Type` → `application/json`
  - **Corpo richiesta**: `JSON`, con quattro campi di tipo **Testo**:
    - `p_token` → il token
    - `p_amount` → variabile **Importo** (tocca il campo, scegli la variabile "Importo" dell'input Transazione)
    - `p_merchant` → variabile **Esercente**
    - `p_card` → variabile **Carta** (o "Nome carta")

**Azione B: "Mostra notifica"**
- Testo: variabile **Contenuti dell'URL**

Risultato: dopo ogni pagamento arriva una notifica tipo `Quid: 12,50 € · Esselunga → Spesa`.

---

## 2. Automazione "Controllo giornaliero"

1. **Automazione** → **+** → **Ora del giorno** → per esempio **9:00**, **Ogni giorno**.
2. **Esegui immediatamente**, notifica di esecuzione disattivata.
3. **Nuovo comando rapido vuoto**:

**Azione A: "Ottieni contenuti dell'URL"**
- URL: l'indirizzo per il controllo giornaliero (`…/rpc/daily_check`)
- Metodo `POST`, stesse due intestazioni di prima
- Corpo richiesta `JSON` con un solo campo: `p_token` → il token

**Azione B: "Se"**
- **Contenuti dell'URL** · **contiene** · `Quid`

**Azione C (dentro "Se"): "Mostra notifica"**
- Testo: **Contenuti dell'URL**

Risultato: se ci sono ricorrenti da confermare ricevi `Quid: 2 da confermare: Affitto 650,00 €, …`, altrimenti nessuna notifica. Apri Quid → **Conferme** per confermare, modificare, saltare o eliminare.

Questa automazione tiene anche "sveglio" il database gratuito, che va in pausa dopo 7 giorni senza attività.

---

## Problemi comuni

| Messaggio | Causa |
|---|---|
| `Token non valido` | Token copiato male oppure revocato: generane uno nuovo |
| `Importo non valido` | Il campo `p_amount` non contiene la variabile Importo |
| `No API key found` | Manca l'intestazione `apikey` |
| `Troppe richieste` | Più di 60 pagamenti in un'ora (protezione anti-abuso) |
| Nessuna notifica | Controlla che l'automazione sia su "Esegui immediatamente" |
