# INC MCD NETWORK (दिल्ली प्रदेश कांग्रेस कमेटी)

[![Latest Release](https://img.shields.io/badge/version-v2.3%20(Build%2014)-blue.svg)](https://github.com/amandangi26/ward-sadasya/releases/latest)
[![Package Name](https://img.shields.io/badge/package-com.coceptual.delhicongress-1B4FA8.svg)]()
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web%20Admin-green.svg)]()
[![Google Play](https://img.shields.io/badge/Play%20Store-Ready%20(.AAB)-34A853.svg)](https://github.com/amandangi26/ward-sadasya/releases/latest)
[![Backend](https://img.shields.io/badge/backend-Supabase%20Edge%20Functions-3ECF8E.svg)]()
[![Portal](https://img.shields.io/badge/portal-congressdelhinetwork.com-1B4FA8.svg)](https://congressdelhinetwork.com/mcd)

**INC MCD NETWORK** दिल्ली प्रदेश कांग्रेस कमेटी (DPCC) की आधिकारिक डिजिटल प्रबंधन और संगठनात्मक समन्वय प्रणाली है। यह दिल्ली के सभी **250 MCD वार्डों**, 70 विधानसभाओं और 14 संगठनात्मक ज़िलों के शीर्ष नेतृत्व से लेकर बूथ व वार्ड स्तर के कार्यकर्ताओं को एकजुट, सक्रिय और जवाबदेह रखती है।

---

## 📌 महत्वपूर्ण त्वरित लिंक्स (Important Links)

| सेवा / पृष्ठ | लाइव यूआरएल | विवरण |
| :--- | :--- | :--- |
| **एडमिन एवं टेलीकॉलर पोर्टल** | [congressdelhinetwork.com/mcd](https://congressdelhinetwork.com/mcd) | संगठन प्रबंधन, टास्क निर्माण, कॉलिंग और एनालिटिक्स |
| **वैकल्पिक एडमिन पोर्टल** | [ward-sadasya.vercel.app/mcd](https://ward-sadasya.vercel.app/mcd) | Vercel बैकअप लाइव पोर्टल |
| **ऐप डाउनलोड (APK & AAB)** | [congressdelhinetwork.com/download](https://congressdelhinetwork.com/download) | कार्यकर्ताओं के लिए सीधा डाउनलोड पेज |
| **गोपनीयता नीति (Privacy Policy)** | [congressdelhinetwork.com/privacy](https://congressdelhinetwork.com/privacy) | DPDP Act 2023 व Google Play अनुरूप नीति |
| **खाता हटाने का अनुरोध (Delete Account)** | [congressdelhinetwork.com/delete-account](https://congressdelhinetwork.com/delete-account) | Google Play Store अनिवार्य डेटा डिलीशन पेज |
| **नवीनतम रिलीज़ (GitHub Releases)** | [GitHub Releases Latest](https://github.com/amandangi26/ward-sadasya/releases/latest) | `.aab` (Play Store) व `.apk` फ़ाइलें |

---

## 🏛️ प्रोजेक्ट आर्किटेक्चर (System Architecture)

प्रोजेक्ट तीन मुख्य घटकों में विभाजित है:

```
ward-sadasya/
├── android/               # Native Android App (Kotlin + Jetpack Compose)
│   ├── app/src/main/java/com/coceptual/delhicongress/
│   │   ├── MainActivity.kt   # यूज़र इंटरफेस, नेविगेशन व सभी स्क्रीन
│   │   ├── Leader.kt         # नेतृत्व स्तरों के डैशबोर्ड व रिपोर्ट्स
│   │   ├── Api.kt            # सिक्योर API क्लाइंट व सेशन मैनेजमेंट
│   │   ├── Media.kt          # मल्टी-फ़ोटो, वीडियो व ऑडियो रिकॉर्डर
│   │   ├── Push.kt           # Firebase Cloud Messaging (FCM)
│   │   └── ReminderWorker.kt # बैकग्राउंड टास्क रिमाइंडर्स
│   └── app/build.gradle.kts  # Package: com.coceptual.delhicongress
├── admin/                 # एडमिन एवं टेलीकॉलर वेब पोर्टल (React 18 + Vite)
│   ├── src/                  # एनालिटिक्स, टास्क, मेंबर्स, कॉलिंग, रिपोर्ट्स
│   └── public/               # download.html, privacy.html, delete-account.html
├── supabase/              # बैकएंड एवं डेटाबेस
│   ├── schema.sql            # 34 टेबल्स, RLS नीतियां, व्यूज व ट्रिगर्स
│   ├── migration_v2_1_v2_2.sql # v2.1/v2.2 डेटाबेस माइग्रेशन
│   ├── migration_v2_3.sql    # v2.3 डेटाबेस माइग्रेशन
│   └── functions/            # Deno Edge Functions (app, leader, admin, push)
└── docs/
    └── play-store.md         # Play Console सबमिशन हैंडबुक व डेटा सेफ्टी उत्तर
```

---

## 📱 Google Play Store हैंडओवर विवरण (Developer Technical Specs)

Google Play Console पर ऐप सबमिट करने के लिए आवश्यक सभी तकनीकी विवरण:

| पैरामीटर | मान (Value) | विवरण |
| :--- | :--- | :--- |
| **App Name** | `INC MCD NETWORK` | आधिकारिक नाम (अधिकतम 30 अक्षर) |
| **Package Name / Application ID** | `com.coceptual.delhicongress` | प्ले स्टोर की विशिष्ट पहचान आईडी |
| **Version Name** | `2.3` | यूज़र को दिखने वाला वर्शन |
| **Version Code** | `14` | इंटरनल बिल्ड नंबर |
| **Target SDK** | `34` (Android 14) | Google Play का नवीनतम अनिवार्य मानक |
| **Minimum SDK** | `24` (Android 7.0) | 98%+ सक्रिय Android डिवाइसेस पर संगत |
| **Production Bundle** | `app-release.aab` | Play Store पर अपलोड होने वाला Android App Bundle |
| **Keystore Alias** | `wardsadasya` | रिलीज़ कीस्टोर का एलियास नाम |
| **Keystore File** | `android/app/release.keystore` | RSA 2048-bit स्थायी रिलीज़ कीस्टोर |
| **परमिशन्स (v2.3)** | `INTERNET`, `POST_NOTIFICATIONS`, `RECORD_AUDIO` | *नोट: लोकेशन परमिशन पूरी तरह हटा दी गई है* |
| **App Access (Demo Login)** | Restricted (No OTP) | टेस्ट नंबर दर्ज करके "आगे बढ़ें" पर 1-टैप लॉगिन |

---

## 🌟 प्रमुख विशेषताएँ (Key Features in v2.3)

### 1. एक ही ऐप में 6 संगठनात्मक स्तर (6 Leadership Levels)
लॉगिन मोबाइल नंबर के आधार पर ऐप स्वतः कार्यकर्ता/पदाधिकारी की भूमिका पहचानता है:

1. **माननीय DPCC अध्यक्ष (President):**
   * संपूर्ण दिल्ली, ज़िला व ब्लॉक स्तरीय लाइव एनालिटिक्स और परफॉरमेंस रैंकिंग।
   * सभी स्तरों को वॉयस नोट के साथ टास्क असाइन करना और 7-दिन के बंडल्स में संदेश समीक्षा।
2. **महासचिव (General Secretary):**
   * ज़िला समन्वयकों (DC) की दैनिक कॉलिंग रिपोर्ट मॉनिटरिंग और 5 स्तरों पर टास्क वितरण।
3. **ज़िला समन्वयक (District Coordinator - DC):**
   * संगठनात्मक ज़िलों में दैनिक कॉलिंग, ब्लॉक अध्यक्षों से संपर्क और महासचिव को दैनिक रिपोर्ट।
4. **ज़िला अध्यक्ष (District President - DP):**
   * ज़िला रैंक, लाइव स्कोर, ज़िला ब्रॉडकास्ट और प्रेक्षक ट्रैकिंग।
5. **विधानसभा प्रेक्षक (Assembly Observer):**
   * ग्राउंड विज़िट रिपोर्टिंग (गतिविधियों की चेकलिस्ट, फ़ोटो, वीडियो व ऑडियो)।
   * वार्ड कार्यकर्ताओं का मासिक मूल्यांकन व फ़ीडबैक रिपोर्ट।
6. **ब्लॉक अध्यक्ष एवं वार्ड कार्यकर्ता (Block President & Ward Member):**
   * दैनिक कार्य (फ़ोटो/वीडियो अपलोड, सोशल शेयर, चेकलिस्ट व लिखित उत्तर)।
   * नेतृत्व से सीधे टास्क व इनबॉक्स संदेश प्राप्त करना।
   * अपने स्वयं के किए गए कार्यों (Own Tasks) को सबमिट कर अंक पाना।

### 2. मल्टी-प्रोफ़ाइल सपोर्ट (Multi-Profile Switching)
* यदि कोई कार्यकर्ता एक से अधिक पदों पर है (उदा. वार्ड कार्यकर्ता + ब्लॉक अध्यक्ष या पदाधिकारी), तो वह ऐप मेन्यू में ऊपर दिए गए स्विचर से **बिना लॉगआउट किए 1-टैप में प्रोफ़ाइल बदल सकता है**।

### 3. नए प्रकार के टास्क (Unified Task Funnel)
v2.3 में केवल मीडिया अपलोड ही नहीं, बल्कि विविध प्रकार के टास्क उपलब्ध हैं:
* **Upload Tasks:** ग्राउंड कार्य की न्यूनतम 2 फ़ोटो + 2 वीडियो अपलोड।
* **Share Tasks:** सोशल मीडिया (WhatsApp, Facebook, X, Instagram) पर 1-क्लिक शेयरिंग।
* **Checklist Tasks (Choice):** दिए गए विकल्पों में से टिक करके रिपोर्ट सबमिट करना।
* **Text / Voice Reply:** संक्षिप्त लिखित उत्तर या वॉयस नोट रिकॉर्ड करके भेजना।
* नेतृत्व (अध्यक्ष जी आदि) द्वारा दिए गए टास्क अब अलग जाने के बजाय मुख्य होम स्क्रीन पर एकीकृत दिखते हैं।

### 4. पारदर्शी 100-अंक योजना (100-Points Scheme)
* **सोशल शेयर:** प्रति टास्क और प्रति सोशल प्लेटफ़ॉर्म = **100 अंक**
* **पूर्ण टास्क:** टास्क सफलतापूर्वक पूरा करने पर (अपलोड/चेकलिस्ट/टेक्स्ट) = **100 अंक**
* **खुद का टास्क:** कार्यकर्ता द्वारा स्वयं किए गए कार्य का एडमिन अप्रूवल = **100 अंक**

---

## 💻 एडमिन एवं टेलीकॉलर पोर्टल (`/mcd`)

* **डैशबोर्ड व हीटमैप:** दिल्ली के सभी 250 वार्डों की लाइव स्थिति (रंग-कोडित हीटमैप), दैनिक ट्रेंड्स व टॉप परफॉर्मर्स।
* **टास्क मैनेजर:** नए टास्क बनाना, लक्षित ऑडियंस (सभी, केवल वार्ड सदस्य, केवल ब्लॉक अध्यक्ष) और ज़िला/विधानसभा फ़िल्टर।
* **टेलीकॉलर कॉलिंग पैनल:** ज़िलावार कार्यकर्ताओं को 1-क्लिक कॉल, कॉल परिणाम दर्ज करना और फॉलो-अप रिमाइंडर।
* **डेटा विसंगति समाधान (Data Discrepancies):** छूटे हुए नंबर, डुप्लीकेट और मिसिंग वार्ड्स को सीधे सही करना।
* **खाता हटाने का प्रबंधन (Deletions):** प्ले स्टोर नीतियों के तहत आए खाता डिलीशन अनुरोधों को 1-क्लिक में प्रोसेस करना (फ़ाइलों, मीडिया व डेटा का स्थायी निष्कासन)।
* **लीडर व कार्यकर्ता प्रोफ़ाइल अप्रूवल:** कार्यकर्ताओं और पदाधिकारियों द्वारा भेजे गए प्रोफ़ाइल बदलावों की समीक्षा।

---

## 🛠️ स्थानीय विकास एवं डिप्लॉयमेंट (Setup Guide)

### 1. Supabase बैकएंड
1. Supabase CLI से जुड़े:
   ```bash
   supabase link --project-ref xqbjqfjystiakfuwplby
   ```
2. माइग्रेशन रन करें:
   ```bash
   supabase db query --remote --yes -f supabase/migration_v2_3.sql
   ```
3. Edge Functions डिप्लॉय करें:
   ```bash
   supabase functions deploy app --no-verify-jwt --yes
   supabase functions deploy leader --no-verify-jwt --yes
   supabase functions deploy admin --no-verify-jwt --yes
   supabase functions deploy push --no-verify-jwt --yes
   ```

### 2. Admin पोर्टल बिल्ड व टेस्ट
```bash
cd admin
npm install
npm run build
```

### 3. Android बिल्ड (APK व AAB)
* **GitHub Actions:** `main` ब्रांच पर पुश होते ही `.github/workflows/android-apk.yml` स्वतः `.apk` और `.aab` दोनों बिल्ड करके रिलीज़ पर पब्लिश कर देता है।
* **लोकल टर्मिनल बिल्ड:**
  ```bash
  cd android
  ./gradlew assembleRelease bundleRelease
  ```
  - **APK आउटपुट:** `android/app/build/outputs/apk/release/app-release.apk`
  - **AAB आउटपुट:** `android/app/build/outputs/bundle/release/app-release.aab`

---

## 📜 वर्शन इतिहास (Changelog)

* **v2.3 (Build 14) - नवीनतम:**
  * चेकलिस्ट (Choice) और लिखित उत्तर (Text/Audio) वाले नए टास्क प्रकार।
  * एकीकृत टास्क फ़नल (Unified Funnel — नेतृत्व के टास्क सीधे होम स्क्रीन पर)।
  * लोकेशन परमिशन पूरी तरह हटाई गई (Google Play Store की त्वरित मंज़ूरी के लिए)।
  * लीडर टास्क समापन पर रिमार्क और वॉयस नोट अटैचमेंट।
  * नया DPDP Act 2023 अनुरूप प्राइवेसी पॉलिसी व डेटा डिलीशन फ़्लो।
* **v2.2 (Build 13):**
  * पैकेज नाम बदलकर `com.coceptual.delhicongress` किया गया।
  * Google Play Store AAB बंडल बिल्ड पाइपलाइन।
  * ऑब्ज़र्वर फ़ीडबैक हेडिंग और मेन्यू सुधार।
* **v2.1 (Build 12):**
  * ब्लॉक अध्यक्ष (Block Presidents) और ज़िला समन्वयक (District Coordinators) स्तर।
  * मल्टी-प्रोफ़ाइल स्विचिंग सिस्टम।
  * स्टेप-बाई-स्टेप सोशल मीडिया शेयर।
  * ऑब्ज़र्वर मासिक फ़ीडबैक रिपोर्ट और ज़िला समन्वयक कॉलिंग रिपोर्ट।
* **v2.0 (Build 11):**
  * मास्टर वार्ड संरचना (Lok Sabha > District > Vidhan Sabha > 250 Wards)।
  * डेटा विसंगति समाधान (Data Discrepancies टैब)।
  * टास्क मीडिया रिमूव और अध्यक्ष जी को संदेशों का विषय विश्लेषण।
* **v1.8 - v1.9:**
  * 100-अंक फिक्स्ड प्रणाली, 5 नेतृत्व स्तर, स्लाइड-इन मेन्यू और सर्च पिकर।

---

**© 2026 दिल्ली प्रदेश कांग्रेस कमेटी (DPCC) · तकनीकी संचालन: Coceptual Media**
