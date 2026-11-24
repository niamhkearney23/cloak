// Word lists for finding Malaysian names without an AI model. A run of
// capitalised words is treated as a person when it has a name particle
// (bin, a/l...), follows a title, sits next to an NRIC, or contains a word
// from these lists. Everything else capitalised goes to the "not sure" list.

const words = (s) => new Set(s.split(/\s+/).filter(Boolean).map((w) => w.toLowerCase()));

// Romanised Chinese surnames common in Malaysia and Singapore.
export const CHINESE_SURNAMES = words(`
  Tan Lim Lee Wong Ng Chan Chong Cheong Teo Goh Ong Koh Low Lau Yap Chin Chua Foo Khoo Liew Leong Loh Yeoh Yong Tay Teh Toh Sim Soh
  Ang Chew Chia Heng Kok Lai Lam Liu Loo Mah Mok Neo Ooi Pang Phang Phua Poh Quek Seah Seow Siew Sia Tee Thong Ting Tiong Woo Yee Yeo
  Yip Yuen Zhang Wang Chen Lin Huang Zhou Xu Hoo Hew Kee Khor Kuan Kwan Kho Lok Lum Mak Ngu Pua Saw Tham Voon Yau Gan Fong Fung
  Cheah Cheng Chee Choo Choong Chow Choy Chu Chung Hor Kam Kang Ling Beh Bong Chai Cham Chang Chiew Chooi Diong Gooi Hii Jong Kiew
  Koay Kueh Lian Liang Ngeow Ngoi Oon Peh Pek Png Poon Puah Shum Sii Siow Soo Tai Tam Tiew Tsen Ung Yang Yao Yaw Yek Yim Yiu Yoong
  Kwok Kuek Kueh Leow Lio Loke Looi Lua Moey Ngan Ngiam Ooh Pui Seet Sng Tiang Tok Wee Yeap Yeow Yoon Aw Bok Chiam Chiang Chuah Eu
  Gwee Hiew Hoh Khaw Kiang Kiong Koo Kuok Kwek Lew Lih Lye Ngai Onn Ooi Sek Sieh Sin Soong Thien Tioh Wah Wai Yeh Yiap Hwang Kuang
  Lau Leung Cheung Ho Hui Kwong Tsang Tse Tsui Yeung
`);
// Surnames that are also ordinary English words or places: need more evidence.
export const AMBIGUOUS = words('Law Long See Soon Man Yam Sum Kong Hong Wan Tong Eng Oh Ko Yu Lo Lu Ku Su Wu Li Hu Pan May Grace Hope Joy Bin Mark Bill Will Rose Sin Tang Ee Ou Ho');

// First words of Malay / Muslim names and common given names.
export const MALAY_NAMES = words(`
  Mohd Mohamad Mohamed Mohammad Mohammed Muhammad Muhamad Muhammed Md Ahmad Abdul Abd Nur Nurul Noor Nor Noorul Siti Wan Nik Che Syed
  Sharifah Syarifah Tengku Tunku Raja Megat Puteri Putri Awang Dayang Abang Ku Engku Ungku Sayed Sheikh Syeikh
  Ali Abu Bakar Omar Umar Osman Othman Uthman Ismail Ibrahim Yusof Yusuf Yusoff Hassan Hasan Hussein Hussain Husin Hashim Hamid Hamzah
  Rahman Rahim Razak Rashid Rosli Roslan Rahmat Ramli Salleh Salim Samad Sulaiman Suleiman Zainal Zainuddin Zakaria Zulkifli Zulkarnain
  Aziz Azman Azmi Azhar Azlan Azizi Amin Amir Anuar Anwar Arif Ariff Ariffin Badrul Baharuddin Bakri Daud Fadzil Faizal Faisal Fauzi
  Farid Firdaus Ghazali Hafiz Haikal Hakim Halim Hanafi Haris Harun Haziq Idris Iskandar Jamal Jamil Johari Kamal Kamarul Karim Khairul
  Khalid Latif Luqman Mahmud Mansor Mazlan Mokhtar Mustafa Mustapha Nasir Nazri Nizam Nordin Rafiq Redzuan Ridzuan Rizal Saiful Shafie
  Shahrul Shamsul Shukri Sufian Syafiq Syahmi Tajuddin Taufik Wahid Yahya Yazid Zahari Zahid Zaidi Zaki Zamri Zul
  Aminah Aishah Aisyah Aida Aini Amirah Asmah Azizah Azlina Fatimah Faridah Farah Fazlina Halimah Hamidah Hasnah Haslinda Hazwani
  Intan Izzati Jamilah Kamariah Khadijah Latifah Mariam Maryam Mariah Maznah Nabila Nadia Nadiah Najwa Natasha Norazlina Norhayati
  Noraini Normah Norliza Nurhaliza Rahimah Rohani Rohana Rokiah Rosnah Roziah Rubiah Sakinah Salmah Salwa Saodah Shahirah Suhaila
  Suraya Syazwani Zainab Zaleha Zarina Zubaidah Zuraidah Hidayah Hanim Liyana Balqis
`);

export const INDIAN_NAMES = words(`
  Ravi Kumar Suresh Rajesh Ramesh Mahesh Ganesh Dinesh Muthu Siva Sivakumar Subramaniam Subramanian Krishnan Krishna Raj Raja Rajan
  Rajendran Rajagopal Devi Lakshmi Letchumi Priya Anand Ananda Mohan Vijay Vijayan Arun Arumugam Balakrishnan Bala Gopal Gopalan
  Kannan Letchumanan Maniam Manickam Murugan Nair Pillai Ramasamy Ramachandran Raman Ramu Selvam Selvaraj Singh Kaur Sundaram
  Thanabalan Vasudevan Veerasamy Velu Vellu Samy Sami Sinnathamby Thambi Perumal Ponnusamy Palaniappan Nadarajah Nagarajan Narayanan
  Govindasamy Govindan Karuppiah Kandasamy Jeyakumar Jayakumar Jegathesan Marimuthu Munusamy Sangaran Sankar Shankar Saravanan
  Sathiah Sathasivam Tharma Thevar Chandran Chandra Kalai Kavitha Malar Meena Parameswary Pushpa Rani Saraswathy Shanti Shanthi
  Sumathi Thilaga Uma Vasantha Vimala Yogeswaran Sivalingam Paramasivam Kuppusamy Doraisamy Annamalai Appu Appalanaidu Naidu Reddy
  Menon Iyer Patel Gill Sidhu Dhillon Sandhu Gurdip Harjit Jaswant Karpal Manjit Baljit Sukhdev Amarjit Darshan Kuldip
`);

export const ENGLISH_NAMES = words(`
  John David Michael Mary Sarah James Robert Peter Paul Andrew Daniel Mathew Matthew Thomas Stephen Steven Richard William George
  Edward Henry Charles Joseph Anthony Kevin Brian Jason Eric Alan Allan Simon Adrian Jonathan Christopher Nicholas Benjamin Samuel
  Alexander Patrick Vincent Raymond Francis Philip Phillip Gerald Kenneth Dennis Jeffrey Gary Ronald Timothy Elizabeth Jennifer
  Susan Margaret Catherine Katherine Anne Ann Anna Emily Jessica Michelle Amanda Melissa Stephanie Rebecca Laura Karen Nancy Linda
  Patricia Barbara Helen Joyce Irene Janet Alice Agnes Angela Christina Christine Diana Evelyn Florence Jacqueline Josephine Lilian
  Rachel Sharon Sandra Theresa Veronica Vivian Wendy Niamh Sean Liam Aidan Conor Emma Sophie Olivia Lucy Claire Fiona Julia Julie
  Jane Jean Joan Judy Kelly Kim Lisa Lynn Maria Martin Nigel Oliver Oscar Roger Ross Ryan Scott Shaun Stanley Terence Trevor Victor
  Walter Wayne Albert Alfred Arthur Bernard Bruce Carl Cecil Clement Colin Derek Desmond Dominic Douglas Edmund Edwin Ernest Eugene
  Felix Frederick Geoffrey Gilbert Gordon Graham Gregory Harold Herbert Howard Ian Isaac Ivan Jack Jacob Jeremy Jerome Joel Jordan
  Joshua Julian Justin Keith Lawrence Leonard Leslie Louis Malcolm Marcus Maurice Melvin Neil Nelson Norman Percy Ralph Reginald
  Rodney Roland Roy Rupert Russell Sebastian Sidney Stuart Theodore Tony Winston Adeline Audrey Beatrice Bernadette Cecilia Charlotte
  Cheryl Cynthia Daphne Deborah Doreen Doris Eileen Elaine Eleanor Esther Eunice Felicia Gloria Hannah Jasmine Jocelyn Juliana
  Lorraine Lydia Mabel Madeline Marilyn Melanie Monica Natalie Pamela Pauline Priscilla Rosalind Ruth Samantha Selina Serena Shirley
  Sylvia Tiffany Valerie Vanessa Victoria Winnie Yvonne
`);

export const NAME_WORDS = new Set([...CHINESE_SURNAMES, ...MALAY_NAMES, ...INDIAN_NAMES, ...ENGLISH_NAMES]);

// Name starters that link too many people if used on their own as a short
// form ("Mohd", "Siti"): they are only matched as part of a longer name.
export const GENERIC_PARTS = words('Mohd Mohamad Mohamed Mohammad Mohammed Muhammad Muhamad Muhammed Md Abdul Abd Nur Nurul Noor Nor Noorul Siti Wan Nik Che Syed Sharifah Syarifah Tengku Tunku Raja Megat Puteri Putri Awang Dayang Abang Ku Engku Ungku Sayed Sheikh Syeikh Haji Hajah Hj Hjh Al Ah');

// Titles that stay in the text ("Encik {{PERSON_1.FIRST}}").
export const GENERIC_TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Mdm', 'Madam', 'Encik', 'En', 'Puan', 'Pn', 'Cik', 'Tuan', 'Dr', 'Prof', 'Professor', 'Ir', 'Ar', 'Ts', 'Haji', 'Hajah', 'Hj', 'Hjh', 'Sir', 'Cikgu', 'Ustaz', 'Ustazah', 'Inspector', 'Insp', 'Sergeant', 'Sgt', 'Sjn', 'Kpl', 'Cpl', 'ASP', 'DSP', 'Supt', 'Justice', 'Judge', 'Hakim'];
// Honours that identify a person: hidden together with the name.
export const HONOURS = ['Yang Amat Berhormat', 'Yang Berhormat', 'Yang Berbahagia', 'Yang Mulia', 'YAB', 'YBhg', 'YB', 'YM', 'Tan Sri', 'Puan Sri', 'Toh Puan', "Dato' Seri", "Dato' Sri", 'Dato Seri', 'Dato Sri', 'Datuk Seri', 'Datuk Sri', 'Datin Seri', 'Datin Sri', "Dato'", 'Dato’', 'Datuk', 'Datin', 'Dato', 'Tun', 'Toh'];

// Informal titles written before a single name in Malaysian and Singapore
// documents, chats and notes: family and respect words, Indonesian address
// words, and the Chinese "Ah". Like the titles above they stay in the text
// ("Kak {{PERSON_1}}", "Ah {{PERSON_2}}"). They only count as a title when the
// word before them is not part of a name ("Tan Ah Kow" is one name).
export const KIN_TITLES = ['Mak Cik', 'Makcik', 'Pak Cik', 'Pakcik', 'Kakak', 'Kak', 'Abang', 'Abg', 'Adik', 'Dik', 'Pak', 'Mak', 'Uncle', 'Aunty', 'Auntie', 'Ibu', 'Bu', 'Mbak', 'Inche', 'Ah'];
// Birth-order words. After a family title they are part of the title ("Mak
// Long" is the eldest aunt, "Pak Ngah" the second uncle), not a name.
export const BIRTH_ORDER = words('Long Ngah Lang Teh Chik Cik Su Busu Usu Ucu Uda Andak Itam Uteh Along Angah Alang Achik Acik');

// Names that are also ordinary English or Malay words. A known name in this
// list is never hidden where it is written in lowercase as an ordinary word
// ("grace period", "a joy", "dan", "bunga ros"), and a capitalised one at the
// start of a sentence is only hidden when the words around it read as a name.
// Such places go on the "not sure" list instead.
export const ORDINARY = words(`
  grace hope faith joy rose may june april august mark will bill ray sunny rich frank dawn summer autumn amber ruby pearl jade
  crystal iris lily daisy holly ivy violet heather hazel olive sandy rusty chase chip clay cliff dale dean drew earl gene glen grant
  guy hunter jack jean lance max miles pat penny rob rocky rod sky sterling stone wade win wolf woody bob bud carol chance christian
  constance patience prudence charity mercy honor honour liberty destiny harmony melody serenity trinity precious princess baby angel
  star king duke prince major noble hardy young white black brown green grey gray short small little strong wise bishop cook baker
  mason carpenter fisher archer banks hill wood field ford brook rivers lake marsh park lane hall bell price lord rice
  long see soon man sum kong hong wan tong chin pin sin fan pan kit hoe min teh tee tai chai sim wah loh mah along
  indah murni intan permata mutiara cahaya bahagia selamat seri sri jaya bayu embun suria bulan bintang fajar senja kasih sayang
  ayu manis dewi wira perkasa teguh setia tulus ikhlas iman amal ihsan hikmah rahmat nikmat salam hidayah syukur sabar hakim zahir
  batin aman damai mulia budi budiman bunga mawar melati kenanga cempaka melur dahlia anggerik orkid ros kemboja seroja laut ombak
  biru hijau merah putih hitam kuning ungu emas delima cinta rindu harapan ceria riang suka nur hari bala suri maya nila raja kala
  mala ram guru bagus sentosa utama lestari amin sultan dan
  said page case law bond day love fine wall bakar abu mat rahim puteri putri gill
  low saw son sun wee woo hew lye ting yam sue chew chow
`);

// Words that often come straight after a person's name ("Mark said", "May is
// preparing", "Will to remeasure"). A capitalised ordinary-word name at the
// start of a sentence followed by one of these is read as a name.
export const AFTER_NAME = words(`
  said says told tells asked asks called calls confirmed confirms replied replies wrote writes agreed agrees promised promises
  handled handles sent sends gave gives came comes went goes left leaves signed signs saw sees met meets knows knew thinks thought
  wants wanted needs needed has had is was will would can could shall should must may might did does also from and to who
  doesn't didn't won't can't isn't wasn't hasn't hadn't couldn't wouldn't
  kata cakap bagitahu beritahu memberitahu minta suruh dah sudah akan tak tidak nak mahu cuti datang pergi ada kena boleh tolong pls
`);
// Words before a capitalised word that make it an ordinary word, not a name
// ("the Bill of Quantities", "a Grace Period").
export const DETERMINERS = words('the a an this that these those its our your their my his her every each no some any such another');

// Words in a chat contact name or a signature line that describe the person
// rather than name them ("Kala Manager", "Margono Dapur", "Mani Lorry").
export const LABEL_WORDS = words(`
  admin office manager mgr boss lorry driver nursery dapur kitchen agent accounts account acc finance hr staff team group site
  supervisor store shop kedai restoran restaurant klinik clinic taxi grab mechanic contractor renovation reno plumber lawyer peguam
  client customer supplier sales marketing ops operations work home rumah mobile hp personal new old baru lama landlord tenant cook
  chef cleaner maid helper guard security worker foreman qs pm engineer architect hq branch company ent enterprise trading
  property properties realty agency
  delivery kantin legal support info helpdesk enquiries enquiry billing secretariat hello contact careers noreply postmaster webmaster service services reception
  mention hearing trial incident transfer meeting call outgoing incoming missed visit appointment
`);

// Words for a person's role. "the lorry driver, Ah Seng," and "Joko, another
// worker," name a person next to them. Only roles a company cannot have:
// "our client, Seri Kembara" may be a company, so client, tenant, landlord,
// supplier, contractor and the like are not here.
export const ROLE_NOUNS = words(`
  driver worker supervisor foreman cook chef clerk manager director agent accountant secretary colleague friend neighbour neighbor
  husband wife son daughter brother sister father mother uncle aunt aunty auntie cousin nephew niece partner
  assistant helper maid guard cleaner engineer surveyor officer inspector lawyer solicitor
  employee boss witness nurse doctor teacher student pupil intern
  technician mechanic plumber electrician coordinator executive representative salesman salesperson cashier waiter waitress
  dishwasher rider courier messenger housekeeper caretaker gardener labourer laborer operator storekeeper storeman workers
  pemandu pekerja penyelia pembantu pencuci pengurus kerani isteri suami anak jiran kawan rakan
`);

// Spreadsheet column headings and row labels whose cells hold people's names.
export const PERSON_HEADERS = [
  'name', 'names', 'full name', 'nama', 'nama penuh', 'employee', 'staff', 'worker', 'workers', 'pekerja', 'driver', 'pemandu',
  'supervisor', 'penyelia', 'contact', 'contact person', 'pic', 'person in charge', 'prepared by', 'checked by', 'approved by',
  'certified by', 'received by', 'collected by', 'signed by', 'issued by', 'requested by', 'verified by', 'witnessed by',
  'disediakan oleh', 'disemak oleh', 'diluluskan oleh', 'diterima oleh', 'disahkan oleh', 'witness', 'saksi', 'attendee',
  'tenant', 'landlord', 'occupant', 'penyewa',
];

// Capitalised words that are not names: legal roles, document words, places.
export const NOT_NAMES = words(`
  hakim arif bandar pengerusi pengarah presiden setiausaha pendaftar peguam majistret pesuruhjaya sumpah timbalan penolong kanan
  director manager chairman secretary officer partner associate clerk president treasurer auditor liquidator receiver trustee
  executor administrator guardian landlord tenant vendor purchaser borrower lender guarantor chargor chargee assignor assignee
  employer employee contractor subcontractor consultant client customer supplier agent principal owner occupier licensee
  agreement contract deed letter email memo notice invoice receipt report statement schedule appendix annexure bundle documents
  ipoh johor bahru shah alam petaling jaya george town kota kinabalu kuching seremban klang subang kuantan alor setar bharu
  cyberjaya hong kong china india indonesia thailand brunei australia japan korea vietnam philippines america usa
  dear sir madam yours faithfully sincerely regards thank thanks please kindly attention urgent private confidential
  yesterday today tomorrow morning afternoon evening night week month year
  bank islam negara federal territory wilayah persekutuan kerajaan government ministry kementerian jabatan department lembaga
  majlis perbandaran bandaraya daerah mukim negeri pejabat tanah galian national land code registrar companies
  first second third fourth fifth sixth seventh eighth ninth tenth pertama kedua ketiga keempat kelima
  saya kami kita anda beliau mereka dan atau yang ini itu dengan kepada daripada untuk oleh pada dalam di ke
  perkara rujukan tuan puan terima kasih sekian harap maklum bersama surat tarikh bertarikh
  we our us they them their his her he she it its you your i my me who what when where why how
  if then but so because although though while after before since until unless once upon
  also only just even still already again further moreover therefore thus hence however nevertheless
  all any both each every few many more most other some such no nor not own same than too very
  can will shall may must should would could might do does did has have had is are was were be been being
  on in at by for from of to with without within into onto over under about above below between through during against
  enclosed attached herewith hereby herein thereof thereto pursuant according regarding concerning referring refer
  reviewer author user admin administrator unknown microsoft office windows computer scanner owner
  guaman sivil jenayah peguamcara peguambela anor ors advocates demand finance branch purchase sale payer payee account amount
  sessions suit mykad passport reminder correspondence english note refund deposit syarikat tuntutan balas pembelaan
  re ref no nos tel fax hp mobile email website tetuan messrs sirs menurut merujuk sila adalah bahawa
  staff team group chat whatsapp telegram admin dapur kedai restoran kota bapa menteri polis klinik sekolah pejabat ibu
  everyone everybody all colleagues there folks guys
  aidilfitri aidiladha ramadan ramadhan raya deepavali diwali christmas krismas merdeka thaipusam wesak lunar
  indonesian bangladeshi nepali nepalese filipino myanmar burmese thai vietnamese cambodian pakistani indian chinese malay
  american australian japanese korean foreigner foreign undersigned bertandatangan later earlier meanwhile afterwards
  tunggal beradik mati bendahari
  bro sis akak bruh dude mate guys
  tiada kosong illegible vacant nil none blank pending unknown
  muslim buddhist hindu sikh catholic
  thereupon hereupon whereupon alamak aiyo aiyoh aduh adoi
  lot unit plot parcel
`);
