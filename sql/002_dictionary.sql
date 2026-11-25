-- Quid · 002 dizionario esercenti comuni (Italia)
-- Le parole chiave sono già normalizzate (minuscolo, senza accenti né punteggiatura).
-- Vengono cercate all'inizio di una parola; quelle di 3 lettere o meno devono essere parole intere.
-- Le regole personali (imparate dalle tue correzioni) hanno sempre la precedenza.

insert into public.merchant_dictionary (keyword, category) values
-- Spesa
('esselunga','Spesa'),('coop','Spesa'),('ipercoop','Spesa'),('conad','Spesa'),('carrefour','Spesa'),
('lidl','Spesa'),('eurospin','Spesa'),('pam','Spesa'),('panorama','Spesa'),('despar','Spesa'),
('spar','Spesa'),('interspar','Spesa'),('eurospar','Spesa'),('aldi','Spesa'),('penny','Spesa'),
('md','Spesa'),('iper','Spesa'),('famila','Spesa'),('crai','Spesa'),('sigma','Spesa'),('todis','Spesa'),
('naturasi','Spesa'),('bennet','Spesa'),('tigros','Spesa'),('unes','Spesa'),('iperal','Spesa'),
('tuodi','Spesa'),('ins mercato','Spesa'),('pewex','Spesa'),('basko','Spesa'),('simply','Spesa'),
('carrefour market','Spesa'),('supermercato','Spesa'),('alimentari','Spesa'),('macelleria','Spesa'),
('panificio','Spesa'),('panetteria','Spesa'),('fruttivendolo','Spesa'),('mercato','Spesa'),
('dok','Spesa'),('a o','Spesa'),('emisfero','Spesa'),('gros','Spesa'),('il gigante','Spesa'),
-- Ristoranti e bar
('mcdonalds','Ristoranti e bar'),('mcdonald','Ristoranti e bar'),('burger king','Ristoranti e bar'),
('kfc','Ristoranti e bar'),('starbucks','Ristoranti e bar'),('autogrill','Ristoranti e bar'),
('bar','Ristoranti e bar'),('caffe','Ristoranti e bar'),('caffetteria','Ristoranti e bar'),
('pasticceria','Ristoranti e bar'),('gelateria','Ristoranti e bar'),('pizzeria','Ristoranti e bar'),
('ristorante','Ristoranti e bar'),('trattoria','Ristoranti e bar'),('osteria','Ristoranti e bar'),
('sushi','Ristoranti e bar'),('poke','Ristoranti e bar'),('roadhouse','Ristoranti e bar'),
('old wild west','Ristoranti e bar'),('deliveroo','Ristoranti e bar'),('glovo','Ristoranti e bar'),
('just eat','Ristoranti e bar'),('justeat','Ristoranti e bar'),('uber eats','Ristoranti e bar'),
('spizzico','Ristoranti e bar'),('rossopomodoro','Ristoranti e bar'),('panino giusto','Ristoranti e bar'),
('pub','Ristoranti e bar'),('birreria','Ristoranti e bar'),('enoteca','Ristoranti e bar'),
('piadineria','Ristoranti e bar'),('rosticceria','Ristoranti e bar'),('kebab','Ristoranti e bar'),
('chef express','Ristoranti e bar'),('sarni','Ristoranti e bar'),('lavazza','Ristoranti e bar'),
-- Trasporti
('trenitalia','Trasporti'),('italo','Trasporti'),('trenord','Trasporti'),('atm','Trasporti'),
('atac','Trasporti'),('gtt','Trasporti'),('anm','Trasporti'),('amt','Trasporti'),('tper','Trasporti'),
('uber','Trasporti'),('free now','Trasporti'),('freenow','Trasporti'),('itaxi','Trasporti'),
('taxi','Trasporti'),('bolt','Trasporti'),('lime','Trasporti'),('dott','Trasporti'),('tier','Trasporti'),
('enjoy','Trasporti'),('share now','Trasporti'),('eni','Trasporti'),('enilive','Trasporti'),
('q8','Trasporti'),('ip','Trasporti'),('tamoil','Trasporti'),('esso','Trasporti'),('shell','Trasporti'),
('api','Trasporti'),('autostrade','Trasporti'),('telepass','Trasporti'),('parcheggio','Trasporti'),
('easypark','Trasporti'),('mycicero','Trasporti'),('flixbus','Trasporti'),('itabus','Trasporti'),
('carburante','Trasporti'),('distributore','Trasporti'),
-- Viaggi
('ryanair','Viaggi'),('easyjet','Viaggi'),('ita airways','Viaggi'),('wizz','Viaggi'),
('volotea','Viaggi'),('vueling','Viaggi'),('lufthansa','Viaggi'),('booking','Viaggi'),
('airbnb','Viaggi'),('hotel','Viaggi'),('expedia','Viaggi'),('trivago','Viaggi'),('albergo','Viaggi'),
('b b','Viaggi'),('ostello','Viaggi'),('hertz','Viaggi'),('europcar','Viaggi'),('avis','Viaggi'),
('sixt','Viaggi'),('moby','Viaggi'),('tirrenia','Viaggi'),('grimaldi','Viaggi'),('gnv','Viaggi'),
-- Abbonamenti
('netflix','Abbonamenti'),('spotify','Abbonamenti'),('apple com bill','Abbonamenti'),
('apple com','Abbonamenti'),('icloud','Abbonamenti'),('disney','Abbonamenti'),('prime video','Abbonamenti'),
('amazon prime','Abbonamenti'),('dazn','Abbonamenti'),('now tv','Abbonamenti'),('youtube','Abbonamenti'),
('google one','Abbonamenti'),('openai','Abbonamenti'),('chatgpt','Abbonamenti'),('anthropic','Abbonamenti'),
('claude','Abbonamenti'),('adobe','Abbonamenti'),('figma','Abbonamenti'),('notion','Abbonamenti'),
('dropbox','Abbonamenti'),('microsoft','Abbonamenti'),('audible','Abbonamenti'),('paramount','Abbonamenti'),
('crunchyroll','Abbonamenti'),('duolingo','Abbonamenti'),('patreon','Abbonamenti'),
-- Bollette
('enel','Bollette'),('a2a','Bollette'),('hera','Bollette'),('iren','Bollette'),('edison','Bollette'),
('acea','Bollette'),('sorgenia','Bollette'),('plenitude','Bollette'),('tim','Bollette'),
('vodafone','Bollette'),('windtre','Bollette'),('wind tre','Bollette'),('iliad','Bollette'),
('fastweb','Bollette'),('ho mobile','Bollette'),('very mobile','Bollette'),('kena','Bollette'),
('sky','Bollette'),('poste mobile','Bollette'),('postemobile','Bollette'),
-- Casa
('ikea','Casa'),('leroy merlin','Casa'),('brico','Casa'),('bricoman','Casa'),('obi','Casa'),
('maisons du monde','Casa'),('kasanova','Casa'),('ferramenta','Casa'),('maxi zoo','Casa'),
('arcaplanet','Casa'),('tecnomat','Casa'),('mondo convenienza','Casa'),('poltronesofa','Casa'),
-- Salute
('farmacia','Salute'),('parafarmacia','Salute'),('ottica','Salute'),('dentista','Salute'),
('studio medico','Salute'),('ospedale','Salute'),('laboratorio','Salute'),('analisi','Salute'),
('poliambulatorio','Salute'),('centro medico','Salute'),('fisioterapia','Salute'),('salmoiraghi','Salute'),
-- Shopping
('amazon','Shopping'),('zalando','Shopping'),('decathlon','Shopping'),('h m','Shopping'),('hm','Shopping'),
('zara','Shopping'),('mediaworld','Shopping'),('unieuro','Shopping'),('euronics','Shopping'),
('expert','Shopping'),('primark','Shopping'),('uniqlo','Shopping'),('ovs','Shopping'),('coin','Shopping'),
('rinascente','Shopping'),('tiger','Shopping'),('flying tiger','Shopping'),('action','Shopping'),
('shein','Shopping'),('temu','Shopping'),('apple store','Shopping'),('sephora','Shopping'),
('douglas','Shopping'),('kiko','Shopping'),('acqua e sapone','Shopping'),('tigota','Shopping'),
('pull bear','Shopping'),('bershka','Shopping'),('stradivarius','Shopping'),('mango','Shopping'),
('calzedonia','Shopping'),('intimissimi','Shopping'),('tezenis','Shopping'),('foot locker','Shopping'),
('nike','Shopping'),('adidas','Shopping'),('ebay','Shopping'),('vinted','Shopping'),('aliexpress','Shopping'),
-- Svago
('cinema','Svago'),('uci','Svago'),('the space','Svago'),('ticketone','Svago'),('vivaticket','Svago'),
('ticketmaster','Svago'),('dice','Svago'),('museo','Svago'),('steam','Svago'),('playstation','Svago'),
('nintendo','Svago'),('xbox','Svago'),('palestra','Svago'),('mcfit','Svago'),('virgin active','Svago'),
('anytime fitness','Svago'),('feltrinelli','Svago'),('mondadori','Svago'),('libreria','Svago'),
('giunti','Svago'),('teatro','Svago'),('piscina','Svago'),('discoteca','Svago')
on conflict (keyword) do update set category = excluded.category;
