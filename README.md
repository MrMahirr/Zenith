# Zenith Smart Room

**Zenith Smart Room**, klasik bir çalışma odasını veya ofisi "akıllı, duyarlı ve sağlığa odaklı" bir ekosisteme dönüştüren entegre bir IoT (Nesnelerin İnterneti) projesidir. Sistem bir Raspberry Pi üzerinde çalışacak şekilde optimize edilmiştir ve ortamdaki fiziksel sensörlerden, kameradan ve NFC okuyucusundan aldığı verileri merkezi bir yönetim paneliyle (Dashboard) birleştirir.

## 📖 Projenin Amacı ve Ne Olduğu?

Zenith, özellikle uzun saatler bilgisayar başında çalışan kişilerin **verimliliğini artırmak** ve **sağlığını korumak** amacıyla tasarlanmıştır.

1. **Sağlık Odaklı Yaklaşım (Postür Analizi):** Kamera üzerinden kullanıcının oturuş pozisyonunu yapay zeka (OpenCV) ile anlık olarak analiz eder. Kullanıcı kambur durduğunda sistem bunu algılar, arayüzde uyarı verir ve odadaki LED ışıkları kırmızıya dönüştürerek fiziksel bir uyarıda bulunur.
2. **Ortam Farkındalığı (Sensörler):** BME280 ve MQ135 gibi sensörler yardımıyla odanın anlık sıcaklığını, nem oranını ve hava kalitesini ölçer. Bu veriler anlık olarak Dashboard üzerinden takip edilebilir ve geçmişe dönük istatistiksel analizler sunar.
3. **Modüler Çalışma Ortamı (NFC Mod Yönetimi):** Kullanıcı, masasında bulunan NFC kartları okutarak odanın modunu anında değiştirebilir (Örn: CODING, FOCUS, RELAX, MEETING, PASSIVE). Her modun kendine has bir ambiyans rengi vardır ve sistem buna göre WS2812B LED şeritlerini otomatik ayarlar.
4. **Merkezi Yönetim (Dashboard):** 7 inç dokunmatik ekranlara (1024x600) uyumlu geliştirilmiş modern arayüz (React + Vite) üzerinden tüm bu sistemler tek bir noktadan yönetilir ve izlenir.

## 🏗️ Proje Mimarisi

Sistem birbirine entegre 3 ana bileşenden oluşmaktadır:

- **AI Service (Python):** Sensör verilerinin okunması, yapay zeka ile postür analizi yapılması, NFC kart okuyucusunun dinlenmesi ve WS2812B LED'lerin kontrolünden sorumludur. WebSocket üzerinden Backend ile sürekli iletişim halindedir.
- **Backend (NestJS):** Sistemdeki tüm verilerin toplandığı merkezdir. AI Service ve Frontend ile Socket.io üzerinden anlık haberleşir, ayrıca verileri (sensör geçmişi, mod değişimleri, postür analizleri) SQLite veritabanına kaydeder ve REST API sunar.
- **Frontend (React + Vite):** Anlık veri takibi sağlayan kullanıcı paneli (Dashboard). Modern, şık ve okunabilir bir UI/UX deneyimi sunar.

## 📂 Proje Yapısı

```bash
zenith-workspace/
│
├── ai-service/        # Python tabanlı donanım, AI ve soket servisleri
├── backend/           # NestJS REST API & WebSocket sunucusu
└── frontend/          # React + Vite tabanlı kullanıcı paneli
```

## 🚀 Teknolojiler

- **Yapay Zeka ve Donanım (Python):** Python 3, OpenCV, rpi_ws281x (LED), I2C/SPI Sensor Kütüphaneleri, Socket.io-client
- **Sunucu (Backend):** Node.js, NestJS, TypeScript, TypeORM, SQLite, Socket.io
- **İstemci (Frontend):** React.js, Vite, React Router, Recharts, Custom CSS (Dark/Premium Tema)

---

## 🛠️ Kurulum ve Projeyi Ayağa Kaldırma Rehberi

Projeyi ayağa kaldırmak için sırasıyla `Backend`, `AI Service` ve `Frontend` bileşenlerini çalıştırmanız gerekmektedir. Tüm işlemleri yapmadan önce sisteminizde **Node.js (v18+)** ve **Python (3.9+)** kurulu olduğundan emin olun. Raspberry Pi üzerinde çalıştırıyorsanız donanım (I2C, SPI) izinlerinin açık olması gerekir.

### 1. Backend (NestJS) Kurulumu ve Başlatılması

Tüm sistemin haberleşme merkezi olduğu için önce backend'i başlatmalıyız.

```bash
# Backend klasörüne girin
cd backend

# Gerekli kütüphaneleri yükleyin
npm install

# .env dosyanızı kontrol edin ve kendi ortamınıza göre yapılandırın
# .env dosyası içerisinde genellikle port numaraları veya veritabanı ayarları bulunur

# Projeyi geliştirme (development) modunda başlatın
npm run start:dev
```
*(Backend başarılı bir şekilde başladığında, SQLite veritabanı dosyası oluşacak ve sunucu yayına girecektir. Varsayılan olarak genellikle `http://localhost:3000`)*

### 2. AI Service (Python) Kurulumu ve Başlatılması

Donanımları kontrol eden ve yapay zeka analizini yapan servis. İzole bir ortam için sanal ortam (virtual environment) kullanmanız önerilir.

```bash
# ai-service klasörüne girin
cd ai-service

# (Opsiyonel ama önerilir) Sanal ortam oluşturun ve aktif edin
python -m venv venv

# Windows için sanal ortamı aktif etme:
.\venv\Scripts\activate
# Linux/Mac/Raspberry Pi için:
# source venv/bin/activate

# Gerekli Python bağımlılıklarını yükleyin
pip install -r requirements.txt

# .env dosyasını yapılandırın
# (Kamera IP'si, I2C portları, Backend Socket adresi vb. değişkenlerin doğru olduğundan emin olun.)

# Servisi başlatın
python main.py
```
*(Başarıyla çalıştığında konsolda modüllerin yüklendiği ve Backend'e bağlandığı bilgisi düşecektir.)*

### 3. Frontend (React + Vite) Kurulumu ve Başlatılması

Son olarak kullanıcı arayüzünü (Dashboard) başlatıyoruz.

```bash
# Frontend klasörüne girin
cd frontend

# Gerekli kütüphaneleri yükleyin
npm install

# Projeyi başlatın
npm run dev
```
*(Proje genellikle `http://localhost:5173` adresinde başlayacaktır. Tarayıcınızdan bu adrese giderek Zenith Smart Room paneline erişebilirsiniz.)*

---

## 💡 Ek Notlar
- Tüm sistemi production (canlı) ortamda tek seferde çalıştırmak için ana dizindeki `ecosystem.config.js` ve `ecosystem.hardware.config.js` dosyalarını kullanarak **PM2** süreç yöneticisinden faydalanabilirsiniz (`pm2 start ecosystem.config.js`).
- Yapay zeka modülündeki Kamera (Postür Analizi) özelliği için bir IP kameranızın bulunması ve ilgili adresi `.env` dosyasına (veya config dosyasına) girmeniz gereklidir.
