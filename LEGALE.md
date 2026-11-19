# Note legali preliminari — BOZZA DI LAVORO

> Giurisdizione: **Italia** · Legge applicabile: **italiana** · Lingua: **italiano**.
> Bozza da rivedere da un avvocato e da un commercialista. Non è un parere. I riferimenti normativi sono citati a memoria e vanno verificati sul testo vigente (Normattiva) e sulla prassi del MIMIT e di ADM. Il simbolo ⚠️ segna i punti che richiedono verifica.

## 1. Qualificazione: concorso a premio

| Elemento | Fatto | Conseguenza |
|---|---|---|
| Premio legato all'acquisto | Giri attivati solo con l'acquisto di un drink | Manifestazione a premio con finalità promozionale |
| Assegnazione affidata alla sorte | Esito estratto da un software (RNG) | **Concorso a premio** (DPR 26 ottobre 2001, n. 430, art. 2), non operazione a premio (art. 3), perché il premio non spetta a tutti gli acquirenti |
| Premi | Sconti, consumazioni, tessere; niente denaro | Compatibili con i limiti sui premi (art. 4) ⚠️ |

⚠️ **Esclusioni (art. 6 DPR 430/2001).** Va verificato se l'esclusione per premi costituiti da **sconti di prezzo o quantità aggiuntive di prodotti dello stesso genere** possa coprire sconti e drink omaggio. A mio ricordo la prassi ministeriale la riferisce a vantaggi certi e non a meccanismi aleatori come questo. **Punto da verificare per primo**: se l'esclusione si applicasse, cadrebbero gli adempimenti del § 2.

## 2. Adempimenti se è un concorso (da verificare uno per uno ⚠️)

- [ ] **Comunicazione al MIMIT** almeno 15 giorni prima dell'avvio, con procedura telematica (art. 10, modello PREMA CO/1).
- [ ] **Regolamento** con promotore, durata, area, meccanica, montepremi, premi, probabilità e limiti, modalità di consegna, ONLUS beneficiaria. Va conservato dal promotore per tutta la durata (art. 11). La schermata *Regole* dell'app ne è un estratto, non il regolamento.
- [ ] **Cauzione** a favore del Ministero pari al valore del montepremi stimato (art. 7), con deposito o fideiussione. ⚠️ Verificare la percentuale (a mio ricordo 100%) e la base di calcolo (IVA esclusa?).
  - Con il profilo Bilanciato il montepremi atteso vale circa il **4,9% dell'incasso drink coinvolto**: si stima in *Gestione → Probabilità*, che indica anche il massimo teorico consentito dai tetti.
  - **Abbassare i tetti annui riduce il montepremi dichiarabile e quindi la cauzione.**
- [ ] **Durata**: ⚠️ verificare il limite massimo per i concorsi (a mio ricordo un anno) e prevedere edizioni successive.
- [ ] **Software di estrazione** (instant win): perizia tecnica che attesti casualità, rispetto delle probabilità dichiarate e non manomissibilità; dati conservati in Italia; verbale di chiusura davanti a **notaio o funzionario camerale** (art. 9).
  - Il codice è predisposto per questo: RNG crittografico, probabilità pubblicate, esito registrato prima dell'animazione, test automatici, registro dei buoni esportabile in CSV.
- [ ] **Premi non assegnati o non ritirati**: devoluzione alla ONLUS indicata nel regolamento (art. 10). ⚠️ Verificare come trattare i buoni scaduti.

## 3. Gioco e apparecchi nei pubblici esercizi ⚠️ rischio principale

- **Art. 110 TULPS (R.D. 773/1931).** Un tablet con grafica da slot, collocato in un bar, che assegna premi in base alla sorte potrebbe essere considerato un apparecchio da gioco non conforme ai commi 6 e 7, con sanzioni (comma 9) e possibili controlli ADM.
- **Argomenti difensivi**:
  - nessuna posta né gettone: si gioca solo con giri gratuiti legati all'acquisto;
  - nessuna vincita in denaro;
  - il dispositivo è lo strumento di estrazione di un concorso regolarmente comunicato al MIMIT.
- **Raccomandazione**: prima del lancio, interpello o confronto informale con ADM. Valutare anche una veste meno "slot" nelle comunicazioni esterne.
- **Artt. 718 ss. c.p. (gioco d'azzardo)**: rischio basso, perché mancano posta e fine di lucro del giocatore. ⚠️ Comunque da confermare.
- **Divieto di pubblicità del gioco con vincite in denaro** (D.L. 87/2018, art. 9): non dovrebbe applicarsi, perché non ci sono vincite in denaro. ⚠️

## 4. Alcol e minori

- **Maggiorenni**: somministrazione di alcolici vietata ai minori di 18 anni (art. 689 c.p.; L. 125/2001, art. 14-ter). L'app richiede al barista di attivare i giri solo per maggiorenni e lo ricorda nel ticker.
- **Analcolici**: prevedere nel regolamento che i premi "drink" siano fruibili anche come analcolici.
- **Consumo moderato**: il limite giornaliero sulle tessere (2 consumazioni al giorno) aiuta a non incentivare consumi eccessivi.
- ⚠️ Verificare eventuali **ordinanze comunali** o regionali su promozioni di alcolici (open bar, happy hour) e la disciplina della pubblicità di bevande alcoliche (L. 125/2001, art. 13).

## 5. Fiscale (per il commercialista) ⚠️

- **Ritenuta alla fonte del 25%** sul valore dei premi dei concorsi a carico del promotore (art. 30 DPR 600/1973): incide sul costo reale.
- **IVA** sulle cessioni gratuite di beni oggetto dell'attività (art. 2, c. 2, n. 4 DPR 633/1972) e trattamento degli sconti.
- Registrazione contabile degli omaggi e dei buoni emessi (l'export CSV del registro aiuta).

## 6. Privacy e consumatori

- L'app **non raccoglie dati personali**: i buoni sono anonimi e "al portatore". Se per i premi maggiori si registra il nominativo del vincitore (utile per il verbale), serve un'informativa ai sensi dell'art. 13 GDPR.
- **Trasparenza** (Codice del Consumo, artt. 20 ss.): probabilità medie, limiti di disponibilità, regola del premio inferiore e divieto di conversione in denaro sono esposti nella schermata *Regole*. Tenerli allineati al regolamento.

## 7. Scelte di prodotto fatte per ridurre i rischi

| Scelta | Perché |
|---|---|
| Nessun denaro, nessuna puntata, nessun credito acquistabile | Distanza dal gioco con vincite in denaro |
| Premi solo in natura e sconti, non convertibili | Art. 4 DPR 430/2001 ⚠️ |
| Probabilità pubblicate in app | Trasparenza, coerenza col regolamento |
| Tetti giornalieri, mensili e annui | Montepremi massimo determinabile, base per la cauzione |
| Registro buoni con codici a controllo d'errore e backup | Tracciabilità per verbale e verifiche |
| Modalità demo separata | Prove senza emettere premi validi |
| Grafica e nomi originali | Nessun riferimento a giochi o marchi di terzi (es. Book of Ra®, Novomatic) |
