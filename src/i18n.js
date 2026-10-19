// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: feature names, widget contents, scene summaries, messages of the
// Configuration screen. Vocabulary of the Gladys interface: appareil / Gerät /
// dispositivo, scène / Szene / escena, Découverte / Entdecken / Descubrir.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // Universal AQI levels (the five categories of the UAQI)
  level_excellent: {
    en: 'Excellent air quality',
    fr: 'Excellente qualité de l’air',
    de: 'Ausgezeichnete Luftqualität',
    es: 'Calidad del aire excelente',
  },
  level_good: {
    en: 'Good air quality',
    fr: 'Bonne qualité de l’air',
    de: 'Gute Luftqualität',
    es: 'Buena calidad del aire',
  },
  level_moderate: {
    en: 'Moderate air quality',
    fr: 'Qualité de l’air moyenne',
    de: 'Mäßige Luftqualität',
    es: 'Calidad del aire moderada',
  },
  level_low: {
    en: 'Low air quality',
    fr: 'Qualité de l’air médiocre',
    de: 'Schlechte Luftqualität',
    es: 'Calidad del aire baja',
  },
  level_poor: {
    en: 'Poor air quality',
    fr: 'Mauvaise qualité de l’air',
    de: 'Sehr schlechte Luftqualität',
    es: 'Calidad del aire mala',
  },
  kind_house: {
    en: 'House of Gladys',
    fr: 'Maison de Gladys',
    de: 'Haus in Gladys',
    es: 'Casa de Gladys',
  },
  kind_place: {
    en: 'Added place',
    fr: 'Lieu ajouté',
    de: 'Hinzugefügter Ort',
    es: 'Lugar añadido',
  },

  // feature names
  featureUaqi: {
    en: 'Universal AQI',
    fr: 'Indice universel (UAQI)',
    de: 'Universeller Luftqualitätsindex',
    es: 'Índice universal (UAQI)',
  },
  featureLocalAqi: { en: '{index}', fr: '{index}', de: '{index}', es: '{index}' },
  featurePm25: { en: 'PM2.5', fr: 'PM2,5', de: 'PM2,5', es: 'PM2,5' },
  featurePm10: { en: 'PM10', fr: 'PM10', de: 'PM10', es: 'PM10' },
  featureNo2: {
    en: 'Nitrogen dioxide (NO₂)',
    fr: 'Dioxyde d’azote (NO₂)',
    de: 'Stickstoffdioxid (NO₂)',
    es: 'Dióxido de nitrógeno (NO₂)',
  },
  featureO3: { en: 'Ozone (O₃)', fr: 'Ozone (O₃)', de: 'Ozon (O₃)', es: 'Ozono (O₃)' },
  featureSo2: {
    en: 'Sulfur dioxide (SO₂)',
    fr: 'Dioxyde de soufre (SO₂)',
    de: 'Schwefeldioxid (SO₂)',
    es: 'Dióxido de azufre (SO₂)',
  },
  featureCategory: {
    en: 'Air quality',
    fr: 'Qualité de l’air',
    de: 'Luftqualität',
    es: 'Calidad del aire',
  },
  featureLocalCategory: {
    en: 'Local index category',
    fr: 'Catégorie de l’indice local',
    de: 'Kategorie des lokalen Index',
    es: 'Categoría del índice local',
  },
  featureDominant: {
    en: 'Dominant pollutant',
    fr: 'Polluant majoritaire',
    de: 'Hauptschadstoff',
    es: 'Contaminante principal',
  },

  // scene summaries
  summary: {
    en: '{name}: {category} (UAQI {aqi}){details}.',
    fr: '{name} : {category} (UAQI {aqi}){details}.',
    de: '{name}: {category} (UAQI {aqi}){details}.',
    es: '{name}: {category} (UAQI {aqi}){details}.',
  },
  summaryLocal: {
    en: '{index}: {category}',
    fr: '{index} : {category}',
    de: '{index}: {category}',
    es: '{index}: {category}',
  },
  summaryDominant: {
    en: 'mainly {pollutant}',
    fr: 'surtout {pollutant}',
    de: 'vor allem {pollutant}',
    es: 'sobre todo {pollutant}',
  },
  forecastSummary: {
    en: '{name}: worst air of the next {hours} h at {time}, {category} (UAQI {aqi}).',
    fr: '{name} : air le moins bon des {hours} prochaines heures à {time}, {category} (UAQI {aqi}).',
    de: '{name}: schlechteste Luft der nächsten {hours} Std. um {time}, {category} (UAQI {aqi}).',
    es: '{name}: peor aire de las próximas {hours} h a las {time}, {category} (UAQI {aqi}).',
  },
  changedSummary: {
    en: '{name}: {index} goes from {previous} to {category}.',
    fr: '{name} : {index} passe de {previous} à {category}.',
    de: '{name}: {index} wechselt von {previous} zu {category}.',
    es: '{name}: {index} pasa de {previous} a {category}.',
  },
  budgetWarningSummary: {
    en: 'Google Air Quality: {used} of the {budget} requests of the month are used.',
    fr: 'Google Air Quality : {used} des {budget} requêtes du mois sont utilisées.',
    de: 'Google Air Quality: {used} der {budget} Anfragen des Monats sind verbraucht.',
    es: 'Google Air Quality: se han usado {used} de las {budget} solicitudes del mes.',
  },
  budgetExhaustedSummary: {
    en: 'Google Air Quality: the {budget} requests of the month are used, readings resume next month.',
    fr: 'Google Air Quality : les {budget} requêtes du mois sont utilisées, les mesures reprennent le mois prochain.',
    de: 'Google Air Quality: Die {budget} Anfragen des Monats sind verbraucht, die Messungen gehen nächsten Monat weiter.',
    es: 'Google Air Quality: se han usado las {budget} solicitudes del mes, las medidas se reanudan el mes que viene.',
  },
  apiErrorSummary: {
    en: 'Google Air Quality: Google refuses the API key ({reason}). {hint}',
    fr: 'Google Air Quality : Google refuse la clé d’API ({reason}). {hint}',
    de: 'Google Air Quality: Google lehnt den API-Schlüssel ab ({reason}). {hint}',
    es: 'Google Air Quality: Google rechaza la clave de API ({reason}). {hint}',
  },

  // what to do about a refused key
  hint_API_KEY_MISSING: {
    en: 'Type your Google Maps Platform API key in the configuration.',
    fr: 'Saisissez votre clé d’API Google Maps Platform dans la configuration.',
    de: 'Geben Sie Ihren Google-Maps-Platform-API-Schlüssel in der Konfiguration ein.',
    es: 'Escriba su clave de API de Google Maps Platform en la configuración.',
  },
  hint_API_KEY_INVALID: {
    en: 'Check the key: copy it again from the Google Cloud console.',
    fr: 'Vérifiez la clé : copiez-la de nouveau depuis la console Google Cloud.',
    de: 'Prüfen Sie den Schlüssel: Kopieren Sie ihn erneut aus der Google Cloud Console.',
    es: 'Compruebe la clave: cópiela de nuevo desde la consola de Google Cloud.',
  },
  hint_SERVICE_DISABLED: {
    en: 'Enable the “Air Quality API” in the Google Cloud project of the key.',
    fr: 'Activez l’« Air Quality API » dans le projet Google Cloud de la clé.',
    de: 'Aktivieren Sie die „Air Quality API“ im Google-Cloud-Projekt des Schlüssels.',
    es: 'Active la «Air Quality API» en el proyecto de Google Cloud de la clave.',
  },
  hint_BILLING_DISABLED: {
    en: 'Link a billing account to the Google Cloud project (needed even within the free usage).',
    fr: 'Associez un compte de facturation au projet Google Cloud (nécessaire même dans l’usage gratuit).',
    de: 'Verknüpfen Sie ein Rechnungskonto mit dem Google-Cloud-Projekt (auch im kostenlosen Kontingent nötig).',
    es: 'Vincule una cuenta de facturación al proyecto de Google Cloud (necesaria incluso en el uso gratuito).',
  },
  hint_API_KEY_SERVICE_BLOCKED: {
    en: 'The restrictions of the key do not allow the Air Quality API: add it to the allowed APIs.',
    fr: 'Les restrictions de la clé n’autorisent pas l’Air Quality API : ajoutez-la aux API autorisées.',
    de: 'Die Einschränkungen des Schlüssels erlauben die Air Quality API nicht: Fügen Sie sie den erlaubten APIs hinzu.',
    es: 'Las restricciones de la clave no permiten la Air Quality API: añádala a las API permitidas.',
  },
  hint_restricted: {
    en: 'The restrictions of the key (IP address, website, app) refuse Gladys: allow its public IP address, or remove them.',
    fr: 'Les restrictions de la clé (adresse IP, site, application) refusent Gladys : autorisez son adresse IP publique, ou retirez-les.',
    de: 'Die Einschränkungen des Schlüssels (IP-Adresse, Website, App) lehnen Gladys ab: Erlauben Sie ihre öffentliche IP-Adresse oder entfernen Sie sie.',
    es: 'Las restricciones de la clave (dirección IP, sitio, aplicación) rechazan a Gladys: permita su dirección IP pública o elimínelas.',
  },
  hint_default: {
    en: 'Check the key, the Air Quality API and the billing account of the Google Cloud project.',
    fr: 'Vérifiez la clé, l’Air Quality API et le compte de facturation du projet Google Cloud.',
    de: 'Prüfen Sie den Schlüssel, die Air Quality API und das Rechnungskonto des Google-Cloud-Projekts.',
    es: 'Compruebe la clave, la Air Quality API y la cuenta de facturación del proyecto de Google Cloud.',
  },

  // connection status (Configuration screen)
  statusNoKey: {
    en: 'Type your Google Maps Platform API key (Air Quality API enabled).',
    fr: 'Saisissez votre clé d’API Google Maps Platform (Air Quality API activée).',
    de: 'Geben Sie Ihren Google-Maps-Platform-API-Schlüssel ein (Air Quality API aktiviert).',
    es: 'Escriba su clave de API de Google Maps Platform (Air Quality API activada).',
  },
  statusKeyError: {
    en: 'Google refuses the API key ({reason}). {hint}',
    fr: 'Google refuse la clé d’API ({reason}). {hint}',
    de: 'Google lehnt den API-Schlüssel ab ({reason}). {hint}',
    es: 'Google rechaza la clave de API ({reason}). {hint}',
  },
  statusEmpty: {
    en: 'No place yet: set the location of your house in Gladys (Settings → Houses), or use “Add a place”.',
    fr: 'Aucun lieu pour l’instant : renseignez l’emplacement de votre maison dans Gladys (Paramètres → Maisons), ou utilisez « Ajouter un lieu ».',
    de: 'Noch kein Ort: Legen Sie den Standort Ihres Hauses in Gladys fest (Einstellungen → Häuser) oder verwenden Sie „Ort hinzufügen“.',
    es: 'Aún no hay ningún lugar: indique la ubicación de su casa en Gladys (Ajustes → Casas) o use «Añadir un lugar».',
  },
  statusOk: {
    en: '{count} place(s). {usage}',
    fr: '{count} lieu(x). {usage}',
    de: '{count} Ort(e). {usage}',
    es: '{count} lugar(es). {usage}',
  },
  statusUsage: {
    en: 'This month: {used} / {budget} requests (≈ {planned} planned).',
    fr: 'Ce mois-ci : {used} / {budget} requêtes (≈ {planned} prévues).',
    de: 'Diesen Monat: {used} / {budget} Anfragen (≈ {planned} geplant).',
    es: 'Este mes: {used} / {budget} solicitudes (≈ {planned} previstas).',
  },
  statusStretched: {
    en: ' To stay within the budget: a reading every {refresh} min, a forecast every {forecast} h.',
    fr: ' Pour rester dans le budget : une mesure toutes les {refresh} min, une prévision toutes les {forecast} h.',
    de: ' Um im Budget zu bleiben: eine Messung alle {refresh} Min., eine Vorhersage alle {forecast} Std.',
    es: ' Para no superar el presupuesto: una medida cada {refresh} min, una previsión cada {forecast} h.',
  },

  // errors
  errorName: {
    en: 'The name holds 1 to {max} characters.',
    fr: 'Le nom compte de 1 à {max} caractères.',
    de: 'Der Name hat 1 bis {max} Zeichen.',
    es: 'El nombre tiene de 1 a {max} caracteres.',
  },
  errorCoordinates: {
    en: 'Type the coordinates as “latitude, longitude”, such as 45.7640, 4.8357 (right-click the place in Google Maps to copy them).',
    fr: 'Saisissez les coordonnées sous la forme « latitude, longitude », comme 45.7640, 4.8357 (clic droit sur le lieu dans Google Maps pour les copier).',
    de: 'Geben Sie die Koordinaten als „Breite, Länge“ ein, etwa 45.7640, 4.8357 (Rechtsklick auf den Ort in Google Maps, um sie zu kopieren).',
    es: 'Escriba las coordenadas como «latitud, longitud», por ejemplo 45.7640, 4.8357 (clic derecho en el lugar en Google Maps para copiarlas).',
  },
  errorTarget: {
    en: 'Which place? Type its name or its number (#2).',
    fr: 'Quel lieu ? Saisissez son nom ou son numéro (#2).',
    de: 'Welcher Ort? Geben Sie seinen Namen oder seine Nummer ein (#2).',
    es: '¿Qué lugar? Escriba su nombre o su número (#2).',
  },
  errorAmbiguous: {
    en: 'Several places are called “{query}”: use their number ({numbers}).',
    fr: 'Plusieurs lieux s’appellent « {query} » : utilisez leur numéro ({numbers}).',
    de: 'Mehrere Orte heißen „{query}“: Verwenden Sie ihre Nummer ({numbers}).',
    es: 'Varios lugares se llaman «{query}»: use su número ({numbers}).',
  },
  errorNotFound: {
    en: 'No added place “{query}”: see “List the places” (the houses are managed in Gladys).',
    fr: 'Aucun lieu ajouté « {query} » : voir « Lister les lieux » (les maisons se gèrent dans Gladys).',
    de: 'Kein hinzugefügter Ort „{query}“: siehe „Orte auflisten“ (die Häuser werden in Gladys verwaltet).',
    es: 'Ningún lugar añadido «{query}»: vea «Listar los lugares» (las casas se gestionan en Gladys).',
  },
  errorFull: {
    en: 'At most {max} added places.',
    fr: '{max} lieux ajoutés au maximum.',
    de: 'Höchstens {max} hinzugefügte Orte.',
    es: '{max} lugares añadidos como máximo.',
  },
  errorSave: {
    en: 'Gladys could not save the places: {message}',
    fr: 'Gladys n’a pas pu enregistrer les lieux : {message}',
    de: 'Gladys konnte die Orte nicht speichern: {message}',
    es: 'Gladys no pudo guardar los lugares: {message}',
  },
  errorBudget: {
    en: 'The {budget} requests of the month are used: next readings next month (or raise the budget in the configuration).',
    fr: 'Les {budget} requêtes du mois sont utilisées : prochaines mesures le mois prochain (ou augmentez le budget dans la configuration).',
    de: 'Die {budget} Anfragen des Monats sind verbraucht: nächste Messungen im nächsten Monat (oder erhöhen Sie das Budget in der Konfiguration).',
    es: 'Se han usado las {budget} solicitudes del mes: próximas medidas el mes que viene (o aumente el presupuesto en la configuración).',
  },
  errorQuota: {
    en: 'Google limits the requests of the key (429): the integration waits 15 minutes.',
    fr: 'Google limite les requêtes de la clé (429) : l’intégration attend 15 minutes.',
    de: 'Google begrenzt die Anfragen des Schlüssels (429): Die Integration wartet 15 Minuten.',
    es: 'Google limita las solicitudes de la clave (429): la integración espera 15 minutos.',
  },
  errorCoverage: {
    en: 'Google has no air quality data for this place (outside its coverage).',
    fr: 'Google n’a pas de données de qualité de l’air pour ce lieu (hors de sa couverture).',
    de: 'Google hat keine Luftqualitätsdaten für diesen Ort (außerhalb der Abdeckung).',
    es: 'Google no tiene datos de calidad del aire para este lugar (fuera de su cobertura).',
  },
  errorUnreachable: {
    en: 'Google Air Quality cannot be reached: {message}',
    fr: 'Google Air Quality est injoignable : {message}',
    de: 'Google Air Quality ist nicht erreichbar: {message}',
    es: 'No se puede acceder a Google Air Quality: {message}',
  },
  errorUnknownDevice: {
    en: 'This device is no longer a followed place of Google Air Quality.',
    fr: 'Cet appareil n’est plus un lieu suivi par Google Air Quality.',
    de: 'Dieses Gerät ist kein verfolgter Ort von Google Air Quality mehr.',
    es: 'Este dispositivo ya no es un lugar seguido por Google Air Quality.',
  },
  errorNoForecast: {
    en: 'Google gave no forecast for these hours.',
    fr: 'Google n’a donné aucune prévision pour ces heures.',
    de: 'Google hat für diese Stunden keine Vorhersage geliefert.',
    es: 'Google no ha dado ninguna previsión para estas horas.',
  },

  // configuration buttons
  added: {
    en: 'Added: {line}\nNow open the Discover tab to add its device.',
    fr: 'Ajouté : {line}\nOuvrez maintenant l’onglet Découverte pour ajouter son appareil.',
    de: 'Hinzugefügt: {line}\nÖffnen Sie jetzt den Tab Entdecken, um sein Gerät hinzuzufügen.',
    es: 'Añadido: {line}\nAbra ahora la pestaña Descubrir para añadir su dispositivo.',
  },
  removed: {
    en: '“{name}” is no longer followed. Its device stays in Gladys until you delete it.',
    fr: '« {name} » n’est plus suivi. Son appareil reste dans Gladys jusqu’à ce que vous le supprimiez.',
    de: '„{name}“ wird nicht mehr verfolgt. Sein Gerät bleibt in Gladys, bis Sie es löschen.',
    es: '«{name}» ya no se sigue. Su dispositivo permanece en Gladys hasta que lo elimine.',
  },
  listHeader: {
    en: '{count} place(s). A reading every {refresh} min, {forecast}. {usage}',
    fr: '{count} lieu(x). Une mesure toutes les {refresh} min, {forecast}. {usage}',
    de: '{count} Ort(e). Eine Messung alle {refresh} Min., {forecast}. {usage}',
    es: '{count} lugar(es). Una medida cada {refresh} min, {forecast}. {usage}',
  },
  listForecastEvery: {
    en: 'a forecast every {hours} h',
    fr: 'une prévision toutes les {hours} h',
    de: 'eine Vorhersage alle {hours} Std.',
    es: 'una previsión cada {hours} h',
  },
  listForecastOff: {
    en: 'no forecast',
    fr: 'pas de prévision',
    de: 'keine Vorhersage',
    es: 'sin previsión',
  },
  listHousesOff: {
    en: 'The houses of Gladys are not followed (see the configuration).',
    fr: 'Les maisons de Gladys ne sont pas suivies (voir la configuration).',
    de: 'Die Häuser von Gladys werden nicht verfolgt (siehe Konfiguration).',
    es: 'Las casas de Gladys no se siguen (vea la configuración).',
  },
  listHousesError: {
    en: 'The houses of Gladys cannot be read: {message}',
    fr: 'Les maisons de Gladys ne peuvent pas être lues : {message}',
    de: 'Die Häuser von Gladys können nicht gelesen werden: {message}',
    es: 'No se pueden leer las casas de Gladys: {message}',
  },
  listNoHouse: {
    en: 'No house of Gladys has a location (Settings → Houses).',
    fr: 'Aucune maison de Gladys n’a d’emplacement (Paramètres → Maisons).',
    de: 'Kein Haus in Gladys hat einen Standort (Einstellungen → Häuser).',
    es: 'Ninguna casa de Gladys tiene ubicación (Ajustes → Casas).',
  },
  listEmpty: {
    en: 'No place yet.',
    fr: 'Aucun lieu pour l’instant.',
    de: 'Noch kein Ort.',
    es: 'Aún no hay ningún lugar.',
  },
  listLine: {
    en: '{number}{name} ({kind}) — {last}',
    fr: '{number}{name} ({kind}) — {last}',
    de: '{number}{name} ({kind}) — {last}',
    es: '{number}{name} ({kind}) — {last}',
  },
  listError: {
    en: ' Last error: {message}',
    fr: ' Dernière erreur : {message}',
    de: ' Letzter Fehler: {message}',
    es: ' Último error: {message}',
  },
  testOk: {
    en: 'The key works. {summary} ({used} request(s) this month.)',
    fr: 'La clé fonctionne. {summary} ({used} requête(s) ce mois-ci.)',
    de: 'Der Schlüssel funktioniert. {summary} ({used} Anfrage(n) diesen Monat.)',
    es: 'La clave funciona. {summary} ({used} solicitud(es) este mes.)',
  },

  // relative times
  justNow: { en: 'just now', fr: 'à l’instant', de: 'gerade eben', es: 'ahora mismo' },
  minutesAgo: {
    en: '{n} min ago',
    fr: 'il y a {n} min',
    de: 'vor {n} Min.',
    es: 'hace {n} min',
  },
  hoursAgo: { en: '{n} h ago', fr: 'il y a {n} h', de: 'vor {n} Std.', es: 'hace {n} h' },
  daysAgo: { en: '{n} d ago', fr: 'il y a {n} j', de: 'vor {n} T.', es: 'hace {n} d' },
  never: { en: 'never', fr: 'jamais', de: 'nie', es: 'nunca' },

  // widgets
  widgetNoKey: {
    en: 'Type your Google Maps Platform API key in the configuration of the integration.',
    fr: 'Saisissez votre clé d’API Google Maps Platform dans la configuration de l’intégration.',
    de: 'Geben Sie Ihren Google-Maps-Platform-API-Schlüssel in der Konfiguration der Integration ein.',
    es: 'Escriba su clave de API de Google Maps Platform en la configuración de la integración.',
  },
  widgetChoosePlace: {
    en: 'Choose a place in the settings of the widget (the places added as devices).',
    fr: 'Choisissez un lieu dans les réglages du widget (parmi les lieux ajoutés comme appareils).',
    de: 'Wählen Sie einen Ort in den Einstellungen des Widgets (unter den als Geräte hinzugefügten Orten).',
    es: 'Elija un lugar en los ajustes del widget (entre los lugares añadidos como dispositivos).',
  },
  widgetUnknownPlace: {
    en: 'This place is no longer followed: choose another one in the settings of the widget.',
    fr: 'Ce lieu n’est plus suivi : choisissez-en un autre dans les réglages du widget.',
    de: 'Dieser Ort wird nicht mehr verfolgt: Wählen Sie einen anderen in den Einstellungen des Widgets.',
    es: 'Este lugar ya no se sigue: elija otro en los ajustes del widget.',
  },
  widgetNoReading: {
    en: '{name}: no reading yet, the first one comes within a minute.',
    fr: '{name} : pas encore de mesure, la première arrive dans la minute.',
    de: '{name}: noch keine Messung, die erste kommt innerhalb einer Minute.',
    es: '{name}: aún no hay medida, la primera llega en menos de un minuto.',
  },
  widgetError: {
    en: '{name}: no reading. {message}',
    fr: '{name} : aucune mesure. {message}',
    de: '{name}: keine Messung. {message}',
    es: '{name}: ninguna medida. {message}',
  },
  widgetForecastOff: {
    en: 'The forecast is off: set “Forecast every (hours)” in the configuration.',
    fr: 'La prévision est désactivée : réglez « Prévision toutes les (heures) » dans la configuration.',
    de: 'Die Vorhersage ist aus: Stellen Sie „Vorhersage alle (Stunden)“ in der Konfiguration ein.',
    es: 'La previsión está desactivada: ajuste «Previsión cada (horas)» en la configuración.',
  },
  widgetNoForecast: {
    en: '{name}: no forecast yet.',
    fr: '{name} : pas encore de prévision.',
    de: '{name}: noch keine Vorhersage.',
    es: '{name}: aún no hay previsión.',
  },
  tileUaqi: {
    en: 'Universal AQI',
    fr: 'Indice universel',
    de: 'Index (UAQI)',
    es: 'Índice universal',
  },
  statusCategory: {
    en: 'Air quality',
    fr: 'Qualité de l’air',
    de: 'Luftqualität',
    es: 'Calidad del aire',
  },
  statusDominant: {
    en: 'Dominant pollutant',
    fr: 'Polluant majoritaire',
    de: 'Hauptschadstoff',
    es: 'Contaminante principal',
  },
  statusUpdated: { en: 'Updated', fr: 'Mis à jour', de: 'Aktualisiert', es: 'Actualizado' },
  chartTitle: {
    en: 'Universal AQI, next 48 h',
    fr: 'Indice universel, 48 h à venir',
    de: 'Universeller Index, nächste 48 Std.',
    es: 'Índice universal, próximas 48 h',
  },
  annotationWorst: { en: 'Worst', fr: 'Le pire', de: 'Tiefstwert', es: 'Peor' },
  statusWorst: {
    en: 'Worst (24 h)',
    fr: 'Le pire (24 h)',
    de: 'Tiefstwert (24 Std.)',
    es: 'Peor (24 h)',
  },
  statusForecastUpdated: {
    en: 'Forecast updated',
    fr: 'Prévision mise à jour',
    de: 'Vorhersage aktualisiert',
    es: 'Previsión actualizada',
  },
  budgetCaption: {
    en: 'Budget: {percent} % of the 10,000 free requests',
    fr: 'Budget : {percent} % des 10 000 requêtes gratuites',
    de: 'Budget: {percent} % der 10.000 Gratis-Anfragen',
    es: 'Presupuesto: {percent} % de las 10 000 solicitudes gratuitas',
  },
  gaugeLabel: {
    en: 'Requests / {budget}',
    fr: 'Requêtes / {budget}',
    de: 'Anfragen / {budget}',
    es: 'Solicitudes / {budget}',
  },
  budgetPlannedLabel: { en: 'Planned', fr: 'Prévu', de: 'Geplant', es: 'Previsto' },
  budgetPlanned: {
    en: '≈ {count} a month, {places} place(s)',
    fr: '≈ {count} par mois, {places} lieu(x)',
    de: '≈ {count} pro Monat, {places} Ort(e)',
    es: '≈ {count} al mes, {places} lugar(es)',
  },
  budgetKey: { en: 'API key', fr: 'Clé d’API', de: 'API-Schlüssel', es: 'Clave de API' },
  budgetKeyOk: { en: 'Accepted', fr: 'Acceptée', de: 'Akzeptiert', es: 'Aceptada' },
  budgetKeyUnknown: {
    en: 'Not used yet',
    fr: 'Pas encore utilisée',
    de: 'Noch nicht verwendet',
    es: 'Aún sin usar',
  },
  budgetKeyRefused: { en: 'Refused', fr: 'Refusée', de: 'Abgelehnt', es: 'Rechazada' },
  budgetKeyMissing: { en: 'Missing', fr: 'Manquante', de: 'Fehlt', es: 'Falta' },
  budgetPaused: {
    en: 'Paused (429)',
    fr: 'En pause (429)',
    de: 'Pausiert (429)',
    es: 'En pausa (429)',
  },
};

/**
 * @description Whether a value is one of the languages of the integration.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language (English fallback), with its
 * substitutions.
 * @param {string} key - The TEXTS key.
 * @param {string} language - The language.
 * @param {object} [values] - The substitutions.
 * @returns {string} The text.
 * @example
 * t('minutesAgo', 'fr', { n: 3 }); // -> 'il y a 3 min'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[language] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

/**
 * @description The text in every language, for a multi-language message.
 * @param {string|Function} key - The TEXTS key, or `(language) => string`.
 * @param {object} [values] - The substitutions.
 * @returns {{ en: string, fr: string, de: string, es: string }} The message.
 * @example
 * all('statusEmpty');
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      typeof key === 'function' ? key(language) : t(key, language, values),
    ]),
  );
}

const locale = (language) => (isLanguage(language) ? language : 'en');

/**
 * @description A number written in a language ("4 500", "4,500", "12,5").
 * @param {number} n - The number.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
const formatNumber = (n, language) =>
  new Intl.NumberFormat(locale(language), { maximumFractionDigits: 1 }).format(n);

/**
 * @description How long ago an instant was: "just now", "12 min ago", "3 h ago".
 * @param {number} at - The instant, in ms (0: never).
 * @param {number} now - Now, in ms.
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function ago(at, now, language) {
  if (!at) return t('never', language);
  const minutes = Math.floor((now - at) / 60000);
  if (minutes < 1) return t('justNow', language);
  if (minutes < 60) return t('minutesAgo', language, { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('hoursAgo', language, { n: hours });
  return t('daysAgo', language, { n: Math.floor(hours / 24) });
}

/**
 * @description The month of an instant, as a title: "October 2026".
 * @param {string} month - "YYYY-MM".
 * @param {string} language - The language.
 * @returns {string} The text.
 */
function formatMonth(month, language) {
  const [year, number] = month.split('-').map(Number);
  const text = new Intl.DateTimeFormat(locale(language), {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, number - 1, 1)));
  return text.charAt(0).toLocaleUpperCase(locale(language)) + text.slice(1);
}

export { LANGUAGES, TEXTS, isLanguage, t, all, formatNumber, ago, formatMonth };
