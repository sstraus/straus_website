---
title: "Impossibile avviare Windows XP il seguente file manca o è danneggiato"
date: 2007-04-13
tags: [wordpress-archive]
lang: it
---

# Impossibile avviare Windows XP il seguente file manca o è danneggiato

Qualche volta può capitare che Windows si blocchi in fase di avvio segnalando su schermo blu [more] uno dei seguenti errori:

Impossibile avviare Windows XP. Il seguente file manca o è danneggiato: \\WINDOWS\\SYSTEM32\\CONFIG\\SYSTEM

Impossibile avviare Windows XP. Il seguente file manca o è danneggiato: \\WINDOWS\\SYSTEM32\\CONFIG\\SOFTWARE

Stop: c0000218 {Errore nel file del Registro di sistema} Il Registro di sistema non ha potuto caricare il file hive: \\SystemRoot\\System32\\Config\\SOFTWARE oppure il suo registro o la sua copia.

o in inglese (se come me preferite il sistema in lingua originale)

Windows XP could not start because the following file is missing or corrupt: \\WINDOWS\\SYSTEM32\\CONFIG\\SYSTEM

Windows XP could not start because the following file is missing or corrupt: \\WINDOWS\\SYSTEM32\\CONFIG\\SOFTWARE

Stop: c0000218 {Registry File Failure} The registry cannot load the hive (file): \\SystemRoot\\System32\\Config\\SOFTWARE or its log or alternate

in sintesi questi errori ci dicono che il registro di sistema è corrotto o che il sistema non può accedere alle voci System o Software dello stesso.

Per risolvere il problema, bisogna accedere al PC con il cd di installazione di Windows e attivare la "console di ripristino".

Una volta caricata la console, vi troverete nella cartella c:\\windows in cui dovrete inserire la seguenza in quest'ordine:

cd system32\\config

dir software (o system a seconda dell'errore riscontrato)

Se il sistema restituisce un risultato al comando dir, dovete rinominare il file, altrimenti saltate il passaggio sucessivo.

Per rinominare il file di registro danneggiato digitate:

ren software software.bak (o system a seconda dell'errore riscontrato)

quindi ripristinate il file danneggiato direttamente dalla cartella repair dove dovrebbe esserci una copia aggiornata all'ultimo avvio andato a buon fine digitando:

copy c:\\windows\
epair\\system (o system a seconda dell'errore riscontrato)

A questo punto il registro è ripristinato, per uscire dalla console di ripristino e riavviare il sistema, digitate EXIT seguito da invio e rimuovete il CD.

Il PC dovrebbe ripartire chiedendovi quale modalità di avvio utilizzare; selezionate "avvia normalmente" e tutto dovrebbe essere come lo avete lasciato.
