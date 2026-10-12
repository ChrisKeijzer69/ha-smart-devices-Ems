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

## Scherm voor een Google Nest Hub

Een volledig scherm van 1024 × 600 voor een Nest Hub, met twee weergaven:

- **ringen**: in de stijl van het HomeWizard Energy Display. Een grote ring met het net nu en wat je
  vandaag hebt teruggeleverd (↑) en afgenomen (↓), ringen voor de accustand en de zon, en
  rechts de stroomprijs (het bolletje staat tussen de laagste en hoogste prijs van vandaag), de
  besparing van vandaag en je auto (of boiler, of de zon vandaag);
  met een HomeWizard gas- of watermeter staan gas en water er apart rechts naast, met een
  ring die vol is bij je gemiddelde dag van de afgelopen vier weken;
- **huis**: de huistekening met ernaast wat de AI doet, waar de stroom vandaan komt en de prijs.

Een gecast dashboard reageert niet op aanraken, dus dit is een kijkscherm zonder knoppen. Op
een groter scherm (Hub Max, tablet) schaalt het mee.

**1. Dashboard maken.** *Instellingen → Dashboards → Dashboard toevoegen* → *Nieuw dashboard
vanaf nul*, naam bijvoorbeeld *EMS Hub* (adres `ems-hub`). Open het, kies *Bewerken* →
*Raw-configuratie-editor* en plak:

```yaml
views:
  - title: Ringen
    path: ringen
    type: panel
    cards:
      - type: custom:smart-devices-ems-hub
        weergave: ringen
  - title: Huis
    path: huis
    type: panel
    cards:
      - type: custom:smart-devices-ems-hub
        weergave: huis
```

Gebruik altijd `type: panel`: dan vult de kaart het hele scherm. Instellingen van de kaart:

- `weergave`: `ringen` (standaard) of `huis`;
- `thema`: `donker` (standaard), `licht`, of `ha` voor de kleuren van je Home Assistant-thema;
- `net_max_w` en `zon_max_w`: bij hoeveel watt de ring van het net en van de zon vol is
  (standaard 6000 en 5000 W; zet de zon op het piekvermogen van je panelen);
- `beweging: false` om de stroombolletjes in het huis stil te zetten (rustiger, en zuiniger
  voor de processor van de Hub);
- `apparaat:` alleen bij meer dan één gekoppelde installatie.

**2. Op de Hub zetten.** Home Assistant moet via **https van buiten** bereikbaar zijn (Nabu
Casa of een eigen domein, ingevuld onder *Instellingen → Systeem → Netwerk*): de Hub haalt het
dashboard via Google op. De Nest Hub verschijnt via de integratie *Google Cast* als
`media_player`. Starten doe je met de actie `cast.show_lovelace_view`:

```yaml
action: cast.show_lovelace_view
data:
  entity_id: media_player.nest_hub      # de naam van jouw Hub
  dashboard_path: ems-hub
  view_path: ringen                     # of: huis
```

De Hub stopt een cast na een tijdje vanzelf. Een automatisering die hem opnieuw start zodra de
Hub niets doet, houdt het scherm aan zonder je muziek te onderbreken:

```yaml
alias: EMS op de Nest Hub
triggers:
  - trigger: time_pattern
    minutes: /5
conditions:
  - condition: state
    entity_id: media_player.nest_hub
    state: ["off", "idle"]
  - condition: time
    after: "07:00:00"
    before: "23:00:00"
actions:
  - action: cast.show_lovelace_view
    data:
      entity_id: media_player.nest_hub
      dashboard_path: ems-hub
      view_path: ringen
```

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
| Gas en water | vandaag (m³ / liter) en gemiddelde dag over vier weken; alleen met een HomeWizard P1- of watermeter |
| Overig | besparing vandaag (€), slimme sturing aan, gegevens verouderd, leeftijd gegevens |

**Energy-dashboard:** gebruik *Netafname vandaag*, *Teruglevering vandaag*, *Zon vandaag*,
*Accu geladen vandaag* en *Accu ontladen vandaag*. Gebruik *Stroomprijs nu* als prijs. Voor gas en
water: *Gas vandaag* en *Water vandaag*.

De gegevens worden elke 30 seconden opgehaald.

## English

Read-only integration for the Smart Devices EMS portal. Create a key in the portal under
*Settings → Connect devices*, add the integration and paste the key.
