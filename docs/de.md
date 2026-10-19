# Google Air Quality

## Überblick

Diese Integration bringt die Luftqualität der Google Maps Platform nach Gladys: Für Ihre Häuser und die von Ihnen hinzugefügten Orte (Arbeit, Schule, Ferienhaus) liefert sie den universellen Luftqualitätsindex, den Index Ihres Landes, die Konzentrationen der wichtigsten Schadstoffe und eine 48-Stunden-Vorhersage, und sie kann Ihre Szenen starten, wenn die Luft schlechter wird.

- Jeder Ort wird zu einem **Gerät**: universeller Index (UAQI, 0-100, **je höher, desto besser**), lokaler Index (sein Wert, wenn er eine Zahl ist), PM2,5, PM10, NO₂, O₃, SO₂ in µg/m³, Luftqualitätskategorie, Kategorie des lokalen Index, Hauptschadstoff.
- Die Orte werden standardmäßig **jede Stunde** gemessen (Google aktualisiert seine Daten einmal pro Stunde) und ihre Vorhersage alle 6 Stunden, in einem Monatsbudget unter dem Gratiskontingent von Google.
- **Szenenauslöser**: Die Luftqualitätskategorie ändert sich, das Monatsbudget ist fast verbraucht, Google lehnt den API-Schlüssel ab. **Szenenaktionen**: die Luftqualität eines Orts lesen, die schlechteste Stunde der Vorhersage lesen.
- Drei **Dashboard-Widgets**: die Luftqualität eines Orts mit den Gesundheitshinweisen von Google, seine 48-Stunden-Vorhersage, die Anfragen des Monats.

![Die drei Widgets der Integration: Luftqualität eines Hauses, seine 48-Stunden-Vorhersage und die Anfragen des Monats (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-google-air-quality/main/docs/assets/widgets.de.png)

Das Bild oben ist eine generierte Illustration, kein Screenshot. Nicht mit Google verbunden; noch nicht mit einem echten API-Schlüssel getestet. Pollen gehört nicht dazu (die Pollen-API von Google wird von anderen Integrationen abgedeckt).

## Voraussetzungen

- Gladys Assistant 5.1.0 oder neuer.
- Ein **Google-Maps-Platform-API-Schlüssel** mit aktivierter **Air Quality API**:
  1. Erstellen Sie in der [Google Cloud Console](https://console.cloud.google.com/) ein Projekt (oder nehmen Sie das Ihres Google-Weather- oder Google-Maps-Travel-Time-Schlüssels) mit einem **Rechnungskonto**: Google verlangt eines auch im Gratiskontingent.
  2. Aktivieren Sie die **Air Quality API** (APIs & Dienste → Bibliothek → „Air Quality API“, oder [dieser Link](https://console.cloud.google.com/apis/library/airquality.googleapis.com)).
  3. Erstellen Sie einen **API-Schlüssel** (Google Maps Platform → Schlüssel und Anmeldedaten) oder verwenden Sie den des Projekts. Erlauben Sie in seinen **API-Einschränkungen** die Air Quality API (neben Weather API oder Routes API, wenn der Schlüssel sie auch bedient). Eine IP-Einschränkung funktioniert nur, wenn die öffentliche IP-Adresse Ihres Gladys fest ist.
- Der **Standort Ihres Hauses** in Gladys (**Einstellungen → Häuser**) oder mit **Ort hinzufügen** angelegte Orte. Bei der Installation fragt Gladys, ob die Integration den Standort der Häuser lesen darf.

**Kosten.** Google berechnet jede erfolgreiche Anfrage über 10.000 kostenlose Anfragen pro Monat hinaus (SKU „Air Quality Usage“), dann 5 USD pro 1.000. Eine Messung der aktuellen Werte ist eine Anfrage, eine 48-Stunden-Vorhersage eine Anfrage (eine Seite). Mit den Standardwerten kostet ein Ort etwa 870 Anfragen im Monat: Zehn Orte passen ins Standardbudget, 90 % des Gratiskontingents. Darüber hinaus misst die Integration seltener, statt es zu überschreiten. Das Gratiskontingent gehört zum Rechnungskonto: Google Weather, Travel Time und jede andere Nutzung des Kontos zählen mit.

## Konfiguration

| Feld                               | Standard    | Bedeutung                                                                                                                                                                                                     |
| ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google-Maps-Platform-API-Schlüssel | —           | Pflicht. Geheim: nie in den Logs.                                                                                                                                                                             |
| Häuser von Gladys verfolgen        | ja          | Ein Ort pro Haus mit Standort.                                                                                                                                                                                |
| Messung alle (Minuten)             | 60          | 30 bis 360. Jedes Mal eine Anfrage pro Ort.                                                                                                                                                                   |
| Vorhersage alle (Stunden)          | 6           | 0 bis 24. 0: keine Vorhersage (kein Vorhersage-Widget, keine Vorhersage-Aktion).                                                                                                                              |
| Lokaler Index                      | leer        | Leer: der Standardindex des Landes (UBA in Deutschland). Sonst sein Google-Code: `eaqi` (europäischer Index), `usa_epa`, `deu_uba`, `gbr_defra`… (Liste: Seite „Air Quality Index“ der Google-Dokumentation). |
| Monatsbudget (%)                   | 90          | Anteil der 10.000 Gratis-Anfragen, den die Integration verbrauchen darf. Über 100 berechnet Google die zusätzlichen Anfragen.                                                                                 |
| Sprache der Texte                  | automatisch | Funktionsnamen, Kategorien und Gesundheitshinweise von Google, Szenen-Zusammenfassungen, Meldungen der Schaltflächen.                                                                                         |

Schaltflächen unten auf der Seite:

- **Ort hinzufügen**: ein Name und „Breite, Länge“ (Rechtsklick auf den Ort in Google Maps, dann auf die Koordinaten klicken, um sie zu kopieren, etwa `45.7640, 4.8357`).
- **Ort entfernen**: über seinen Namen oder seine Nummer (`#2`). Sein Gerät bleibt in Gladys, bis Sie es löschen.
- **Orte auflisten**: die Intervalle, die Anfragen des Monats, die letzte Messung und der letzte Fehler jedes Orts.
- **API-Schlüssel testen**: liest die Luftqualität in Paris (eine Anfrage).

## Verwendung

### Orte

Jedes Haus in Gladys mit Standort ist ein Ort und heißt wie das Haus. Hinzugefügte Orte kommen dazu (höchstens 20). Die erste Messung eines neuen Orts kommt innerhalb einer Minute.

### Geräte

Öffnen Sie **Integrationen → Google Air Quality → Entdecken** und fügen Sie die gewünschten Orte hinzu. Jedes Gerät hat:

| Funktion                                                   | Kategorie / Typ                             | Einheit                               |
| ---------------------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| Universeller Index (UAQI)                                  | airquality-sensor / aqi                     | 0-100, je höher, desto besser         |
| Lokaler Index (wenn er eine Zahl ist: UBA, US EPA, DAQI…)  | airquality-sensor / aqi                     | die Skala des Index                   |
| PM2,5, PM10                                                | pm25-sensor, pm10-sensor / decimal          | µg/m³                                 |
| NO₂, O₃, SO₂                                               | no2-sensor, o3-sensor, so2-sensor / decimal | µg/m³ (aus ppb bei 25 °C umgerechnet) |
| Luftqualität, Kategorie des lokalen Index, Hauptschadstoff | text                                        | —                                     |

ATMO (Frankreich) und EAQI (Europa) haben Kategorien, keine Zahlen: Ihre Kategorie steht im Text „Kategorie des lokalen Index“. Ein Schadstoff, den Google an einem Ort nicht misst, bleibt ohne Wert. CO hat in Gladys keine Konzentrationskategorie: Sie finden es in den Ausgaben der Aktion „Luftqualität lesen“.

### Dashboard-Widgets

- **Luftqualität**: ein Ort (unter den Geräten gewählt): Anzeige des universellen Index, lokaler Index, PM2,5, PM10, NO₂, O₃, Kategorien, Hauptschadstoff und der Gesundheitshinweis von Google für die Allgemeinbevölkerung.
- **Luftqualitätsprognose**: der universelle Index der nächsten 48 Stunden, die schlechteste Stunde der nächsten 24 markiert.
- **Luftqualitätsanfragen**: die Anfragen des Monats gegenüber dem Budget, das Geplante, der Zustand des Schlüssels.

### Szenen

Auslöser:

- **Die Luftqualitätskategorie ändert sich** (Filter: Ort, universeller oder lokaler Index, neue universelle Stufe). Variablen: `name`, `index`, `category`, `previous_category`, `level`, `previous_level`, `aqi`, `dominant_pollutant`, `summary`. Nur bei geplanten Messungen, nie bei der ersten.
- **Das Monatsbudget ist fast verbraucht** (80 %, dann 100 %, je einmal pro Monat).
- **Google lehnt den API-Schlüssel ab** (einmal, bis eine Anfrage wieder funktioniert).

Aktionen:

- **Luftqualität lesen**: die letzte Messung eines Orts (eine neue Anfrage mit „Jetzt lesen“, keine, wenn er vor weniger als einer Minute gemessen wurde). Ausgaben: `uaqi`, `level`, `category`, `local_index`, `local_aqi`, `local_category`, `dominant_pollutant`, `pm25`, `pm10`, `no2`, `o3`, `so2`, `co`, `health_recommendation`, `summary`.
- **Luftqualitätsprognose lesen**: die schlechteste Stunde der nächsten 1 bis 48 Stunden. Ausgaben: `worst_uaqi`, `worst_level`, `worst_category`, `worst_time`, `worst_local_category`, `summary`.

Beispiele:

- Wenn der universelle Index von „Zuhause“ auf „schlecht“ wechselt → die Rollläden schließen und die Zusammenfassung senden.
- Jeden Morgen um 7:00 → die Vorhersage von „Zuhause“ für 12 Stunden lesen → liegt `worst_uaqi` unter 40, „Kein guter Tag zum Laufen“ senden.
- Wenn PM2,5 von „Zuhause“ 25 µg/m³ übersteigt (Geräteauslöser) → den Luftreiniger einschalten.

### Transport

Die Integration nutzt die Server von Google (Cloud): **Die Koordinaten Ihrer Orte werden bei jeder Messung an Google gesendet**, mit Ihrem API-Schlüssel. Die hinzugefügten Orte liegen in der Gladys-Konfiguration; die letzten Messungen, die Vorhersagen und der Anfragezähler liegen im Volume `/data` der Integration.

## Fehlerbehebung

- **„Google lehnt den API-Schlüssel ab“**: Die Meldung nennt den Grund von Google. `API_KEY_INVALID`: Schlüssel erneut kopieren. `SERVICE_DISABLED`: die Air Quality API im Projekt des Schlüssels aktivieren. `BILLING_DISABLED`: ein Rechnungskonto verknüpfen. `API_KEY_SERVICE_BLOCKED`: die Air Quality API zu den erlaubten APIs des Schlüssels hinzufügen. Eine IP-Einschränkung lehnt Gladys ab, wenn sich seine öffentliche Adresse geändert hat. Die Integration versucht es stündlich erneut, und sofort nach **API-Schlüssel testen** oder einem neuen Schlüssel.
- **Kein Ort**: den Standort des Hauses unter **Einstellungen → Häuser** festlegen (dann **Orte auflisten** drücken) oder einen Ort hinzufügen.
- **„Keine Luftqualitätsdaten für diesen Ort“**: Google deckt nicht jedes Land ab (siehe die Abdeckungsseite der Air Quality API).
- **Kein Wert des lokalen Index**: Der Index Ihres Landes ist eine Kategorie (ATMO, EAQI); siehe die Kategorie des lokalen Index, oder wählen Sie in der Konfiguration einen Index mit Zahlen.
- **Seltenere Messungen als das Intervall**: „Um im Budget zu bleiben“ im Status heißt, dass die Orte mehr planen als das Budget; weniger Orte verfolgen, seltener messen oder das Budget erhöhen.
- **„Die Anfragen des Monats sind verbraucht“**: Das Budget ist erreicht; die Messungen gehen im nächsten Monat weiter (UTC). Maßgeblich ist die Zählung von Google (Cloud Console → Google Maps Platform → Messwerte).
- **429**: Google begrenzt die Anfragen des Schlüssels; die Integration wartet 15 Minuten.
- Für eine Fehlermeldung: Versionen von Gladys und der Integration, der Text von **Orte auflisten** und die Logs der Integration (Einstellungen → Supervision). Fügen Sie nie Ihren API-Schlüssel ein.
