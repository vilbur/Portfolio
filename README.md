# Portfolio: obsah a publikovani bez AI

Web je rizeny soubory. Bez databaze, redakcniho systemu a bez AI.

## Bezny postup

1. Vloz, prejmenuj nebo smaz obrazky a videa ve slozce `Portfolio/Images`.
2. Dvojklikem spust `Web/PREVIEW-WEB.cmd` a zkontroluj vysledek v prohlizeci.
3. Dvojklikem spust `Web/PUBLISH-WEB.cmd`.

Publikacni akce sama:

- zkopiruje nove a zmenene soubory,
- prevede BMP na JPG,
- odstrani z webove kopie soubory, ktere uz ve zdrojich nejsou,
- vytvori katalog galerii, projektu, titulku a typu media,
- prida nove verze adres, aby prohlizec neukazoval stary obsah,
- pred odeslanim zkontroluje, ze zadny soubor nechybi,
- publikuje pouze Firebase Hosting.

Pri prvnim pouziti se automaticky stahne oficialni Firebase nastroj pro Windows a otevre se jednorazove prihlaseni ke Google uctu. Dalsi publikace jsou jeden dvojklik.

## Jak se obsah preklada do webu

Priklad:

`Images/realtime-visualization/gallery/01-gallery-exterior.jpg`

- prvni slozka = hlavni galerie (`Realtime Visualization`),
- druha slozka = projekt nebo podgalerie (`Gallery`),
- nazev souboru = viditelny popisek (`Gallery Exterior`),
- cislo na zacatku = poradi; v popisku se nezobrazi.

Razeni je abecedni. Pro pevne poradi pouzij prefixy `01-`, `02-`, `03-`.

Podporovane formaty galerie: JPG, JPEG, PNG, GIF, BMP, WEBP, AVIF, MP4 a WEBM. Videa se prehravaji automaticky bez zvuku; v nahledu pres celou obrazovku maji ovladani.

## Popis a odkaz slozky

Pro textovy popis kategorie nebo podgalerie vloz primo do jeji slozky soubor `README.md`. Podporovane jsou odstavce, nadpisy, tucny a kurzivni text, odkazy a cislovane i necislovane seznamy. HTML zapsane primo v Markdownu se nevykonava.

Externi odkaz lze pridat libovolnym Windows `.url` souborem ve stejne slozce. Pouzije se hodnota `URL=` a pouze platna adresa zacinajici `https://` nebo `http://`. Neplatny nebo prazdny odkaz se na webu nezobrazi.

Obrazky v hlavnim hornim karuselu patri do `Web/assets/header-carousel`. Jejich nazev souboru se stejne prevede na titulek.

`Web/assets/library` a soubory `Web/scripts/image-catalog.js` a `Web/scripts/header-carousel.js` jsou generovane. Neupravuji se rucne.

## Bezpecnost publikace

Produkce se neaktualizuje pri kazdem ulozeni souboru. To by mohlo zverejnit galerii behem kopirovani vice obrazku. Synchronizace je automaticka, ale posledni krok zustava vedomy dvojklik na `PUBLISH-WEB.cmd`.

Pro prubezne lokalni generovani lze spustit `tools/watch-content.ps1`; sleduje zmeny, ale nikdy nic nepublikuje.
