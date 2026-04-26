---
title: "Windows 7 e le date italiane"
date: 2009-10-11
tags: [wordpress-archive]
lang: it
---

# Windows 7 e le date italiane

Ormai Windows 7 è stato rilasciato, e tutti i partner Microsoft hanno già avuto modo di provarlo sui loro PC. Per non essere da meno, la settimana scorsa appena è arrivato il CD in azienda, ho deciso di installarlo subito per vedere come si comportava.

Devo dire che hanno fatto dei bei passi avanti e parecchi passi indietro, ripristinando delle logiche di Windows XP molto care all’utente esperto. Ma questa è un altra storia.

La sorpresa la ho avuta qualche giorno dopo, quando un collega mi ha segnalato che il nostro CRM aveva dei problemi con le date. Anche lui aveva installato Windows 7 sul suo PC e sullo stesso faceva girare Mago.Net e Tustena CRM per fare le demo presso i clienti.

Ho avvisato il nostro supporto tecnico, che in prima battuta ha verificato sui server di test e non risultava esserci alcun problema. Quindi ho fatto 2 + 2 e sono andato a provare su una macchina con Windows 7. Ed infatti una volta modificata una data, ecco che l’applicazione mi da un errore di cast relativo al formato dell’ora.

Alquanto incuriosito dall’anomalia, ho iniziato a fare alcuni esperimenti, finché non sono giunto ad una soluzione, ovvero istruire il programma a non considerare il profilo utente di Windows per quanto concerne le localizzazioni impostate dall’utente.

Per farla breve, i quei geniacci della Microsoft, hanno impostato come profilo predefinito per la lingua italiana una ora breve nel formato H.mm e un’ora estesa nel formato HH:mm:ss.

Con il risultato che scrivendo la data correttamente nel formato italiano, il sistema non era in grado di comprenderla generando un errore.

Ora il nostro CRM è indenne da questo problema, oltre al fatto che di solito l’applicazione si installa sul server e non sul client, ma mi chiedo quali altre anomalie si potranno riscontrare in altri programmi se non risolvono rapidamente questo problema con un aggiornamento.
