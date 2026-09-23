# WWM Unterrichtsquiz

Browserbasiertes Unterrichtsquiz im Stil von «Wer wird Millionär?». Die App läuft als statische Website und kann Fragensätze lokal oder über Supabase speichern.

## Funktionen

- 15 Gewinnstufen
- zufällige Antwortpositionen bei jedem Spiel
- 50:50, Publikumsjoker, Telefonjoker und Lehrerjoker
- einfacher Textimport, Excel/CSV und JSON
- sehr einfaches Fünf-Zeilen-Format ohne technische Syntax
- Fragensätze speichern, bearbeiten, duplizieren und löschen
- optionaler Supabase Cloud-Speicher mit persönlichem Cloud Code
- lokale Spiele können in die Cloud kopiert werden
- Vollbildmodus und Tastatursteuerung
- Soundtracks für Fragen, Lösungen, Joker und Gewinnstufen

## Einfachster Fragenimport

Dieses Format reicht bereits. Pro Frage fünf Zeilen, danach eine Leerzeile:

```text
Was versteht man unter Inflation?
Anstieg des allgemeinen Preisniveaus
Rückgang der Arbeitslosigkeit
Zunahme des realen BIP
Sinkende Staatsausgaben

Was ist ein Substitutionsgut zu Butter?
Margarine
Brot
Salz
Milch
```

Dabei gilt immer:

1. Zeile = Frage
2. Zeile = richtige Antwort
3. bis 5. Zeile = falsche Antworten

Die App mischt A, B, C und D bei jedem Spiel automatisch neu.

Alternativ funktioniert weiterhin das beschriftete Format:

```text
Frage: Was versteht man unter Inflation?
Richtig: Anstieg des allgemeinen Preisniveaus
Falsch: Rückgang der Arbeitslosigkeit
Falsch: Zunahme des realen BIP
Falsch: Sinkende Staatsausgaben
```

Oder mit Markierungen:

```text
Was versteht man unter Inflation?
* Anstieg des allgemeinen Preisniveaus
- Rückgang der Arbeitslosigkeit
- Zunahme des realen BIP
- Sinkende Staatsausgaben
```

## Supabase Cloud einrichten

1. Ein Supabase Projekt erstellen.
2. `supabase/schema.sql` im Supabase SQL Editor einmal vollständig ausführen.
3. In der WWM Startseite auf `Cloud einrichten` klicken.
4. Project URL und den **Publishable Key** eintragen.
5. Einen langen Cloud Code erzeugen und sicher aufbewahren.
6. Auf weiteren Geräten dieselben drei Angaben verwenden.

Der Cloud Code ist der Zugriffsschlüssel für die gespeicherten Spiele. Die Tabelle selbst ist für direkte Browserzugriffe gesperrt, die App greift nur über die definierten Supabase RPC-Funktionen darauf zu. Einen `service_role` Key niemals in die Website eintragen.

Wenn bereits lokale Spiele vorhanden sind, können sie nach dem Verbinden über `Lokale Spiele hochladen` in die Cloud kopiert werden.

## Tastatur

- `1` bis `4`: Antwort wählen
- `Enter`: Antwort einloggen oder nächste Frage
- `F`: 50:50
- `P`: Publikumsjoker
- `T`: Telefonjoker
- `L`: Lehrerjoker
