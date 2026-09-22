export const money=["50 €","100 €","200 €","300 €","500 €","1'000 €","2'000 €","4'000 €","8'000 €","16'000 €","32'000 €","64'000 €","125'000 €","500'000 €","1'000'000 €"];
export const S={editorId:null,createdAt:null,editorQs:[],importMode:"simple",game:null,qs:[],i:0,answers:[],sel:null,locked:false,finished:false,jokerBusy:false,name:"",introReady:false,seq:0,jokers:{fifty:false,audience:false,phone:false,teacher:false}};
export const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function q(question,correct,...wrong){return{id:crypto.randomUUID(),question,correct,wrong};}
export function screen(name){$$('.screen').forEach(x=>x.classList.remove('active'));$(`#screen-${name}`).classList.add('active');window.scrollTo({top:0});}
export function shuffleInPlace(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function toast(msg,error=false){document.querySelector('.toast')?.remove();const x=document.createElement('div');x.className=`toast${error?' error':''}`;x.textContent=msg;document.body.append(x);setTimeout(()=>x.remove(),3000);}
export const demo=[
q("Was bezeichnet das Zusammentreffen von Angebot und Nachfrage?","Markt","Budget","Bilanz","Monopol"),
q("Was passiert ceteris paribus mit der nachgefragten Menge, wenn der Preis eines Gutes sinkt?","Sie steigt","Sie sinkt","Sie bleibt zwingend gleich","Das Angebot verschwindet"),
q("Welches Gut ist typischerweise ein Substitut für Butter?","Margarine","Brot","Salz","Milch"),
q("Welche Aussage beschreibt den Gleichgewichtspreis?","Angebotsmenge und Nachfragemenge stimmen überein","Angebot ist immer grösser als Nachfrage","Nachfrage ist immer grösser als Angebot","Der Staat legt ihn immer fest"),
q("Was misst die Preiselastizität der Nachfrage?","Die Reaktion der Nachfrage auf eine Preisänderung","Die Produktionskosten","Die Inflationsrate","Die Höhe der Mehrwertsteuer"),
q("Welcher Produktionsfaktor umfasst Maschinen und Gebäude?","Kapital","Arbeit","Boden","Konsum"),
q("Welches Beispiel kann Marktversagen darstellen?","Negative externe Effekte","Vollständige Konkurrenz","Sinkende Produktionskosten","Hohe Konsumentenrente"),
q("Welche Grösse gehört zum einfachen Wirtschaftskreislauf?","Güterstrom","Temperaturstrom","Notenstrom","Verkehrsstrom"),
q("Was beschreibt Inflation am treffendsten?","Ein anhaltender Anstieg des allgemeinen Preisniveaus","Ein einzelner höherer Preis","Sinkende Löhne in einem Unternehmen","Mehr Exporte als Importe"),
q("Was bewirkt ein gesetzlicher Höchstpreis direkt?","Er begrenzt einen Preis nach oben","Er begrenzt einen Preis nach unten","Er verbietet die Nachfrage","Er verdoppelt das Angebot"),
q("Was entsteht typischerweise bei einem wirksamen Höchstpreis unter dem Gleichgewichtspreis?","Ein Nachfrageüberschuss","Ein Angebotsüberschuss","Keine Veränderung","Zwingend ein Monopol"),
q("Welche Eigenschaft kann für ein öffentliches Gut typisch sein?","Nichtausschliessbarkeit","Vollständige Ausschliessbarkeit","Immer ein hoher Marktpreis","Produktion nur durch private Unternehmen"),
q("Welche Veränderung verschiebt die Nachfrage nach einem normalen Gut nach rechts?","Steigendes Einkommen","Steigende Produktionskosten","Sinkende Zahl der Konsumenten","Technischer Fortschritt bei den Produzenten"),
q("Wie gross ist die Preiselastizität bei vollkommen unelastischer Nachfrage betragsmässig?","0","1","2","Unendlich"),
q("Was ist bei negativen externen Effekten ohne Korrektur typischerweise der Fall?","Es wird gesellschaftlich zu viel produziert","Es wird gesellschaftlich zu wenig produziert","Der Marktpreis ist immer null","Es entstehen keine privaten Kosten")];
