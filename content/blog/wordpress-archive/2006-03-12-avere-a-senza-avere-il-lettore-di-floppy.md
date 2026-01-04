---
title: "Avere A: senza avere il lettore di floppy disk"
date: 2006-03-12
tags: [wordpress-archive]
lang: it
---

# Avere A: senza avere il lettore di floppy disk

Un'amica di mia moglie ha un software che per funzionare cerca di accedere ai dati presenti in un dischetto fornito assieme al programma.

Il problema è che lei non ha il lettore di floppy sul suo computer portatile, e il programma vuole per forza accedere all'unità A: per leggere i dati. [more]

A mio parere la soluzione più semplice è copiare il contenuto del floppy su un computer che ne ha (ancora) uno  e travasarlo quindi in una cartella del PC su cui gira il programma.

A questo punto aprendo il command prompt (Start -> Esegui: cmd) vado a digitare:

net use a: \\\\127.0.0.1\\c$\\floppy /PERSISTENT:YES

presumendo che ho creato la cartella floppy in c: e il programma dovrebbe funzionare.
