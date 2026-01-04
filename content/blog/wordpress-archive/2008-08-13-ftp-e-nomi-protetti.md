---
title: "FTP e nomi protetti"
date: 2008-08-13
tags: [wordpress-archive]
lang: it
---

# FTP e nomi protetti

Windows e i servizi FTP non sono mai andati particolarmente d' accordo. In particolare Microsoft non ha mai prestato troppa attenzione a sviluppare un server FTP efficiente e sufficientemente sicuro. [more]

Un punto dolente è l'integrazione tra la logica FTP e il filesystem sottostante che, a tutto vantaggio dei "traders", permette di definire nomi di file e cartelle incompatibili con i nomi validi accettati da Windows.

Il risultato è che potremo trovare cartelle o file con nomi tipo: Com1, Lpt1, CON, PRN o nomi composti da uno spazio vuoto che non è più possibile cancellare ne aprire se non dall'FTP stesso.

A questo problema esiste una semplicissima soluzione che Windows eredita dal vecchio DOS.

E' vero che le cartelle create con "nomi riservati" non sono accessibili, ma è anche vero che ogni nome di file su Windows ha anche un vecchio nome in formato 8.3 che non soffre delle stesse limitazioni.

Quindi per cancellare una cartella "protetta" basterà recuperare il suo vecchio nome DOS 8.3 dando il comando:

dir /x

e quindi cancellarla utilizzando il nome 8.3 direttamente con un comando:

rd XXXXXX~1

N.B. La tilde (~) si fa con la combinazione Alt-126
