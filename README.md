# WWM Unterrichtsquiz

Browserbasiertes Unterrichtsquiz im Stil von «Wer wird Millionär?». Die App läuft ohne Backend und speichert eigene Fragensätze lokal im Browser.

## Funktionen

- 15 Gewinnstufen
- zufällige Antwortpositionen bei jedem Spiel
- 50:50, Publikumsjoker, Telefonjoker und Lehrerjoker
- einfacher Textimport, Excel/CSV und JSON
- Fragensätze lokal speichern, bearbeiten, duplizieren und löschen
- Vollbildmodus und Tastatursteuerung
- Soundtracks für Fragen, Lösungen, Joker und Gewinnstufen

## Fragenformat

```text
Frage: Was versteht man unter Inflation?
Richtig: Anstieg des allgemeinen Preisniveaus
Falsch: Rückgang der Arbeitslosigkeit
Falsch: Zunahme des realen BIP
Falsch: Sinkende Staatsausgaben
```

Zwischen zwei Fragen eine Leerzeile setzen. Die App mischt die vier Antwortpositionen automatisch.

## Tastatur

- `1` bis `4`: Antwort wählen
- `Enter`: Antwort einloggen oder nächste Frage
- `F`: 50:50
- `P`: Publikumsjoker
- `T`: Telefonjoker
- `L`: Lehrerjoker

Supabase ist in dieser Version bewusst noch nicht eingebaut.
