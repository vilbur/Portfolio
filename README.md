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
- spusti test popisu a odkazu slozek,
- sestavi cisty publikacni balicek bez testu, zaloh a pracovnich souboru,
- po publikaci porovna hash ziveho HTML i obou katalogu assetu s odeslanymi soubory a overi pravidla cache,
- publikuje pouze Firebase Hosting.

Pri prvnim pouziti se otevre jednorazove prihlaseni ke Google uctu. Deployer pouzije bezny Firebase nastroj, pokud je nainstalovany, nebo lokalni behove prostredi dodane s Codexem. Samotna publikace AI nepouziva. Dalsi publikace jsou jeden dvojklik.

## Jak se obsah preklada do webu

Priklad:

`Images/realtime-visualization/gallery/01-gallery-exterior.jpg`

- prvni slozka = hlavni galerie (`Realtime Visualization`),
- druha slozka = projekt nebo podgalerie (`Gallery`),
- nazev souboru a cislo na zacatku = pouze poradi; na webu se nezobrazuji.

Viditelny titulek a popis obrazku se nacitaji vyhradne z vlozenych JPG metadata. Pole Title/Document Name se pouzije jako titulek a Comment/User Comment/Image Description jako popis. Metadata obrazku se zobrazuji pouze po otevreni obrazku v detailu; pod nahledy na hlavni strance nejsou zadne popisky. Pokud metadata chybi, nezobrazi se zadny titulek ani popis.

Vzhled konkretniho JPG nahledu lze zmenit v poli IPTC Special Instructions. `thumbnail=contain` zobrazi cely obrazek bez orezu, zatimco vychozi `cover` nahled vyplni a muze jej oriznout. Podporovane jsou take `thumbnail=top`, `thumbnail=center` a `thumbnail=bottom`; vsechny pouzivaji `cover` a meni svisle zarovnani. Nezname instrukce se ignoruji a dalsi hodnoty mohou byt ve stejnem poli oddelene mezerou, carkou nebo strednikem.

Razeni je abecedni. Pro pevne poradi pouzij prefixy `01-`, `02-`, `03-`.

Podporovane formaty galerie: JPG, JPEG, PNG, GIF, BMP, WEBP, AVIF, MP4 a WEBM. Videa se prehravaji automaticky bez zvuku; v nahledu pres celou obrazovku maji ovladani.

Na mobilu otocenem na sirku otevre dvojite klepnuti na obrazek nativni celoobrazovkovou prezentaci. Pokud ji prohlizec nepodporuje, pouzije se stejny rezim pres cely dostupny viewport; dalsi dvojite klepnuti ovlada priblizeni.

## Popis a odkaz slozky

Pro dvojjazycny textovy popis galerie vloz primo do jeji slozky soubory `content.en.md` (anglicky) a `content.cs.md` (cesky). Web zobrazi variantu podle zvoleneho jazyka. Starsi soubor `content.md` zustava podporovany jako zalozni text pro oba jazyky; lokalizovane soubory maji prednost. Jako cesky alias je podporovan take nazev `content.cz.md`, ale doporuceny je standardni kod `cs`.

Popis se zobrazi na hlavni portfolio strance primo pod nazvem odpovidajici kategorie nebo podgalerie. Podporovane jsou odstavce, nadpisy, tucny a kurzivni text, odkazy a cislovane i necislovane seznamy. HTML zapsane primo v Markdownu se nevykonava.

Externi odkaz lze pridat libovolnym Windows `.url` souborem ve stejne slozce. Pouzije se hodnota `URL=` a pouze platna adresa zacinajici `https://` nebo `http://`. Neplatny nebo prazdny odkaz se na webu nezobrazi.

Obrazky v hlavnim hornim karuselu patri do `Web/assets/header-carousel`. Titulek a popis se i zde zobrazi pouze tehdy, kdyz jsou vlozene v metadata obrazku.

Portret pro sekci About patri do `Portfolio/About`. Pri nahledu i publikaci se automaticky zkopiruje do webu a dostane novou verzi adresy, aby se po vymene nezobrazovala stara fotografie z cache.

`Web/assets/library`, `Web/.deploy` a soubory `Web/scripts/image-catalog.js` a `Web/scripts/header-carousel.js` jsou generovane. Neupravuji se rucne. Slozka `.deploy` obsahuje pouze aktualni soubory, ktere se skutecne odeslou na Firebase.

## Bezpecnost publikace

Produkce se neaktualizuje pri kazdem ulozeni souboru. To by mohlo zverejnit galerii behem kopirovani vice obrazku. Synchronizace je automaticka, ale posledni krok zustava vedomy dvojklik na `PUBLISH-WEB.cmd`.

Pro prubezne lokalni generovani lze spustit `tools/watch-content.ps1`; sleduje zmeny, ale nikdy nic nepublikuje.
