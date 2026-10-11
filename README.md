# Smart Devices EMS voor Home Assistant

Haalt de gegevens van je Smart Devices EMS in Home Assistant: vermogens, accustand, stroomprijzen,
wat de AI nu en straks doet, en de energietellers van vandaag. Je kunt alle sensoren gebruiken in
je eigen automatiseringen en in het Energy-dashboard.

De integratie **leest alleen**. Ze stuurt niets naar je installatie.

## Installeren

1. In HACS: *Integraties* → menu rechtsboven → *Aangepaste repositories* → voeg
   `https://github.com/ChrisKeijzer69/ha-smart-devices-ems` toe als *Integratie*.
2. Installeer **Smart Devices EMS** en herstart Home Assistant.
3. Maak in de portal een sleutel aan: *Instellingen* → *Apparaten koppelen*.
4. In Home Assistant: *Instellingen* → *Apparaten en diensten* → *Integratie toevoegen* →
   **Smart Devices EMS**, en plak de sleutel.

Trek je de sleutel in de portal in, dan vraagt Home Assistant vanzelf om een nieuwe.

## Kaart "Nu in huis"

De integratie brengt de huistekening uit de portal mee als dashboardkaart: het huis met de stroom
van zon, accu, net, auto en boiler. Je hoeft niets extra te installeren.

Dashboard bewerken → *Kaart toevoegen* → zoek **Smart Devices EMS: nu in huis**. Of in YAML:

```yaml
type: custom:smart-devices-ems-huis
titel: Nu in huis
```

Extra instellingen, alleen als je ze nodig hebt:

- `zon: false` als je geen zonnepanelen hebt;
- `apparaat:` met het apparaat-id, alleen bij meer dan één gekoppelde installatie (kies hem
  liever in de visuele editor).

De integratie zet de kaart zelf bij je dashboardbronnen (*Instellingen → Dashboards → Bronnen*).
Had je hem daar al met de hand toegevoegd, dan neemt ze die over. Zie je na een update toch
"Custom element doesn't exist"? Herstart Home Assistant en ververs de pagina (in de app:
*Instellingen → Companion-app → Debuggen → Frontend-cache wissen*). Gebruik je dashboards in
YAML-modus, voeg de kaart dan zelf toe onder `lovelace: resources:` met URL
`/smart_devices_ems/smart-devices-ems-huis.js` en type `module`.

## Sensoren

| Groep | Sensoren |
|---|---|
| Vermogen (W) | zon, net (+ afname / − teruglevering), accu (+ laden / − ontladen), huis, auto, boiler |
| Accu | stand (%) |
| Auto | stand (%), laadpaalstatus (alleen met laadpaal) |
| Boiler | watertemperatuur (alleen met boiler) |
| Prijs (€/kWh) | nu, terugleveren nu, over een uur, laagste en hoogste van vandaag (met tijdstip) |
| AI | wat hij nu doet (tekst en actie), wat hij straks doet en vanaf wanneer |
| Vandaag (kWh) | zon, netafname, teruglevering, accu geladen, accu ontladen, huis, auto, boiler |
| Overig | besparing vandaag (€), slimme sturing aan, gegevens verouderd, leeftijd gegevens |

**Energy-dashboard:** gebruik *Netafname vandaag*, *Teruglevering vandaag*, *Zon vandaag*,
*Accu geladen vandaag* en *Accu ontladen vandaag*. Gebruik *Stroomprijs nu* als prijs.

De gegevens worden elke 30 seconden opgehaald.

## English

Read-only integration for the Smart Devices EMS portal. Create a key in the portal under
*Settings → Connect devices*, add the integration and paste the key.
