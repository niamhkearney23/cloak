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
`);
