# WWM Schule

Unterrichtsquiz im Stil von «Wer wird Millionär?».

## Geplant und vorbereitet

- 15 Gewinnstufen
- vier Joker: 50:50, Publikum, Telefon und Lehrerjoker
- einfacher Fragenimport per Text, CSV oder JSON
- zufällige Positionierung der Antworten
- lokale Speicherung als Fallback
- vorbereitete Supabase Anbindung für gespeicherte Spiele
- Audio Struktur für spätere MP3 Sounds
- Vollbild und Tastatursteuerung für den Beamer

## Fragenformat

Am einfachsten können Fragen so eingefügt werden:

```text
Frage: Was versteht man unter Inflation?
Richtig: Anstieg des allgemeinen Preisniveaus
Falsch: Rückgang der Arbeitslosigkeit
Falsch: Zunahme des realen BIP
Falsch: Sinkende Staatsausgaben

Frage: Was ist ein Substitutionsgut zu Butter?
Richtig: Margarine
Falsch: Brot
Falsch: Salz
Falsch: Milch
```

Die Antwortpositionen A bis D werden beim Start automatisch gemischt.

## Supabase

Die App funktioniert zunächst lokal. Für die Cloud Speicherung werden später nur Project URL und Publishable Key ergänzt. Kein `service_role` Key gehört in dieses Repository.
