# ⚽ Kicker App

Eine kleine Web-App, die am Tischkicker faire 2-gegen-2-Runden auslost: wer spielt, wer mit wem, und wer ins Tor oder in den Sturm geht.

**App öffnen:** https://ursl-shde.github.io/kicker-app/

Die App ist fürs Handy gebaut. Über „Zum Home-Bildschirm hinzufügen“ im Browser lässt sie sich wie eine normale App starten.

## So funktioniert's

1. Im Tab **Spieler** eure Stammspieler anlegen.
2. Im Tab **Auslosen** per Chip markieren, wer heute da ist (mindestens 4).
3. **Auslosen** antippen, die Runde bei Bedarf anpassen und **Spiel starten**.
4. Nach dem Spiel das Ergebnis eintragen, oder **Ohne Ergebnis**, wenn ihr keins festhalten wollt.

Erst gestartete Spiele landen im Verlauf und fließen in die nächsten Auslosungen ein. Mit **Abbrechen** zählt ein versehentlich gestartetes Spiel nicht, und ihr landet wieder bei der Aufstellung.

## Wie ausgelost wird

- **Wer spielt:** Die vier Anwesenden mit den wenigsten Runden in der aktuellen Session sind dran. Bei Gleichstand entscheidet der Zufall.
- **Wer mit wem:** Paarungen, die schon oft zusammengespielt haben, werden unwahrscheinlicher. Dafür zählt der gesamte Verlauf, nicht nur die Session.
- **Tor oder Sturm:** Wird zufällig verteilt. Wer zu oft hintereinander dieselbe Position hatte, bekommt automatisch die andere. Die Grenze liegt standardmäßig bei 3 und lässt sich unter **Mehr** ändern. Spiele mit gemischten Positionen zählen dabei nicht mit.

## Weitere Funktionen

- **Revanche:** wiederholt die letzte Runde mit denselben Teams und Positionen.
- **Eigene Kombination:** vier Spieler als Ausgangspunkt, die ihr frei umsetzen könnt.
- **Runde anpassen:** vor dem Start mit ⇅ Tor und Sturm im Team tauschen oder einen Namen antippen (▾), um den Spieler zu ersetzen.
- **Ergebnis:** Tore pro Team mit +/− eintragen; die Krone zeigt, wer vorne liegt, 🤝 ein Unentschieden. Positionen lassen sich dabei noch mit ⇅ tauschen oder als „gemischt“ markieren, wenn ihr frei gewählt oder mittendrin gewechselt habt.
- **Verlauf:** alle Spiele mit Datum und Ergebnis; Ergebnisse lassen sich nachträglich eintragen oder ändern, einzelne Einträge löschen.
- **Anwesenheit ausblenden:** die Namens-Chips lassen sich einklappen und erscheinen nach „Session zurücksetzen“ wieder.
- **Session zurücksetzen:** setzt die „heute gespielt“-Zähler auf 0, der Verlauf bleibt.
- **Export / Import:** sichert Spieler, Verlauf und Einstellungen als JSON-Datei.
- Helles und dunkles Design, je nach Systemeinstellung.

## Daten

Alles wird ausschließlich lokal im Browser gespeichert (`localStorage`). Es gibt keinen Server, kein Konto und keine Synchronisation zwischen Geräten. Wer das Gerät wechselt oder die Browserdaten löscht, sollte vorher unter **Mehr** exportieren.

## Entwicklung

Die App besteht aus HTML, CSS und JavaScript-Modulen, ohne Build-Schritt und ohne Abhängigkeiten. Nur die Schriftarten werden von Google Fonts geladen.

| Datei | Inhalt |
|---|---|
| [index.html](index.html) | Grundgerüst der Seite |
| [styles.css](styles.css) | Gestaltung |
| [js/main.js](js/main.js) | Einstieg: Rendern und Navigation |
| [js/state.js](js/state.js) | Zustand, Laden und Speichern |
| [js/history.js](js/history.js), [js/draw.js](js/draw.js) | Auswertung des Verlaufs und Auslosung, ohne Zugriff auf Seite oder Speicher |
| [js/actions.js](js/actions.js) | alles, was den Zustand ändert |
| [js/views/](js/views/) | die einzelnen Tabs |
| [tests/](tests/) | Tests für Auslosung und Zustand |

### Lokal starten

JavaScript-Module lädt der Browser nur über einen Webserver, nicht direkt aus einer Datei. Ein Doppelklick auf `index.html` reicht deshalb nicht.

```bash
git clone https://github.com/ursl-shde/kicker-app.git
cd kicker-app
npm start
```

Danach läuft die App unter http://localhost:8000. `npm start` ruft nur `python3 -m http.server 8000` auf.

### Tests

```bash
npm test
```

Die Tests brauchen [Node.js](https://nodejs.org) ab Version 20 und sonst nichts. Auf GitHub laufen sie bei jedem Push automatisch.

### Veröffentlichen

Veröffentlicht wird über GitHub Pages: Was auf `main` liegt, ist kurz darauf live.
