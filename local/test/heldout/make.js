// HELD-OUT made-up matter for measuring the name rules.
//
// Written before any change to the name rules, and kept apart: the rules are
// developed against test/namesdev/, never against this matter. It is measured
// twice only, before and after (docs/names-measurement.md). Do not tune
// anything to it.
//
// Every person, company, number and address here is invented. The story: a
// landscaping subcontractor in Johor (Kebun Hijau) is owed money by a main
// contractor (Ombak Biru) for plants delivered to a resort in Desaru. A lorry
// went to the wrong site and pallets of plants were damaged.
//
// Marks: «kind|Name» is a real name that must not appear in a cloaked copy;
// «trap|word» is an ordinary word that must stay readable. Kinds are listed in
// ../names-marks.js. A title in front of a name (Encik, Kak, Pak, Ibu, Mbak,
// Uncle, Ah...) stays outside the mark: titles may stay visible.
//
//   node test/names-measure.js heldout          (only before and after)

import { writeMarkedMatter, listMarks, realValues, trapWords } from '../names-marks.js';

export const FILES = [
  {
    rel: '01 Statement of Claim.docx', kind: 'docx', title: 'Statement of Claim', author: '«cn|Clarissa Ho»',
    body: `DALAM MAHKAMAH SESYEN DI JOHOR BAHRU
DALAM NEGERI JOHOR DARUL TA'ZIM, MALAYSIA
GUAMAN SIVIL NO: JA-B52NCvC-214-06/2025

ANTARA

«co|KEBUN HIJAU LANDSCAPE SDN BHD» (No. Syarikat: 201501023456)          ... PLAINTIF

«trap|DAN»

«co|OMBAK BIRU BUILDERS SDN BHD» (No. Syarikat: 200901034567)          ... DEFENDAN

STATEMENT OF CLAIM

1. The Plaintiff is a landscape contractor and plant nursery. Its managing director at all material times was Hajah «ml|Rosmawati binti Idris».
2. The Defendant was the main contractor for the landscaping works at the «co|Pantai Damai Resort» in Desaru, which is owned by «co|Pantai Damai Resort Sdn Bhd». The resort's general manager is Ms «in|Priya Ramanathan».
3. By a subcontract dated 14 January 2025 (the "Subcontract"), the Defendant engaged the Plaintiff to supply and plant 4,200 shrubs, palms and climbing «trap|rose» plants for RM 486,500.00, priced in the «trap|Bill» of Quantities annexed to it.
4. Clause 9.2 of the Subcontract gives the Defendant a «trap|grace» period of fourteen (14) days to pay each progress claim. "«trap|Grace» Period" is defined in Clause 1.1.
5. The Defendant's project manager, Mr «cn|Lee Chee Keong» (also known as «cn|Alvin Lee»), certified progress claims 1 to 3. Encik «ml|Kamal Hisham bin Abd Ghani», the Defendant's site supervisor, signed the delivery orders.
6. On or about 22 March 2025 the Defendant's lorry delivered 38 pallets of plants to the wrong site. The Plaintiff's nursery supervisor, «mono|Darsono», recorded the damage the same day.
7. The Plaintiff performed the Subcontract in good «trap|faith». The Defendant has failed to pay progress claims 4 and 5, totalling RM 171,240.00, despite demand.

AND THE PLAINTIFF CLAIMS:
(a) RM 171,240.00;
(b) interest at 5% a year from the date of filing; and
(c) costs.

Dated 18 June 2025

Messrs «co|Azura Leong & Partners»
Solicitors for the Plaintiff`,
  },
  {
    rel: '02 Witness Statement of «mono|Darsono».docx', kind: 'docx', title: 'Witness statement - «mono|Darsono»', author: '«cn|Clarissa Ho»',
    body: `WITNESS STATEMENT OF «mono|DARSONO»

I, «mono|Darsono» (Passport No. C4471829), of «co|Kebun Hijau» Nursery, Lot 2217, Jalan Kota Tinggi, 81900 Kota Tinggi, Johor, state as follows:

1. My name is «mono|Darsono». I have only one name, as is common in Java. I come from Ponorogo in East Java, Indonesia. I have worked at the Plaintiff's nursery since 2017 and I am the nursery supervisor.
2. The workers under me are «mono|Wagini», «mono|Paiman», «mono|Joko» and «mono|Indah». Everyone calls «mono|Paiman» "«nick|Pai»".
3. On 22 March 2025 Ibu «title|Ros» telephoned me at 7 am. Ibu «title|Ros» is what we call Hajah «title|Rosmawati». She told me that the Defendant's lorry had gone to the wrong site.
4. I went to the resort with Encik «title|Firdaus». The lorry driver, Ah «title|Seng», said that Mr «title|Alvin» had given him the wrong address. «mono|Joko» and «nick|Pai» helped me unload.
5. Many of the pallets were broken. Mbak «title|Wagini» counted 212 damaged «trap|rose» plants and 64 palms. I took photographs. I told «short|Firdaus» that the roses would not survive the heat.
6. I did not sign any delivery order that day. Encik «title|Kamal» from «co|Ombak Biru» was not there.
7. I «trap|hope» the court «trap|will» accept my evidence. I read English slowly; this statement was read to me in Bahasa Indonesia by Cik «title|Syahirah».

Signed: «mono|Darsono»
Date: 3 July 2025`,
  },
  {
    rel: '03 Witness statement - «short|Rosmawati».txt', kind: 'txt',
    text: `WITNESS STATEMENT OF HAJAH «ml|ROSMAWATI BINTI IDRIS»

I, Hajah «ml|Rosmawati binti Idris» (NRIC No. 680214-01-5528), of No. 7, Jalan Kenanga 3, Taman Sri Pelangi, 81200 Johor Bahru, Johor, state as follows:

1. I am the managing director of the Plaintiff. My staff call me Kak «title|Ros» and the Indonesian workers call me Ibu «title|Ros».
2. My eldest son, «ml|Mohd Firdaus bin Kamarul Ariffin» (known in the family as «nick|Along»), is the Plaintiff's operations manager. Our accountant is «cn|Vivien Teoh Pei Shan» and our clerk is «ml|Nurul Syahirah binti Zainal Abidin».
3. It is a «trap|long» story, but in short the Defendant never paid for the last two deliveries. I met Mr «cn|Lee Chee Keong» and Encik «ml|Kamal Hisham» at the site office on 2 April 2025. Mr «title|Lee» promised payment "by the end of «trap|May»". It never came.
4. The roses were imported from «co|Greenleaf Botanics Pte Ltd» in Singapore. Their Ms «cn|Grace Chua» arranged the shipment and gave us 60 days to pay. That «trap|grace» period was extended once.
5. «nick|Along» handled the lorries. «short|Firdaus» kept the WhatsApp records, which are exhibited.
6. Our driver, «in|Muniandy a/l Kuppusamy» ("«nick|Mani»"), has driven for us for twelve years. Uncle «title|Mani» was not involved on 22 March 2025.
7. I make this statement in good «trap|faith».

Hajah «ml|Rosmawati binti Idris»
3 July 2025
`,
  },
  {
    rel: '04 WhatsApp Chat with «co|Kebun Hijau» Team.txt', kind: 'txt',
    text: `22/03/2025, 06:58 - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them. Tap to learn more.
22/03/2025, 07:02 - Kak «chat|Ros»: «trap|Selamat» pagi semua. Lorry «co|Ombak Biru» pergi site salah!!
22/03/2025, 07:03 - Kak «chat|Ros»: «nick|Along», call «short|Alvin» now
22/03/2025, 07:05 - «chat|Daus»: Ok «trap|mak». On the way
22/03/2025, 07:06 - «chat|Darsono» Nursery: Baik ibu. Saya ikut Encik «title|Firdaus»
22/03/2025, 07:15 - «chat|Syira» Admin: Kak «title|Ros», DO no. 4471 ada dengan saya
22/03/2025, 07:40 - «chat|Daus»: Ah «title|Seng» says «lower|alvin» gave him the old address
22/03/2025, 07:41 - Kak «chat|Ros»: «trap|Dan» siapa sign DO tu?
22/03/2025, 07:44 - «chat|Darsono» Nursery: Tiada siapa sign ibu. Encik «title|Kamal» tak ada
22/03/2025, 08:20 - «chat|Darsono» Nursery: <Media omitted>
22/03/2025, 08:21 - «chat|Darsono» Nursery: Banyak pallet pecah. «lower|wagini» tengah kira
22/03/2025, 08:30 - «chat|Mani» Lorry: Kak «title|Ros», sy boleh ambil balik pokok «trap|ros» yang rosak?
22/03/2025, 08:31 - Kak «chat|Ros»: Tunggu dulu «nick|Mani». Tanya «lower|darsono» berapa yang boleh «trap|selamat»
22/03/2025, 09:02 - «chat|Daus»: «lower|pai» «trap|dan» «lower|joko» tolong unload. «trap|Mark» the pallets yg rosak with red tape ok
22/03/2025, 09:03 - «chat|Darsono» Nursery: Ok «trap|boss»
22/03/2025, 09:10 - «chat|Syira» Admin: noted. nanti «lower|syira» email gambar to «lower|clarissa»
22/03/2025, 09:12 - «chat|Daus»: «trap|Will» do the count by noon
22/03/2025, 11:47 - «chat|Darsono» Nursery: 212 pokok bunga «trap|ros» «trap|dan» 64 palm rosak. «lower|indah» tolong ambil gambar
22/03/2025, 11:50 - Kak «chat|Ros»: Terima kasih semua. «trap|Long» story, nanti «trap|mak» cerita
22/03/2025, 12:05 - «chat|Mani» Lorry: ok kak «lower|ros»
22/03/2025, 12:10 - Kak «chat|Ros»: Gambar resort tu cantik, pemandangan «trap|indah». Sayang pokok mati
`,
  },
  {
    rel: '05 WhatsApp Chat - «chat|Alvin» «co|Ombak Biru».txt', kind: 'txt',
    text: `[21/03/2025, 18:22:10] «chat|Firdaus Kamarul»: «short|Alvin», confirm tomorrow delivery to Desaru site B?
[21/03/2025, 18:25:41] «chat|Alvin» «co|Ombak Biru»: Yes bro. Ah «title|Seng» «trap|will» bring 38 pallets
[21/03/2025, 18:26:03] «chat|Alvin» «co|Ombak Biru»: «short|Mark» «trap|will» arrange the crane
[22/03/2025, 07:09:55] «chat|Firdaus Kamarul»: «short|Alvin» your lorry went to site A!! Kak «title|Ros» very angry
[22/03/2025, 07:12:30] «chat|Alvin» «co|Ombak Biru»: Sorry bro, ah «lower|seng» used the old DO. «lower|mark» says crane only tmr
[22/03/2025, 07:13:02] «chat|Firdaus Kamarul»: Who «trap|will» pay for the damage?
[22/03/2025, 07:20:47] «chat|Alvin» «co|Ombak Biru»: «trap|Will» check with «nick|Will» and revert
[22/03/2025, 07:21:15] «chat|Alvin» «co|Ombak Biru»: «short|May» is preparing the payment for claim 3 anyway
[02/04/2025, 21:04:33] «chat|Firdaus Kamarul»: Claim 4 still not paid. «trap|Grace» period over already
[02/04/2025, 21:30:12] «chat|Alvin» «co|Ombak Biru»: «lower|may» said the cheque is ready, wait for Dato sign
[02/04/2025, 21:31:40] «chat|Firdaus Kamarul»: ok. «trap|hope» so
`,
  },
  {
    rel: '06 File note - call with «short|Gareth».txt', kind: 'txt',
    text: `FILE NOTE
Matter: «co|Kebun Hijau» v «co|Ombak Biru»
Date: 9 April 2025
Attendance: «init|CH» (telephone, 25 mins)

called «lower|gareth» («co|ombak biru» QS) re progress claims 4 and 5. «lower|gareth» says the BQ quantities for the palms were overstated and «nick|Will» (their contracts manager) won't certify until remeasurement. told him the remeasurement clause has a «trap|grace» period and they are out of time. we need to «trap|mark» up the BQ ourselves.

«trap|long» story short: they want a 15% discount. «lower|gareth» said he «trap|will» speak to dato «lower|shamsul». he also said Ah «title|Keong» («short|Alvin») is no longer on the project.

also spoke to «lower|priya» (resort GM, «co|Pantai Damai») - she confirms the resort has paid «co|Ombak Biru» in full for the landscaping. «lower|priya» «trap|will» give a letter if we write to her. «short|Joy» from her team («en|Joy Santos», landscape coordinator) has photos of the wrong delivery.

pasted from the resort's email (9 Apr, 6.02pm):
"Hi «sign|Clarissa» - «short|Priya» asked me to confirm that «co|Pantai Damai» paid «co|Ombak Biru» in full for the landscaping package on 31 March. Happy to sign a letter. Cheers, «sign|Dan» («cn|Daniel Ong», Facilities Director)"

to do:
- «short|Hakim» to prepare the bundle of WhatsApp messages
- «short|Clarissa» to draft letter of demand, cc Puan «title|Azura»
- «short|Pei Shan» (client's accountant) to send the claims ledger
- ask kak «lower|ros» for the DO originals
- check whether «lower|darsono» can attend court (passport expires Oct)

«init|CH»
`,
  },
  {
    rel: '07 File note - site visit 24 March.txt', kind: 'txt',
    text: `FILE NOTE - SITE VISIT, DESARU, 24 MARCH 2025

Present: Puan «title|Azura», «short|Clarissa» (solicitors); Encik «title|Firdaus» and Pak «title|Darsono» (client); «mono|Wagini» and «mono|Paiman» (nursery workers).

1. Pak «title|Darsono» walked us through the damage. About 40% of the climbing «trap|rose» plants are dead. The «trap|rose» beds near the lobby were never planted.
2. «mono|Wagini» showed us her count sheet. «mono|Paiman» («nick|Pai») confirmed that nobody from «co|Ombak Biru» signed the DO.
3. «mono|Joko», another worker, says the lorry driver told him "«trap|boss» «short|Alvin» say go site A". «mono|Joko» has no surname; his passport just says «mono|JOKO».
4. «short|Firdaus» says the site supervisor, «short|Hisham», usually signs the DOs but was on leave that week.
5. It was a «trap|joy» to see the client's own nursery: the propagation sheds are well run. «trap|Mark» the pallets with exhibit numbers before they are moved.

Action: «short|Clarissa» to prepare witness statements for «mono|Darsono» and «mono|Wagini». Ask «short|Firdaus» whether «mono|Indah» can give evidence too.
`,
  },
  {
    rel: '08 Email «short|Gareth» to «short|Firdaus».eml', kind: 'eml',
    text: `From: "«en|Gareth Pennington»" <qs.desaru@ombakbiru.example>
To: "«ml|Firdaus Kamarul»" <ops@kebunhijau.example>
Cc: "«cn|William Teo»" <contracts@ombakbiru.example>, "«en|Mark Fernandez»" <logistics@ombakbiru.example>
Subject: Remeasurement of palms - Desaru
Date: Thu, 10 Apr 2025 10:15:00 +0800
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Hi «sign|Daus»,

Thanks for your time on site yesterday. As discussed, «nick|Will» has asked me to remeasure the palms before we certify claims 4 and 5. «short|Mark» «trap|will» send the crane schedule separately.

We «trap|will» need your supervisor to attend. I understand Pak «title|Darsono» knows the planting layout best. If he is not available, «mono|Wagini» can stand in.

Please also note that under clause 9.2 the «trap|grace» period only starts once a claim is certified, so we do not accept that payment is overdue.

«trap|Hope» that clarifies.

Thanks,
«sign|Gareth»

«en|Gareth Pennington» MRICS
Senior Quantity Surveyor | «co|Ombak Biru Builders Sdn Bhd»
T: +60 7-388 2104
`,
  },
  {
    rel: '09 Email «cn|May Leong» re payment.eml', kind: 'eml',
    text: `From: "«cn|May Leong»" <«em|may».«em|leong»@ombakbiru.example>
To: "«ml|Nurul Syahirah»" <admin@kebunhijau.example>
Subject: RE: Payment of progress claim 4
Date: Mon, 5 «trap|May» 2025 16:40:00 +0800
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Dear Cik «title|Syahirah»,

«trap|May» we remind you that all claims must be supported by signed delivery orders. Claim 4 is missing the DOs for 22 March. We «trap|may» process payment once these are received. Payment «trap|will» be by cheque signed by Dato' Haji «ml|Shamsul Bahrin bin Ramli».

Regards,
«sign|May»
Accounts Executive
«co|Ombak Biru Builders Sdn Bhd»

-----Original Message-----
From: «ml|Nurul Syahirah» <admin@kebunhijau.example>
Sent: Friday, 2 «trap|May» 2025 11:02
To: «cn|May Leong» <«em|may».«em|leong»@ombakbiru.example>
Subject: Payment of progress claim 4

Salam Puan «title|May»,

Mohon semak status bayaran tuntutan kemajuan 4. Invois «trap|dan» DO telah dihantar pada 8 April 2025. «trap|Dan» Puan «title|Rosmawati» minta pengesahan secepat mungkin.

Terima kasih,
«sign|Syira»
«co|Kebun Hijau Landscape Sdn Bhd»
`,
  },
  {
    rel: '10 Progress claims ledger.xlsx', kind: 'xlsx', sheet: 'Claims',
    rows: [
      ['Claim', 'Invoice', 'Date submitted', 'Amount (RM)', 'Certified by', 'Paid', 'Notes'],
      [1, 'KH-INV-0412', '3 Feb 2025', 92400, '«short|Alvin»', 'Yes', ''],
      [2, 'KH-INV-0438', '3 Mar 2025', 118600, '«short|Alvin»', 'Yes', 'DO signed by K. «short|Hisham»'],
      [3, 'KH-INV-0461', '1 Apr 2025', 104260, '«short|Alvin»', 'Yes', 'Cheque collected by «nick|Mani»'],
      [4, 'KH-INV-0477', '8 Apr 2025', 96880, '(not certified)', 'No', '«nick|Will» to remeasure palms'],
      [5, 'KH-INV-0502', '6 «trap|May» 2025', 74360, '(not certified)', 'No', 'Per Kak «title|Ros»: chase «short|May» weekly'],
      ['Prepared by', '«short|Vivien» T.', '', '', 'Checked by', 'Mdm «title|Teoh»', ''],
    ],
  },
  {
    rel: '11 Letter of demand.docx', kind: 'docx', title: 'Letter of demand - «co|Ombak Biru»', author: '«cn|Clarissa Ho»',
    body: `«co|AZURA LEONG & PARTNERS»
Advocates & Solicitors
Suite 12-3, Menara Tebrau, Jalan Tebrau, 80250 Johor Bahru

Our ref: AZLP/LIT/2025/0193
Date: 16 «trap|May» 2025

BY HAND AND EMAIL

«co|Ombak Biru Builders Sdn Bhd»
Lot 15, Jalan Perindustrian Senai 4
81400 Senai, Johor

Attention: Mr «cn|Lee Chee Keong» (Project Manager)

Dear Sirs,

«co|KEBUN HIJAU LANDSCAPE SDN BHD» - PROGRESS CLAIMS 4 AND 5 - «co|PANTAI DAMAI RESORT», DESARU

We act for «co|Kebun Hijau Landscape Sdn Bhd» ("our client").

Our client has performed the Subcontract in good «trap|faith». Progress claims 4 and 5, totalling RM 171,240.00, remain unpaid. The «trap|grace» period under clause 9.2 expired on 22 April 2025 for claim 4. Your Mr «en|Gareth Pennington»'s suggestion that the «trap|grace» period has not started is rejected.

Your Mr «cn|Alvin Lee» admitted in writing on 22 March 2025 that your driver delivered to the wrong site. We have copies of those messages.

TAKE NOTICE that unless the sum of RM 171,240.00 is paid within 14 days, we have instructions to commence proceedings without further notice. We trust this «trap|will» not be necessary.

Yours faithfully,


«ml|Azura binti Mat Saman»
Partner
c.c. Client (Attn: Hajah «title|Rosmawati» / Encik «title|Firdaus»)`,
  },
  {
    rel: '12 Foreign workers list.xlsx', kind: 'xlsx', sheet: 'Workers',
    rows: [
      ['No', 'Name', 'Passport', 'Nationality', 'Position', 'Permit expiry', 'Supervisor'],
      [1, '«mono|DARSONO»', 'C4471829', 'Indonesia', 'Nursery supervisor', '30 Oct 2025', 'Kak «title|Ros»'],
      [2, '«mono|WAGINI»', 'C5120376', 'Indonesia', 'General worker', '12 Jan 2026', '«mono|Darsono»'],
      [3, '«mono|PAIMAN»', 'C4893015', 'Indonesia', 'General worker', '12 Jan 2026', '«mono|Darsono»'],
      [4, '«mono|JOKO»', 'C5207741', 'Indonesia', 'General worker', '4 Mar 2026', '«mono|Darsono»'],
      [5, '«mono|INDAH»', 'C5311968', 'Indonesia', 'General worker', '4 Mar 2026', '«mono|Darsono»'],
      [6, '«mono|SUMARNI»', 'C5009214', 'Indonesia', 'Packer', '19 Aug 2025', '«mono|Wagini»'],
    ],
  },
  {
    rel: "13 Reply from defendant's solicitors.pdf", kind: 'pdf',
    lines: [
      '«co|K.S. RAO & CO»', 'Advocates & Solicitors, Johor Bahru', '',
      'Your ref: AZLP/LIT/2025/0193', 'Our ref: KSR/OB/88/2025', '28 «trap|May» 2025', '',
      'Messrs «co|Azura Leong & Partners»', 'Johor Bahru', '', 'Dear Sirs,', '',
      'RE: «co|KEBUN HIJAU LANDSCAPE SDN BHD» - PROGRESS CLAIMS 4 AND 5', '',
      'We act for «co|Ombak Biru Builders Sdn Bhd» and refer to your letter dated 16 «trap|May» 2025.', '',
      '1. Our client denies that any sum is due. Claims 4 and 5 were never certified.',
      "2. The delivery of 22 March 2025 was accepted on site by your client's worker, one «mono|Joko», who",
      "has since left your client's employment.",
      "3. Our client's Mr «cn|William Teo» «trap|will» attend the joint remeasurement. Our client reserves",
      'all its rights, including the right to set off the cost of the damaged pallets.', '',
      'Yours faithfully,', '«co|K.S. Rao & Co»',
    ],
  },
  {
    rel: '14 Interview notes - «nick|Mani».txt', kind: 'txt',
    text: `interview - uncle «lower|mani» (driver) - 12 june 2025 - by «lower|hakim»

- full name «in|Muniandy a/l Kuppusamy», 61, has driven the 3-tonne lorry for the nursery since 2013
- everyone at the nursery calls him Uncle «title|Mani» or just «nick|Mani»
- on 22/3 «lower|mani» was at the Senai store, not at desaru. he only heard about it from «nick|Daus» by phone
- says ah «lower|seng» («co|ombak biru» driver) is "always like that, never check DO"
- «lower|mani» says the pokok «trap|ros» were already wilting when they came back to the nursery
- he «trap|will» come to court if needed but «trap|may» need a Tamil interpreter (check with Puan «title|Azura»)
- he mentioned that «lower|may» from «co|ombak biru» accounts called him once about a cheque - not sure why
`,
  },
  {
    rel: '15 Email from «co|Greenleaf Botanics».eml', kind: 'eml',
    text: `From: "«cn|Grace Chua»" <sales@greenleaf-botanics.example>
To: "«ml|Rosmawati Idris»" <md@kebunhijau.example>
Cc: "«cn|Kelvin Tay»" <«em|kelvin».«em|tay»@greenleaf-botanics.example>
Subject: Shipment GL-2025-031 - climbing roses
Date: Tue, 4 Mar 2025 09:05:00 +0800
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Dear Puan «title|Rosmawati»,

Thank you for your order of 1,500 climbing «trap|rose» plants (variety '«trap|Pierre» de Ronsard') and 300 Chinese fan palms. «short|Kelvin» «trap|will» coordinate the reefer container to Pasir Gudang.

As a «trap|long»-standing customer you have a «trap|grace» period of 60 days from the «trap|bill» of lading date. «trap|Hope» the roses do well in Desaru - it is always a «trap|joy» to supply your nursery.

Best regards,
«sign|Grace»

«cn|Grace Chua Hui Min»
Key Accounts | «co|Greenleaf Botanics Pte Ltd»
21 Sungei Tengah Road, Singapore 699012
`,
  },
];

/** Writes the held-out files into `dir`. */
export function makeHeldout(dir) {
  return writeMarkedMatter(dir, FILES);
}

/** Every real value that must not appear in a cloaked copy, with its kinds and files. */
export const REAL_VALUES = realValues(listMarks(FILES));
/** Every ordinary word that must stay readable, with how often it appears. */
export const TRAPS = trapWords(listMarks(FILES));

/** What a lawyer would type at setup for this matter. */
export const SETUP = { client: 'Kebun Hijau Landscape Sdn Bhd', others: 'Ombak Biru Builders Sdn Bhd' };
