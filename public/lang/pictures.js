/* Picture vocabulary. Photos come from Wikimedia Commons, are stored in public/photos, and show credit to each author.
   [category, english, spanish, Brazil, Portugal or "", French, file, license, author, Italian] */
const PICTURE_RAW = [
["animals","dog","el perro","o cachorro","o cão","le chien","Portrait of a golden retriever on the grass.jpg","CC BY 2.0","Shixart1985","il cane"],
["animals","cat","el gato","o gato","","le chat","Orange tabby cat sitting on fallen leaves-Hisashi-01.jpg","CC BY-SA 2.0","Hisashi from Japan","il gatto"],
["animals","horse","el caballo","o cavalo","","le cheval","Nokota_Horses_cropped.jpg","CC BY-SA 3.0","François Marchal, Dana boomer","il cavallo"],
["animals","cow","la vaca","a vaca","","la vache","Cow_(Fleckvieh_breed)_Oeschinensee_Slaunger_2009-07-07.jpg","CC BY-SA 3.0","Kim Hansen","la mucca"],
["animals","pig","el cerdo","o porco","","le cochon","Pig_farm_Vampula_1.jpg","CC BY-SA 4.0","kallerna","il maiale"],
["animals","chicken","la gallina","a galinha","","la poule","Male_and_female_chicken_sitting_together.jpg","CC BY-SA 2.0","Andrei Niemimäki","la gallina"],
["animals","sheep","la oveja","a ovelha","","le mouton","Flock_of_sheep.jpg","Public domain","Keith Weller","la pecora"],
["animals","fish","el pez","o peixe","","le poisson","Gold_fish1.jpg","CC BY-SA 3.0","לינה אבוגוש","il pesce"],
["animals","bird","el pájaro","o pássaro","","l'oiseau","Kleiber_Flug.jpg","CC BY-SA 3.0","C. Robiller / naturlichter.de","l'uccello"],
["animals","duck","el pato","o pato","","le canard","Anas_platyrhynchos_male_female_quadrat.jpg","CC BY-SA 2.5","Richard Bartz","l'anatra"],
["animals","rabbit","el conejo","o coelho","","le lapin","Oryctolagus_cuniculus_Rcdo.jpg","CC BY 3.0","JM Ligero Loarte","il coniglio"],
["animals","mouse","el ratón","o rato","","la souris","Mouse_white_background.jpg","Public domain","Unknown author","il topo"],
["animals","bear","el oso","o urso","","l'ours","2010-kodiak-bear-1.jpg","CC BY-SA 3.0","Yathin S Krishnappa","l'orso"],
["animals","lion","el león","o leão","","le lion","020_The_lion_king_Snyggve_in_the_Serengeti_National_Park_Photo_by_Giles_Laurent.jpg","CC BY-SA 4.0","Giles Laurent","il leone"],
["animals","elephant","el elefante","o elefante","","l'éléphant","178_Male_African_bush_elephant_in_Etosha_National_Park_Photo_by_Giles_Laurent.jpg","CC BY-SA 4.0","Giles Laurent","l'elefante"],
["animals","monkey","el mono","o macaco","","le singe","Ubud_Monkey_Family.jpg","CC BY-SA 4.0","Deerpeter","la scimmia"],
["animals","butterfly","la mariposa","a borboleta","","le papillon","Monarch_Butterfly_Danaus_plexippus_Male_2664px.jpg","GFDL 1.2","Derek Ramsey","la farfalla"],
["animals","bee","la abeja","a abelha","","l'abeille","Apis_mellifera_Western_honey_bee.jpg","CC BY-SA 2.5","Andreas Trepte","l'ape"],
["food","bread","el pan","o pão","","le pain","Korb_mit_Brötchen.JPG","CC BY-SA 3.0","3268zauber","il pane"],
["food","cheese","el queso","o queijo","","le fromage","Cheese_platter.jpg","CC BY-SA 3.0","Wikimedia Commons contributor","il formaggio"],
["food","egg","el huevo","o ovo","","l'œuf","Huevo_frito.jpg","CC BY-SA 4.0","Horacio Cambeiro","l'uovo"],
["food","apple","la manzana","a maçã","","la pomme","Pink_lady_and_cross_section.jpg","GFDL 1.2","fir0002 flagstaffotos","la mela"],
["food","orange","la naranja","a laranja","","l'orange","Oranges_-_whole-halved-segment.jpg","CC BY-SA 4.0","Ivar Leidus","l'arancia"],
["food","banana","el plátano","a banana","","la banane","Bananavarieties.jpg","CC BY-SA 3.0","TimothyPilgrim","la banana"],
["food","tomato","el tomate","o tomate","","la tomate","Tomato_je.jpg","CC BY-SA 3.0","Softeis","il pomodoro"],
["food","potato","la papa","a batata","","la pomme de terre","Patates.jpg","Public domain","Scott Bauer, USDA ARS","la patata"],
["food","rice","el arroz","o arroz","","le riz","A bowl of rice.jpg","CC0","Douglas Perkins","il riso"],
["food","coffee","el café","o café","","le café","Latte_and_dark_coffee.jpg","CC BY 2.0","Bex Walton","il caffè"],
["food","wine","el vino","o vinho","","le vin","Red_and_white_wine_in_glass.jpg","CC BY-SA 2.5","André Karwath","il vino"],
["food","custard tart","la tarta de crema","o pastel de nata","","le pastel de nata","Pasteis_de_Belem.jpg","CC BY 2.0","Mon Œil","il pastel de nata"],
["food","croissant","el cruasán","o croissant","","le croissant","Croissant-Petr_Kratochvil.jpg","CC0","Petr Kratochvil","il cornetto"],
["food","olive","la aceituna","a azeitona","","l'olive","Olivesfromjordan.jpg","CC BY-SA 3.0","Nickfraser","l'oliva"],
["food","shrimp","la gamba","o camarão","","la crevette","Palaemon_serratus_Croazia.jpg","Public domain","Etrusko25","il gambero"],
["food","grapes","las uvas","as uvas","","le raisin","Grapes,_Rostov-on-Don,_Russia.jpg","CC BY 4.0","Vyacheslav Argenberg","l'uva"],
["nature","mountain","la montaña","a montanha","","la montagne","Everest_North_Face_toward_Base_Camp_Tibet_Luca_Galuzzi_2006.jpg","CC BY-SA 2.5","Luca Galuzzi","la montagna"],
["nature","river","el río","o rio","","la rivière","Pirogue_running_on_the_Mekong_at_golden_hour_between_Don_Det_and_Don_Khon_Laos.jpg","CC BY-SA 4.0","Basile Morin","il fiume"],
["nature","beach","la playa","a praia","","la plage","Beach_at_Fort_Lauderdale.jpg","CC BY 2.0","Daniel Dudek","la spiaggia"],
["nature","forest","el bosque","a floresta","","la forêt","Aerial_view_of_the_Amazon_Rainforest.jpg","CC BY-SA 2.0","lubasi","la foresta"],
["nature","lake","el lago","o lago","","le lac","Lake_Idro_Italy_2005-08-16.jpg","CC BY-SA 3.0","Marius","il lago"],
["nature","waterfall","la cascada","a cachoeira","a cascata","la cascade","Cascada_Dynjandi,_Vestfirðir,_Islandia,_2014-08-14,_DD_136-138_HDR.JPG","CC BY-SA 4.0","Diego Delso","la cascata"],
["nature","desert","el desierto","o deserto","","le désert","Rub_al_Khali_002.JPG","CC BY-SA 3.0","Nepenthes","il deserto"],
["nature","island","la isla","a ilha","","l'île","Ao Nang, Thailand (Unsplash).jpg","CC0","Denys Nevozhai","l'isola"],
["nature","snow","la nieve","a neve","","la neige","Snow Scene at Shipka Pass 1.JPG","CC BY-SA 3.0","Psy guy","la neve"],
["nature","rain","la lluvia","a chuva","","la pluie","Darjeeling drizzling.jpg","CC BY 3.0","Appucoool","la pioggia"],
["nature","cloud","la nube","a nuvem","","le nuage","Clouds in the sky in August 2014.JPG","CC BY-SA 4.0","Jakec","la nuvola"],
["nature","bridge","el puente","a ponte","","le pont","Bridge_Alcantara.JPG","GFDL","Dantla","il ponte"],
["nature","sunset","la puesta de sol","o pôr do sol","","le coucher de soleil","Full_cycle_of_a_Sunset_on_the_high_plains_of_the_Mojave_Desert.jpg","CC BY-SA 3.0","Jessie Eastland","il tramonto"],
["nature","field","el campo","o campo","","le champ","Iglesia_de_Nuestra_Señora_de_La_Blanca,_Cardejón,_España,_2012-09-01,_DD_02.JPG","CC BY-SA 3.0","Diego Delso","il campo"],
["nature","volcano","el volcán","o vulcão","","le volcan","Augustine_volcano_Jan_24_2006_-_Cyrus_Read.jpg","Public domain","Cyrus Read, USGS","il vulcano"],
["nature","cave","la cueva","a caverna","a gruta","la grotte","Lechuguilla_Cave_Pearlsian_Gulf.jpg","CC BY-SA 2.5","Dave Bunnell","la grotta"],
["stores","bakery","la panadería","a padaria","","la boulangerie","HK 堅尼地城 Kennedy Town 寶翠園 Belcher's Westwood mall shop Panash Bakery and Café November 2021 SS2 02.jpg","CC BY-SA 4.0","Leichiem Shauz BULKO","il panificio"],
["stores","pharmacy","la farmacia","a farmácia","","la pharmacie","Duane Reade Pharmacy Storefront (48206542307).jpg","CC BY 2.0","Ajay Suresh","la farmacia"],
["stores","supermarket","el supermercado","o supermercado","","le supermarché","Stop&Shop.jpg","CC BY-SA 4.0","NYC Guru","il supermercato"],
["stores","butcher shop","la carnicería","o açougue","o talho","la boucherie","Wiki_Loves_Mett_P1020898.JPG","CC BY 3.0 de","Fridolin Freudenfett","la macelleria"],
["stores","fish market","la pescadería","a peixaria","","la poissonnerie","PikePlaceMarket2006.jpg","CC BY-SA 3.0","Epukas","la pescheria"],
["stores","bookstore","la librería","a livraria","","la librairie","Libraria_Carturesti_Carusel_-_Interior_ziua.jpg","CC BY-SA 4.0","Mihai Petre","la libreria"],
["stores","market","el mercado","a feira","o mercado","le marché","Bradley's vegetables in Wolverhampton Market - geograph.org.uk - 1522689.jpg","CC BY-SA 2.0","Roger Kidd","il mercato"],
["stores","barbershop","la barbería","a barbearia","","le coiffeur","Iranian_barber.jpg","CC BY-SA 4.0","Qming","il barbiere"],
["stores","clothing store","la tienda de ropa","a loja de roupas","a loja de roupa","le magasin de vêtements","Burkes Outlet Store.jpg","Public domain","Ente75","il negozio di abbigliamento"],
["stores","restaurant","el restaurante","o restaurante","","le restaurant","Barbieri_-_ViaSophia25668.jpg","CC BY-SA 4.0","Mcg2132","il ristorante"],
["stores","gas station","la gasolinera","o posto de gasolina","a bomba de gasolina","la station-service","Mattoon_Service_Station_(pre-fabricated),_angle_view,_National_&_Washington_Boulevards,_Culver_City,_California_LOC_37555778230.jpg","No known restrictions","Library of Congress","il distributore di benzina"],
["stores","bank","el banco","o banco","","la banque","London.bankofengland.arp.jpg","Public domain","Adrian Pingstone","la banca"],
["stores","post office","la oficina de correos","os correios","","la poste","EdithburghPostOffice.JPG","CC BY-SA 3.0","Mattinbgn","l'ufficio postale"],
];
const PICTURE_SETS = [
  { id: "animals", title: "Animals", cover: "bear" },
  { id: "food", title: "Food", cover: "tomato" },
  { id: "nature", title: "Nature", cover: "waterfall" },
  { id: "stores", title: "Stores", cover: "bookstore" },
];
const PICTURE_ALT = { shrimp: ["el camarón"], banana: ["la banana"], "gas station": ["la estación de servicio"], "post office": ["el correo"], barbershop: ["la peluquería"] };
function pictureCards(code) {
  return PICTURE_RAW.map((r) => {
    const card = { id: "pic-" + r[1].replace(/\s+/g, "-"), picture: true, cat: r[0], en: r[1], es: r[2], file: r[6], license: r[7], author: r[8], note: "", tag: "picture", alt: code === "es" ? PICTURE_ALT[r[1]] || [] : [], hints: { es: r[2], pt: r[4] || r[3], fr: r[5], it: r[9] } };
    if (code === "pt") { card.br = r[3]; card.pt = r[4]; } else if (code === "fr") card.fr = r[5]; else if (code === "it") card.it = r[9];
    return card;
  });
}
const photoUrl = (card) => `/photos/${card.en.replace(/\s+/g, "-")}.jpg`;
const photoPage = (file) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`;
