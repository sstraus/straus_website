---
title: "MySql LIMIT in SqlServer"
date: 2005-04-12
tags: [wordpress-archive]
lang: it
---

# MySql LIMIT in SqlServer

Quando si sviluppano dei siti che devono rappresentare un gran numero dati, l'unica soluzione per non generare tabelle enormi è l'uso della paginazione.

CI sono molti modi di paginare, ma il più comune e utilizzando delle stored procedure, specialmente in SqlServer. [more]

MySql offre una soluzione molto interessante attraverso il comando LIMIT, dove oltre a passare la il numero di righe che voglio ricevere (cosa che in SqlServer posso fare con il comando TOP) devo specificare l'offset di inizio. Quindi il comando LIMIT 15,5 sestituirà i risultati da 16 a 20.>

Ed ora arriviamo al punto di questo post: come posso fare a replicare questo comando in SqlServer?

Dopo innumerevoli tentativi, il sistema più rapido e che offre il miglior rapporto carico/prestazioni sembra essere la seguente query:

SELECT TOP x * FROM table

WHERE id NOT IN (SELECT TOP y id FROM table ORDER BY id)

ORDER BY id;

dove:

"id" è la chiave primaria della tabella

"x" è il numero di risultati che vlglio ottenere

"y" è la riga di partenza o offset della mia query

Il risultato è identico, peccato che la sintassi è completamente diversa e comporta precchi problemi se si vuole usare lo stesso codice sia in SqlServer che in MySql.

Qualcuno è riuscito a emulare LIMIT in tutto e per tutto con un UDF o un Stored?
