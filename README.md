# ⚽ Kicker App

Eine kleine Web-App, die am Tischkicker faire 2-gegen-2-Runden auslost: wer spielt, wer mit wem, und wer ins Tor oder in den Sturm geht.

**App öffnen:** https://ursl-shde.github.io/kicker-app/

Die App ist fürs Handy gebaut. Über „Zum Home-Bildschirm hinzufügen“ im Browser lässt sie sich wie eine normale App starten.

## So funktioniert's

1. Im Tab **Spieler** eure Stammspieler anlegen.
2. Im Tab **Auslosen** per Chip markieren, wer heute da ist (mindestens 4).
3. **Auslosen** antippen, die Runde bei Bedarf anpassen und bestätigen.

Erst bestätigte Runden landen im Verlauf und fließen in die nächsten Auslosungen ein.

## Wie ausgelost wird

- **Wer spielt:** Die vier Anwesenden mit den wenigsten Runden in der aktuellen Session sind dran. Bei Gleichstand entscheidet der Zufall.
- **Wer mit wem:** Paarungen, die schon oft zusammengespielt haben, werden unwahrscheinlicher. Dafür zählt der gesamte Verlauf, nicht nur die Session.
- **Tor oder Sturm:** Wird zufällig verteilt. Wer zu oft hintereinander dieselbe Position hatte, bekommt automatisch die andere. Die Grenze liegt standardmäßig bei 3 und lässt sich unter **Mehr** ändern.

## Weitere Funktionen

- **Revanche:** wiederholt die letzte Runde mit denselben Teams und Positionen.
- **Eigene Kombination:** vier Spieler als Ausgangspunkt, die ihr frei umsetzen könnt.
- **Runde anpassen:** vor dem Bestätigen Positionen im Team tauschen oder Spieler über die Auswahlfelder ersetzen.
- **Verlauf:** alle gespeicherten Runden mit Datum; einzelne Einträge lassen sich löschen.
- **Session zurücksetzen:** setzt die „heute gespielt“-Zähler auf 0, der Verlauf bleibt.
- **Export / Import:** sichert Spieler, Verlauf und Einstellungen als JSON-Datei.
- Helles und dunkles Design, je nach Systemeinstellung.

## Daten

Alles wird ausschließlich lokal im Browser gespeichert (`localStorage`). Es gibt keinen Server, kein Konto und keine Synchronisation zwischen Geräten. Wer das Gerät wechselt oder die Browserdaten löscht, sollte vorher unter **Mehr** exportieren.

## Entwicklung

Die gesamte App steckt in einer einzigen Datei, [index.html](index.html), ohne Build-Schritt und ohne Abhängigkeiten. Nur die Schriftarten werden von Google Fonts geladen.

```bash
git clone https://github.com/ursl-shde/kicker-app.git
cd kicker-app
open index.html
```

Veröffentlicht wird über GitHub Pages: Was auf `main` liegt, ist kurz darauf live.
