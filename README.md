# Magnetfeldlinien – interaktive Simulation

Eine kleine HTML/CSS/JavaScript-Simulation für den Physikunterricht.

Beim ersten Aufruf ist nur Magnet 1 als Stabmagnet sichtbar. Die magnetische
Wirkung und die Feldlinien sind zunächst ausgeschaltet.

## Enthaltene Funktionen

- Stabmagnet
- U-/Rechteckmagnet mit Öffnung nach oben
- Nordpol rot, Südpol grün
- optional zweiter Magnet
- beide Magnete können einzeln ausgeschaltet werden
- einstellbare Magnetstärke
- zwei zuschaltbare stromdurchflossene Leiter in Draufsicht
- Stromstärke und Richtung einstellbar (Kreuz hinein, Punkt heraus)
- wenige, stromabhängig dichter werdende Feldlinien
- zweiter Leiter frei verschiebbar und gemeinsames Überlagerungsfeld
- bewegliche Kompassnadel
- automatische Ausrichtung der Kompassnadel
- einzelne Feldlinie durch die Kompassposition
- Anzeige des gesamten Magnetfelds
- getrennte Anzeige des Feldes von Magnet 1, Magnet 2 oder beider Magnete
- Vorhersagemodus:
  - magnetische Wirkung aus
  - Kompass manuell drehen
  - anschließend Lösung prüfen
- näherungsweise homogenes Feld im Luftspalt des Rechteckmagneten

## Projektstruktur

```text
magnetfeld-simulation/
├── index.html
├── style.css
├── app.js
└── README.md
```

## In VS Code starten

### Variante 1: Live Server

1. Den Projektordner in VS Code öffnen.
2. Die Erweiterung **Live Server** installieren.
3. `index.html` öffnen.
4. Rechts unten auf **Go Live** klicken.

Die Simulation öffnet sich im Browser und aktualisiert sich bei Änderungen automatisch.

### Variante 2: Ohne Erweiterung

Im VS-Code-Terminal im Projektordner ausführen:

```bash
python -m http.server 8000
```

Danach im Browser öffnen:

```text
http://localhost:8000
```

## Wo ändere ich was?

### `index.html`

Benutzeroberfläche:
- Buttons
- Auswahlfelder
- Beschriftungen
- Regler

### `style.css`

Darstellung:
- Farben
- Größen
- Abstände
- responsive Ansicht

Wichtige Farbvariablen:

```css
--north: #f04444;
--south: #218c4b;
--field: #3f759d;
```

### `app.js`

Simulation und Physikmodell:
- Magnetpositionen
- Feldberechnung
- Feldlinien
- getrennt gefärbte Einzelfelder beider Magnete und beider Leiter
- Kompassausrichtung
- Vorhersagemodus
- Feldliniendichte

Wichtige Funktionen:

- `magnets()` – erzeugt die aktuellen Magnetkonfigurationen
- `field(x, y)` – berechnet das resultierende Magnetfeld
- `traceFieldLine(...)` – verfolgt eine Feldlinie auch außerhalb der Zeichenfläche
- `drawEntireField()` – zeichnet das gesamte Feld
- `drawSingleFieldLine()` – zeichnet die Feldlinie durch den Kompass
- `drawCompass()` – zeichnet und dreht die Kompassnadel
- `drawBarMagnet()` – zeichnet den Stabmagneten
- `drawRectMagnet()` – zeichnet den U-/Rechteckmagneten

## Hinweis zum Modell

Die Simulation ist bewusst ein qualitatives Unterrichtsmodell und keine numerische
Finite-Elemente-Simulation. Das Feld des U-/Rechteckmagneten wird im Luftspalt
zusätzlich geglättet, damit der wichtige Lerneffekt eines näherungsweise homogenen
Magnetfeldes gut sichtbar wird.

Feldlinien werden rechnerisch über die sichtbare Zeichenfläche hinaus verfolgt.
Dadurch treten sie nach einem außerhalb liegenden Bogen an der physikalisch
passenden Stelle wieder ins Bild ein, statt an die gegenüberliegende Kante
versetzt zu werden. Eine Ausnahme ist die nahezu waagerechte axiale Feldlinie
eines allein dargestellten Stabmagneten: Da sie sich im Punktpolmodell erst im
Unendlichen schließt, wird sie am gegenüberliegenden horizontalen Bildrand
fortgesetzt.
