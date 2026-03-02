// DOM Manipülasyonu: document.body.innerText komutu, o an açık olan sayfanın
// gövdesindeki (body) tüm "görünen" metinleri kopyalayıp alır.
const sayfadakiMetin = document.body.innerText;

// Kodu test edebilmek için sayfadan çektiğimiz veriyi Geliştirici Konsoluna yazdırıyoruz
console.log("EliteDevs Eklentisi Devrede!");
console.log("Bu sayfadan çekilen metin uzunluğu: " + sayfadakiMetin.length + " karakter.");
console.log("Çekilen metnin ilk 100 karakteri: ", sayfadakiMetin.substring(0, 100) + "...");

