// DEVELOPMENT made-up matter for the name rules. The rules are developed and
// checked against this matter (and test/names.test.js), never against the
// held-out matter in test/heldout/.
//
// Every person, company, number and address here is invented. The story: a
// family restaurant in George Town (Dapur Mak Long) rented a shop lot from a
// landlord (Teik Choon Properties). The landlord's contractor botched the
// kitchen exhaust, the council closed the kitchen, and rent and damages are
// in dispute.
//
// Marks work as in test/heldout/make.js: «kind|Name» is a real name,
// «trap|word» an ordinary word that must stay readable.
//
//   node test/names-measure.js namesdev [--details]

import { writeMarkedMatter, listMarks, realValues, trapWords } from '../names-marks.js';

export const FILES = [
  {
    rel: '01 Writ of Summons.docx', kind: 'docx', title: 'Writ', author: '«cn|Jeremy Ng»',
    body: `DALAM MAHKAMAH TINGGI MALAYA DI PULAU PINANG
GUAMAN SIVIL NO: PA-22NCvC-77-02/2024

ANTARA

«co|DAPUR MAK LONG SDN BHD» (No. Syarikat: 201801004321)     ... PLAINTIF

«trap|DAN»

«co|TEIK CHOON PROPERTIES SDN BHD» (No. Syarikat: 199601012233)     ... DEFENDAN

PERNYATAAN TUNTUTAN

1. Plaintif mengendalikan sebuah restoran di premis tersebut. Pengarah Plaintif ialah Puan «ml|Normala binti Jaafar» (juga dikenali sebagai Kak «title|Mala»).
2. Defendan ialah tuan punya premis. Pengarah Defendan ialah «cn|Khoo Teik Choon», yang «trap|dan» kontraktornya «co|Hock Lee Renovation Enterprise» telah memasang sistem ekzos dapur.
3. Pada 4 Mac 2024 seorang pegawai kesihatan, Encik «title|Zahir», telah menutup dapur Plaintif. «trap|Dan» Plaintif terpaksa menutup restoran selama 41 hari.
4. Sewa bulanan «trap|rose» from RM 6,500 to RM 8,000 in January 2024 although the works were never finished. The Defendant acted in bad «trap|faith».
5. Plaintif menuntut ganti rugi «trap|dan» pemulangan deposit.

Bertarikh 20 Februari 2024

Tetuan «co|Hamdan, Ng & Associates»
Peguamcara bagi pihak Plaintif`,
  },
  {
    rel: '02 Afidavit «mono|Margono».docx', kind: 'docx', title: 'Afidavit «mono|Margono»', author: '«cn|Jeremy Ng»',
    body: `AFIDAVIT «mono|MARGONO»

Saya, «mono|Margono» (No. Pasport: B7712345), warganegara Indonesia, beralamat di No. 14, Lorong Kampung Malabar, 10100 George Town, Pulau Pinang, dengan sesungguhnya berikrar «trap|dan» menyatakan seperti berikut:

1. Nama saya «mono|Margono». Saya hanya mempunyai satu nama. Saya bekerja sebagai tukang masak di restoran Plaintif sejak 2019.
2. Pembantu saya ialah «mono|Sutinah» «trap|dan» seorang pencuci pinggan bernama «mono|Rubel».
3. Pada 4 Mac 2024, Bu «title|Mala» menyuruh saya menutup dapur. Kak «title|Kala» juga ada di situ.
4. Saya pernah memberitahu «nick|Angah» bahawa ekzos itu berbunyi kuat. Ah «title|Wah» berkata ia akan dibaiki.

Diikrarkan oleh «mono|Margono» di George Town pada 1 April 2024.`,
  },
  {
    rel: '03 WhatsApp Chat with Dapur Staff.txt', kind: 'txt',
    text: `02/03/24, 8:01 pm - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
02/03/24, 8:05 pm - Kak «chat|Mala»: Assalamualaikum semua. Esok buka pukul 11
02/03/24, 8:07 pm - «chat|Kala» Manager: Ok kak. «lower|margono» cuti ke esok?
02/03/24, 8:09 pm - «chat|Margono» Dapur: Tidak bu, saya masuk
02/03/24, 8:15 pm - «chat|Angah»: Customer complain the «trap|bill» wrong again. «lower|kala» pls check
02/03/24, 8:16 pm - «chat|Kala» Manager: Noted «lower|angah». «trap|Will» check tomorrow
02/03/24, 8:30 pm - +60 12-778 9012: Hi this is «mono|Rubel», «nick|Wah» «trap|boss» ask me to check the ekzos tmr morning
02/03/24, 8:31 pm - Kak «chat|Mala»: ok. «lower|sutinah» tolong buka pintu belakang untuk dia
04/03/24, 11:42 am - «chat|Kala» Manager: Encik «title|Zahir» from MBPP here. He says kitchen must close
04/03/24, 11:43 am - Kak «chat|Mala»: Ya Allah. «trap|Dan» deposit kita macam mana?
04/03/24, 11:45 am - «chat|Angah»: «trap|wah» so fast. I call uncle «lower|khoo» now
04/03/24, 11:50 am - «chat|Kala» Manager: «lower|zahir» says secara «trap|zahir» the exhaust looks ok but the motor is wrong
04/03/24, 12:02 pm - «chat|Margono» Dapur: Bu «title|Mala», «trap|mala» chicken order semua cancel?
04/03/24, 12:03 pm - Kak «chat|Mala»: Ya cancel. «trap|Sunny» day pun takde customer kadang-«trap|kala»
04/03/24, 12:10 pm - «chat|Angah»: «trap|Will» update all of you tonight
`,
  },
  {
    rel: '04 WhatsApp Chat - «chat|Raymond» Agent.txt', kind: 'txt',
    text: `[1/3/24, 10:02:11] «chat|Aiman Hakimi»: Hi «sign|Ray», the exhaust still not fixed. Uncle «title|Khoo» know or not?
[1/3/24, 10:05:40] «chat|Raymond» Agent: Hi «short|Aiman». Already told Mr «title|Khoo». «nick|Wah» «trap|will» send his worker
[1/3/24, 10:06:02] «chat|Raymond» Agent: The worker name «mono|Rubel», he «trap|will» call you
[5/3/24, 09:15:33] «chat|Aiman Hakimi»: Kitchen closed by MBPP yesterday. Who «trap|will» pay?
[5/3/24, 09:40:12] «chat|Raymond» Agent: Let me check with «short|Bill» first. «lower|bill» handles the tenancy files
[5/3/24, 09:41:00] «chat|Aiman Hakimi»: ok. «trap|hope» settle fast
`,
  },
  {
    rel: '05 File note - meeting with «short|Kalaivani».txt', kind: 'txt',
    text: `FILE NOTE
Matter: «co|Dapur Mak Long» v «co|Teik Choon Properties»
Date: 8 March 2024
Attendance: «init|JN»

Present: Puan «title|Mazlina», «short|Jeremy» (us); Puan «title|Normala», «short|Kala» (client)

met «lower|kala» and «lower|angah» at the shop. «lower|kala» says the landlord's agent «lower|ray» promised the exhaust would be fixed before CNY. uncle «lower|khoo» never came himself.

the contractor's foreman, Ah «title|Wah», told «short|Kala» the motor was the wrong size. a worker called «mono|Rubel» did the wiring.

«short|Adlina» to get the MBPP closure notice. «short|Sharon» to open a new file.
as «trap|long» as the rent dispute goes on, client «trap|will» pay into a stakeholder account.

«init|JN»
`,
  },
  {
    rel: '06 Email from «short|Raymond».eml', kind: 'eml',
    text: `From: "«cn|Raymond Chew»" <agent.penang@rumahmaju.example>
To: "«ml|Normala Jaafar»" <«em|normala»@dapurmaklong.example>
Subject: Shop lot 22 - exhaust works
Date: Wed, 6 Mar 2024 17:20:00 +0800
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Dear Puan «title|Normala»,

I refer to our call. Mr «title|Khoo» has asked «short|Sunny» from «co|Hock Lee» to send someone tomorrow. «short|Bill» from our office «trap|will» attend.

«trap|Sunny» weather is forecast, so the roof work can go ahead. We «trap|hope» the kitchen can reopen next week.

Rgds,
«sign|Ray»
«cn|Raymond Chew» | Property Agent
`,
  },
  {
    rel: '07 Email to «short|Bernice» (accounts).eml', kind: 'eml',
    text: `From: "«short|Adlina» («co|Hamdan Ng»)" <pupil@hamdanng.example>
To: "«cn|Bernice Ooi»" <accounts@dapurmaklong.example>
Cc: "«cn|Jeremy Ng»" <«em|jeremy»@hamdanng.example>
Subject: Rent receipts for 2023
Date: Fri, 8 Mar 2024 10:02:00 +0800
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Hi «sign|Bernice»,

Could you send us the rent receipts for 2023? «short|Jeremy» needs them by Monday. Puan «title|Normala» said you keep the originals.

Thank you,
«sign|Adlina»

----- Reply -----
Noted, «trap|will» send. Thanks, «sign|Bernice»
`,
  },
  {
    rel: '08 Senarai pekerja.xlsx', kind: 'xlsx', sheet: 'Pekerja',
    rows: [
      ['Bil', 'Nama', 'Jawatan', 'No. Pasport / KP', 'Penyelia'],
      [1, '«mono|MARGONO»', 'Tukang masak', 'B7712345', 'Kak «title|Mala»'],
      [2, '«mono|SUTINAH»', 'Pembantu dapur', 'B8023456', '«mono|Margono»'],
      [3, '«mono|RUBEL»', 'Pencuci (kontrak)', 'BX0912345', '«short|Kala»'],
      [4, '«in|KALAIVANI A/P RAJENDRAN»', 'Pengurus', '870304-07-5566', 'Kak «title|Mala»'],
    ],
  },
  {
    rel: '09 Renovation invoices.xlsx', kind: 'xlsx', sheet: 'Invoices',
    rows: [
      ['Invoice', 'Date', 'Amount (RM)', 'Received by', 'Approved by', 'Remarks'],
      ['HL-2201', '5 Jan 2024', 12800, '«short|Kala»', '«short|Aiman»', 'deposit for exhaust'],
      ['HL-2214', '19 Jan 2024', 9400, 'Ah «title|Wah»', '«short|Aiman»', 'motor - wrong size?'],
      ['HL-2240', '2 Feb 2024', 3150, '«mono|Rubel»', '«short|Kala»', 'wiring'],
    ],
  },
  {
    rel: '10 Statement of «short|Kalaivani».txt', kind: 'txt',
    text: `STATEMENT OF «in|KALAIVANI A/P RAJENDRAN»

I, «in|Kalaivani a/p Rajendran» (NRIC No. 870304-07-5566), of 3, Jalan Sungai Pinang, 10150 George Town, say as follows:

1. I am the manager of the restaurant. Everyone at the restaurant calls me «nick|Kala».
2. The landlord, Mr «cn|Khoo Teik Choon», whom the staff call Uncle «title|Khoo», visited only once.
3. His agent, «cn|Raymond Chew» ("«nick|Ray»"), dealt with us. The contractor's foreman, Ah «title|Wah», came most days with a worker called «mono|Rubel».
4. Our cook, «mono|Margono», warned «short|Aiman» about the noise in February. My «trap|boss»'s son, «ml|Muhammad Aiman Hakimi bin Rosli», is known in the family as «nick|Angah».
5. I make this statement knowing it «trap|will» be used in court.
`,
  },
  {
    rel: "11 Letter from landlord's solicitors.pdf", kind: 'pdf',
    lines: [
      '«co|RAVINDRAN CHEE & CO»', 'Advocates & Solicitors, Penang', '',
      '15 March 2024', '', 'Tetuan «co|Hamdan, Ng & Associates»', '', 'Dear Sirs,', '',
      'We act for «co|Teik Choon Properties Sdn Bhd».',
      "1. The exhaust was installed by one «mono|Rubel» on the instructions of your client's manager.",
      "2. Our client's Mr «cn|Bill Chandran» attended the premises on 7 March 2024 and found it working.",
      '3. Rent remains payable in full. Our client reserves its rights.', '',
      'Yours faithfully,', '«co|Ravindran Chee & Co»',
    ],
  },
  {
    rel: '12 Notes of call with MBPP.txt', kind: 'txt',
    text: `call with MBPP health unit, 11 March 2024 (by «lower|adlina»)

- spoke to Encik «title|Zahir» (the officer who closed the kitchen)
- per «short|Zahir», the closure was because the exhaust motor overheated, not the hygiene of the kitchen
- «lower|zahir» «trap|will» email the inspection report to us
- he asked whether «lower|margono» is still the head cook
`,
  },
  {
    rel: '13 Email thread - «short|Aiman» and «cn|Yeap Kok Wah».eml', kind: 'eml',
    text: `From: "«cn|Yeap Kok Wah»" <hockleereno@mail.example>
To: "«ml|Muhammad Aiman Hakimi»" <«em|aiman»@dapurmaklong.example>
Subject: RE: Exhaust motor
Date: Thu, 7 Mar 2024 08:30:00 +0800
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

Salam «sign|Aiman»,

Motor sudah ditukar semalam. «mono|Rubel» «trap|dan» saya akan datang lagi hari Isnin untuk uji.

Terima kasih,
«sign|Kok Wah»
«co|Hock Lee Renovation Enterprise»

> Hi Ah «title|Wah»,
> The motor is still too loud. Please send «mono|Rubel» again.
> Salam,
> «sign|Aiman»
`,
  },
];

/** Writes the development files into `dir`. */
export function makeNamesdev(dir) {
  return writeMarkedMatter(dir, FILES);
}

export const REAL_VALUES = realValues(listMarks(FILES));
export const TRAPS = trapWords(listMarks(FILES));
export const SETUP = { client: 'Dapur Mak Long Sdn Bhd', others: 'Teik Choon Properties Sdn Bhd' };
