# WWM Unterrichtsquiz

Browserbasiertes Unterrichtsquiz im Stil von «Wer wird Millionär?» mit getrenntem Lehrer- und Lernendenmodus.

## Startseite

Die App startet immer mit zwei Möglichkeiten:

- **Lehrermodus**
- **Lernendenmodus**

Der Lehrermodus ist über das in Supabase hinterlegte Passwort geschützt. Standardmässig ist es `1234`. Der Lernendenmodus benötigt kein Passwort.

## Lehrermodus

Lehrpersonen können:

- Spiele erstellen, bearbeiten, duplizieren und löschen
- Fragen über einfachen Text, Excel/CSV oder JSON importieren
- Spiele direkt am Beamer durchführen
- ein Spiel für Lernende hosten
- den permanenten Spielcode anzeigen
- den Lernstand der Teilnehmenden live verfolgen
- Namen, Klassen, Fortschritt, Joker und Status sehen
- eine Fragenanalyse mit Erfolgsquoten sehen
- vergangene gehostete Durchläufe auflisten

Das Live-Dashboard aktualisiert sich automatisch alle 30 Sekunden.

## Lernendenmodus

Lernende geben nur ein:

- Name
- Klasse
- Spielcode

Danach spielen sie das aktuell gehostete Spiel selbstständig. Lehrerfunktionen, technische Einstellungen und Supabase-Informationen werden im Lernendenmodus nicht angezeigt.

Die richtige Lösung wird bei gehosteten Spielen nicht vorzeitig an den Browser geschickt. Erst nach dem Einloggen einer Antwort liefert das Backend das Ergebnis zurück.

## Joker

Enthalten sind:

- 50:50
- Publikumsjoker
- Telefonjoker
- Lehrerjoker

### Publikumsjoker

- Sekunde 0: Abstimmung beginnt
- Sekunde 27: Publikumsjoker-Sound startet
- Sekunde 32: Prozentresultate erscheinen

### Telefonjoker

- Sekunde 0: Verbindung und Frageübergabe
- Sekunde 20: Telefonjoker-Sound startet
- Sekunde 20 bis 38: Denkprozess in mehreren Etappen
- Sekunde 38: finaler Tipp erscheint

## Audio

Die vorhandenen MP3-Dateien in `assets/audio/` werden für Intro, Fragemusik, richtige und falsche Antworten, Gewinnstufen und Joker verwendet.

Das Intro muss nicht vollständig angehört werden. Das Spiel kann jederzeit gestartet werden. Nach einer richtigen Antwort erscheint die Schaltfläche für die nächste Frage sofort, auch wenn der Erfolgssound noch läuft.

## Fragenimport

Das einfachste Format besteht aus fünf Zeilen pro Frage:

```text
Was versteht man unter Inflation?
Anstieg des allgemeinen Preisniveaus
Sinkende Arbeitslosigkeit
Steigendes reales BIP
Sinkende Staatsausgaben

Was ist ein Substitutionsgut zu Butter?
Margarine
Brot
Milch
Salz
```

Dabei gilt:

1. Zeile = Frage
2. Zeile = richtige Antwort
3. bis 5. Zeile = falsche Antworten

A, B, C und D werden beim Spielen automatisch gemischt.

## Supabase

Supabase läuft vollständig im Hintergrund. Es gibt in der normalen Oberfläche keine Cloud-Einstellungen.

Einmalig nötig:

1. Das aktuelle WWM SQL-Schema im Supabase SQL Editor ausführen.
2. In `js/config-v3.js` die **Project URL** und den **Publishable Key** eintragen.
3. Niemals einen `service_role` Key in die Website eintragen.

Die neue Oberfläche verwendet die RPC-Funktionen mit Präfix `wwm_teacher_` und `wwm_student_`.

## Tastatur im Spiel

- `1` bis `4`: Antwort wählen
- `Enter`: Antwort einloggen oder nächste Frage
- `F`: 50:50
- `P`: Publikumsjoker
- `T`: Telefonjoker
- `L`: Lehrerjoker
