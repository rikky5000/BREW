# Waltherson Brewing – Brewing Management System

Bryggprogram anpassat för **BrewZilla 65L Gen 4.1**. Byggt mobilen först, som en installerbar webbapp (PWA) som fungerar offline. All data sparas lokalt i telefonen.

## Funktioner (version 1)
- **Startsida** med moduler
- **Recept** – malt, humle och jäst med OG, FG, ABV, IBU (Tinseth), färg (EBC) och BU:GU, jämfört med BJCP-stilens intervall. Ett recept kan överföras till Vatten & Kemi
- **Import** – BeerXML (.xml), BeerJSON (.json), Brewfather JSON och Brewfather-PDF. Förhandsvisning med jämförelse mot filens OG/FG/IBU/färg och valfri anpassning av verkningsgraden
- **Bryggdag** – steg-för-steg-checklista från receptet (salter, syra, volymer, insläppstemperatur, uppvärmningstid), timrar för mäskning, kok och whirlpool med humlelarm, mätningar och verkningsgrad. Avslutade bryggdagar sparas för kommande batchhistorik
- **Verktyg** – mät verkningsgrad med historik och medelvärde
- **Vattenkalkylator** – mäsk- och lakvatten, volym före/efter kok, insläppstemperatur, varningar om maltröret eller kärlet blir för fullt
- **Vattenkemi** – råvatten (Katrineholm förinlagt), målprofiler per ölstil, salttillsatser (CaCl₂ 33 %, gips, Epsomsalt, NaCl) för mäsk- och lakvatten, uppskattat mäsk-pH och mjölksyra 80 %
- **Utrustningsprofil** – steglös max elementeffekt 0–3500 W och standardvärden för BrewZilla 65L Gen 4.1 som du justerar efter egna mätningar

## Planerat
mäskschema för RAPT (6 steg), jäsningslogg med graf, batchhistorik, kolsyrekalkylator, lager, verktyg, RAPT-koppling.

## Köra lokalt
Appen är ren HTML/CSS/JS utan byggsteg. Starta en webbserver i mappen:

```bash
python -m http.server 8000
```

Öppna sedan http://localhost:8000.

## Installera på mobilen
Publicera med GitHub Pages (Settings → Pages → Deploy from branch). Öppna sidan i mobilen och välj **Lägg till på hemskärmen**.

## Tredjepartskod
`vendor/pdfjs/` – [pdf.js](https://github.com/mozilla/pdf.js) 3.11.174 (Apache 2.0), används för att läsa PDF-recept.
