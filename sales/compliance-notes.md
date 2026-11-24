# Cloak: PDPA, confidentiality and Bar guidance

**Research notes for review by a Malaysian advocate and solicitor. This is not legal advice.**

- Prepared: 15 November 2026, by Lawgistics (the maker of Cloak), for a law firm and its advocate to review. Author and reviewing advocate: [to be named]. No advocate's review has been recorded.
- Law stated as at: 15 November 2026.
- Purpose: to give a reviewing advocate a starting point, with a source for each legal statement. Cloak's other material points here instead of making legal claims.
- Nothing here says Cloak is compliant, certified or approved by anyone. No regulator, court or Bar body has reviewed Cloak. **Cloak lowers the risk; it does not remove it.**

> **How the sources were checked (read this first).** Sources were read in extracts from the official sites named (Attorney General's Chambers, the Personal Data Protection Commissioner, the Malaysian Bar and CommonLII), and in law-firm and news summaries where marked, not in full. In the strict sense (full text opened and read at the pinpoint) **nothing in this memo is fully verified.** Section 8 gives the status of each point. The reviewing advocate should check every pinpoint against the official text before relying on it.

---

## 1. Question

What Malaysian law and professional guidance applies when a disputes law firm uses Cloak on its own computers to replace client details in documents with tags, and the lawyer then gives the cloaked copies to a generative AI service the lawyer has chosen?

## 2. Short answer

1. **The PDPA applies to the firm.** All of the Personal Data Protection (Amendment) Act 2024 (Act A1727) has been in force since 1 June 2025 at the latest (P.U.(B) 522/2024). For this use the main changes are: data processors are directly bound by the Security Principle, the transfer whitelist in s.129 is gone, breach notification (s.12B) is mandatory, data protection officers (s.12A) are mandatory above the Commissioner's thresholds, and the maximum penalty for breaching the principles rose to RM1,000,000 or three years or both.
2. **Cloaked text is probably still personal data in the firm's hands,** because the firm holds the key that links each tag to a real person, and the definition in s.4 covers a person identifiable "from that and other information in the possession of" the data controller. Whether it is personal data in the AI provider's hands is an open question that no Malaysian source found here answers. The firm should plan as if the PDPA applies to the AI step, including s.129 if the service is outside Malaysia.
3. **Confidentiality and privilege apply whatever tool is used** (r.35 of the Legal Profession (Practice and Etiquette) Rules 1978; ss.126 to 129 of the Evidence Act 1950). The Bar Council's **Circular No 242/2025** (3 July 2025) is the most important single document for this use. As extracted, it says generative AI should not be used for handling personal data, privileged information or confidential instructions (and, in items (h) and (i) of the same list, for processing the personal data of employees, clients or any other persons, or for disclosing or sharing information or documents subject to solicitor-client confidentiality or legal professional privilege), tells lawyers to redact client and personal data before input, to avoid putting client-specific facts into any GenAI tool, and to keep records of professional oversight. Cloak does the redaction step and keeps a record, but cloaked text can still carry client-specific facts, so the circular may be read as covering the cloaked workflow itself. Whether a particular use fits the circular is a decision for the firm, on the full text of the circular.
4. **Two things are pending and could change this memo:** a court practice direction on AI use by lawyers (announced by the Chief Justice on 28 October 2026, not yet seen; one news report describes a circular or guidelines from the Chief Registrar's office instead, so the final instrument may differ) and the Commissioner's Public Consultation Paper No. 1/2026 on AI and personal data protection (law-firm briefings say it was issued on 5 October 2026 and comments closed on 23 October 2026; not read). Check both before relying on this memo.

## 3. Facts (about Cloak, taken from its code and documentation, not from any client)

These facts come from Cloak's own code and documentation (its README, key file, matter, double checker, licence and offline notes) as at 15 November 2026. They are about the product, not about any firm.

- Cloak is a desktop program. It reads a folder of documents on the lawyer's computer or the firm's own drive and writes cloaked text copies to a folder the lawyer chooses. The originals are only opened for reading.
- It replaces people, companies, NRIC and passport numbers, addresses, phone numbers, emails, bank accounts, case numbers, land titles and vehicle plates with tags such as `{{PERSON_1}}`. In **Strict** mode (the default) it also blurs dates, amounts, reference numbers, listed places, project names, some job titles and court names. In **Standard** mode dates, amounts and legal provisions stay visible.
- The link between each tag and its real value (the "key") is kept in one encrypted file (the key file) per matter, on the firm's own drive. It is encrypted with AES-256-GCM under a random key made for the matter, which is locked by the matter password and by a recovery code (both stretched with scrypt). There is no back door.
- A person must finish a review screen before anything is exported. Before every export of any matter, a double checker (rules and word lists; no AI) reads everything that would be written and looks again for the values the key holds, for ID-number patterns and for leftover name-like words. Each finding holds the export until a person hides it or marks it as fine, and the person's name and time are recorded. It does not look on their own for names of one or two letters (such as Ng), honours on their own (such as Tan Sri), or three-letter forms such as Lee or Ali unless written with a capital, and a person can mark any finding as fine.
- Cloak itself sends nothing to any AI service. The lawyer chooses the AI service and gives it the cloaked copies. When a draft comes back, Cloak puts the real values back in on the lawyer's computer and runs three rule-based checks on the draft (the source check only when the documents folder is chosen).
- The app's code makes no network calls; its window refuses every request that is not for a local file; there is no auto-update. The no-network tests have been run on Linux, not yet on Windows or Mac.
- A log in the matter folder records who did what and when (the full names and computer logins of the firm's people), and never a name, number or text from the documents.
- Cloak uses rules and word lists, not an AI model. It misses things. On a made-up matter of 22 files written outside the team that writes the detection rules, run once on 12 November 2026 on an earlier version and counted by hand (the result is not recorded in the project's documents), people's names were still visible in 13 of the 22 files after cloaking (nicknames, single names, lowercase names in file notes), and the client's name showed in the file-name line of every output. The name rules were then rewritten and measured on a separate made-up matter of 15 files, written by the same team that wrote the rules: 59 of 278 name places were missed silently before the new rules and 6 after, with 1 more partly hidden. That second result is a best case. Cloaked text can still show the shape of the dispute.
- Every copy of Cloak today is an evaluation copy, because the vendor's licence key has not been made: it exports cloaked copies only from matters ticked as made-up test documents. A licensed copy can export a real matter once the review is finished and the double check has passed. The double checker, the offline licence, signing-ready installers, a sample matter, help screens and a support file are built. Code-signing certificates have not been bought, so installers are unsigned. A redesign of the window is in progress.

The full product description is in Cloak's security and data protection statement.

## 4. Assumptions

- The firm practises in **Peninsular Malaysia** and its lawyers are members of the Malaysian Bar, so the Legal Profession Act 1976 applies. Firms in Sabah and Sarawak are governed by their own Advocates Ordinances (see 5.2), which this memo did not research.
- The firm is a partnership, LLP or company providing legal services to clients for reward, so it processes personal data in respect of commercial transactions.
- The documents contain personal data of clients, opposing parties, witnesses and others, and sometimes sensitive personal data (for example health or alleged offences).
- The AI service the lawyer chooses may be run by a company outside Malaysia, on servers outside Malaysia.
- The firm uses Cloak as described in section 3. Different use (for example sending originals to an AI service) is outside this memo.

## 5. Law

### 5.1 Personal Data Protection Act 2010 (Act 709), as amended by Act A1727

**Current text.** The Attorney General's Chambers publishes Act 709 (Reprint 2026), stated to be as at 15 September 2026, which includes the 2024 amendments. It uses "data controller" where the 2010 text said "data user".

**Commencement of the 2024 amendments.** Act A1727 received Royal Assent on 9 October 2024 and was published on 17 October 2024 (secondary sources). Under s.1(2) of Act A1727 the Minister appointed three dates by P.U.(B) 522/2024 (signed 19 December 2024 and published in the Gazette on 24 December 2024, according to secondary sources):

| Date in force | Sections of Act A1727 | What they do (as far as checked) |
|---|---|---|
| 1 January 2025 | ss.7, 11, 13, 14 | Administrative changes. Section 11 amends s.67 of Act 709 to remove a requirement to consult the Minister. Secondary sources describe the rest as electronic service of notices and similar. No new duties on firms. |
| 1 April 2025 | ss.2, 3, 4, 5, 8, 10, 12 | "Data user" becomes "data controller" (s.2). New definitions, including "personal data breach", and biometric data added to "sensitive personal data". A direct duty on data processors to comply with the Security Principle, and higher penalties. Removal of the transfer whitelist and other changes to s.129 (s.12 of Act A1727). |
| 1 June 2025 | ss.6, 9 | New s.12A (data protection officer) and s.12B (data breach notification) (s.6 of Act A1727). New s.43A (data portability) (s.9 of Act A1727). |

The mapping of Act A1727 sections 3, 8, 10, 13 and 14 to particular provisions of Act 709 was not confirmed (see section 8). Section 4 of Act A1727 inserts s.5(1A) (processor duty) and amends s.5(2) (penalties); section 5 amends s.9(1) (exact wording not confirmed).

**The seven principles (s.5(1)).** Processing by a data controller must follow the General, Notice and Choice, Disclosure, Security, Retention, Data Integrity and Access Principles (ss.6 to 12). The Commissioner's FAQ lists the same seven.

**Personal data (s.4).** Information in respect of commercial transactions that relates directly or indirectly to a data subject "who is identified or identifiable from that information or from that and other information in the possession of" the data controller. Biometric data is now within "sensitive personal data" (from 1 April 2025).

**Penalties.** The maximum penalty for a data controller who breaches the principles rose from RM300,000 or two years or both, to RM1,000,000 or three years or both (s.5(2) as amended; in force 1 April 2025).

**Data processors and the Security Principle (s.9).** The Security Principle requires practical steps to protect personal data from loss, misuse, modification, unauthorised or accidental access or disclosure, alteration or destruction, having regard to (among other things) the nature of the data and the harm that would result, where it is stored, and secure transfer. Where a data processor processes on the controller's behalf, the controller must ensure that the processor gives sufficient guarantees about technical and organisational security measures and that the processor takes reasonable steps to comply with them (s.9(2)). Since 1 April 2025 a data processor processing on a controller's behalf must itself comply with the Security Principle (s.5(1A), inserted by s.4 of Act A1727), and a processor who does not commits an offence carrying the same maximum of RM1,000,000 or three years or both (s.5(2) as amended). (Read in search extracts of a law firm's copy of Act A1727 and in law-firm notes; no source found cites a "s.9(1A)"; the amended wording of s.9(1) was not confirmed.)

**Transfers outside Malaysia (s.129, as amended from 1 April 2025).** The Minister's whitelist (old s.129(1)) is deleted. A data controller may transfer personal data to a place outside Malaysia if (a) that place has in force a law substantially similar to Act 709, or (b) that place ensures an adequate level of protection at least equivalent to Act 709 (s.129(2)). The controller, not the Minister, now makes that judgement. The exceptions in s.129(3) remain, including the data subject's consent (s.129(3)(a)); transfers necessary for legal proceedings, for obtaining legal advice, or for establishing, exercising or defending legal rights (s.129(3)(d)); and transfers where the controller has taken all reasonable precautions and exercised all due diligence to ensure the data will not be processed in breach of the Act (s.129(3)(f)). The public interest ground (old s.129(3)(h)) was deleted.

The Commissioner's **Personal Data Protection Guidelines No. 3/2025, Cross Border Personal Data Transfer** (version 1.0, 29 April 2025) explain each route. As extracted: a controller "may" carry out a Transfer Impact Assessment to support s.129(2); the legal proceedings ground in s.129(3)(d) is read broadly (court and regulatory proceedings, and out-of-court processes such as mediation, arbitration and without prejudice meetings); it covers pre-action correspondence and taking advice on the legal risk of a claim, but the mere possibility of future proceedings is not enough.

**Data protection officer (s.12A, from 1 June 2025).** As enacted, a data controller and a data processor acting for it must each appoint one or more data protection officers (the processor's officer is accountable to the processor, not to the controller), and the duty to notify the Commissioner in s.12A(3) is on the data controller. Some law-firm briefings read the DPO Guideline as also requiring processors to register, so sources differ. The Commissioner's FAQ and the DPO Guideline (February 2025; circular number given as 1/2025 in some sources and 2/2025 in others) set the thresholds: processing personal data of more than 20,000 data subjects, or sensitive personal data (including financial information) of more than 10,000 data subjects, or processing that involves regular and systematic monitoring. The 21-day limit for notifying the Commissioner of the appointment, through the SPDP portal, comes from the Guideline, not from s.12A itself. Secondary sources say the DPO must be resident or physically present in Malaysia, and law-firm briefings describe the test as presence in Malaysia for at least 180 days a year or being easily contactable (secondary; not checked).

**Data breach notification (s.12B, from 1 June 2025).** Where a controller has reason to believe a personal data breach has occurred, it must notify the Commissioner as soon as practicable; where the breach causes or is likely to cause significant harm, it must also notify the affected data subjects without unnecessary delay. The Commissioner's **Guideline on Data Breach Notification** (version 1.0 issued 25 February 2025, effective 1 June 2025), as extracted: notification to the Commissioner is required where the breach causes or is likely to cause significant harm; one test of significant scale is more than 1,000 affected data subjects; notice is due no later than 72 hours (sources differ on whether the clock runs from the breach or from becoming aware of it; the Commissioner's form asks whether the report is made within 72 hours "after becoming aware"); further details may follow in phases within 30 days; reports go through the SPDP portal or by email to dbnpdp@pdp.gov.my. The time limit for telling data subjects in the guideline, and the penalty for breaching s.12B, were not confirmed in an official text. Law-firm briefings say notice to data subjects is due within 7 days of notifying the Commissioner, and that s.12B(3) provides a fine of up to RM250,000, up to two years' imprisonment or both (secondary only; treat as unverified).

**Registration.** Data controllers in the 13 classes listed in the Personal Data Protection (Class of Data Users) Order 2013 (P.U.(A) 336/2013, amended by P.U.(A) 326/2016) must register with the Commissioner and hold a certificate. A 2013 circular of a professional body describes the "services" class as covering companies and partnerships carrying on legal, audit, accountancy, engineering or architecture business. The Order's own text was not read.

**Standards.** The Personal Data Protection Standard 2015 (issued 23 December 2015) sets minimum security, retention and data integrity requirements for electronic and non-electronic processing. The Commissioner consulted on a revised standard in 2024 (Public Consultation Paper No. 04/2024); whether a revised standard has been issued was not confirmed.

**Grounds relevant to legal work.** Sensitive personal data may be processed (among other conditions) where necessary for, or in connection with, legal proceedings, for obtaining legal advice, for establishing, exercising or defending legal rights, or for the administration of justice (s.40(1)(b), as extracted from the 2026 reprint). There is an exemption from several principles for processing necessary for or in connection with any order or judgment of a court (s.45; numbering to be checked). These grounds concern whether the firm may process the data at all; they do not displace the Security Principle.

**Pending or proposed, not law.** Public Consultation Paper No. 2/2025 (Data Protection by Design) proposed that personal data be pseudonymised where directly identifying data is not needed. Law-firm bulletins report that the Commissioner issued final guidelines on Data Protection by Design, Data Protection Impact Assessment, and Automated Decision-Making and Profiling on 30 April 2026 (secondary; not read; whether the final Data Protection by Design text keeps the pseudonymisation advice was not confirmed). **Public Consultation Paper No. 1/2026, "Artificial Intelligence (AI) and Personal Data Protection Framework"**, is a draft guideline. The Commissioner's consultation page and law-firm briefings give 5 October 2026 as the issue date and 23 October 2026 as the close of comments; the Commissioner's main page lists it under 29 October 2026. Its text was not read. No final Commissioner guidance on AI was found.

### 5.2 Confidentiality and privilege

**Evidence Act 1950, ss.126 to 129** (text checked on CommonLII, Revised 1971):

- **s.126 (professional communications).** No advocate may, without the client's express consent, disclose a communication made in the course and for the purpose of the advocate's employment, state the contents or condition of a document the advocate became acquainted with in that course, or disclose advice given. The obligation continues after the employment has ended. Provisos: no protection for a communication made in furtherance of an illegal purpose, or for a fact observed by the advocate showing that a crime or fraud has been committed since the employment began, whether or not the advocate's attention was drawn to it.
- **s.127.** Section 126 applies to interpreters and to the clerks or servants of advocates.
- **s.128.** A party who gives evidence does not by that alone consent to disclosure; a party who calls the advocate as a witness is taken to consent only if he questions the advocate on matters the advocate could not otherwise disclose.
- **s.129.** No one shall be compelled to disclose to the court a confidential communication with his legal professional adviser, unless he offers himself as a witness, and then only what the court needs to explain his evidence.

**Legal Profession Act 1976.** Section 77 allows the Bar Council, with the Attorney General's approval, to make rules on practice, etiquette, conduct and discipline, which take effect on publication in the Gazette. Under s.94(3), misconduct includes breach of any rule of practice and etiquette (s.94(3)(d)) and breach of the Act, rules made under it, or any direction or ruling of the Bar Council (s.94(3)(k)). Penalties under s.94(2) include striking off and suspension for up to five years. The Bar Council's Rules and Rulings state that non-compliance may be regarded as misconduct under s.94(3), so a disciplinary finding is not automatic. The Act has not been extended to Sabah and Sarawak, where the Advocates Ordinance (Sabah) (Cap. 2) and the Advocates Ordinance (Sarawak) (Cap. 110) apply.

**Legal Profession (Practice and Etiquette) Rules 1978.**

- **Rule 35** (advocate and solicitor not to abuse confidence reposed in him by client): (a) must not take advantage of the client's confidence for personal benefit; (b) must preserve the client's confidence, and the duty continues after the relationship ends.
- **Rule 3** (not to accept a brief if embarrassed) includes the case where the advocate holds confidential information from advising another person on the same matter.

**Rules and Rulings of the Bar Council** (consolidated as at 20 January 2026). Ruling **7A.03** (client confidentiality, in Chapter 7A on virtual offices, effective 17 August 2021 by Circular No 324/2021) requires a firm to take all due and necessary precautions against inadvertent or unauthorised disclosure of client information to another entity, including the service provider, and to have a non-disclosure or confidentiality agreement with the service provider covering all documents and information handled for the firm. It is written for virtual offices, not AI, but it shows the standard the Bar Council applies to third parties who handle client documents.

**Cases.** No Malaysian judgment on privilege, confidentiality or AI was opened for this memo. The reviewing advocate should add the leading Federal Court and Court of Appeal authorities on privilege and on loss of confidentiality from a full law database.

### 5.3 Bar Council and court guidance on AI, technology and cloud services

**It exists.** The Malaysian Bar has issued guidance on generative AI and on cloud services. None of it endorses or approves any product.

- **Circular No 342/2023** (24 November 2023), "The Risks and Precautions in Using Generative Artificial Intelligence in the Legal Profession, Specifically ChatGPT". As extracted: the Bar Council does not endorse or regulate the use of any form of generative AI; output must be checked independently; tools can invent citations and case summaries; there are risks to client confidentiality, privacy and intellectual property; models are trained on large amounts of data, some of it sensitive or confidential; the lawyer remains responsible for content and advice given to clients.
- **Circular No 242/2025** (3 July 2025), supplementing Circular No 342/2023. As extracted: the main risks are confidentiality, accuracy, accountability, data security and the unauthorised practice of law; generative AI should not be used for handling personal data, privileged information or confidential instructions, or for client-specific work where professional liability is engaged; lawyers should "Redact all sensitive, personal or other client or employee data" and avoid inputting personal data such as names, identifiers, financial data or client-specific facts into any GenAI tool, including paid ones; lawyers should keep clear records of professional oversight and final review; they should check whether a vendor retains data or uses it for training, and note that privacy controls are not absolute. The same "should not be used" list also includes (h) processing the personal data of employees, clients or any other persons and (i) disclosing or sharing information or documents subject to solicitor-client confidentiality or legal professional privilege. The circular is described as guidance prepared by the Bar Council's Legal Tech, AI and Sandbox Committee. **The extracts were fragmented and must be checked against the full circular.** Whether this circular is advisory or a ruling within s.94(3)(k) was not confirmed.
- **Circular No 393/2024** (21 November 2024), guidance notes on cloud services prepared by the Bar Council's Cyber and Privacy Laws Committee. As extracted: the notes are advisory and not legally binding; the Bar Council does not object to the informed use of cloud services; the duty of confidentiality now extends to cybersecurity; storing data on servers in another country raises personal data compliance issues (a firm should check the laws where the servers sit and, as best practice, tell clients in writing when data centres are outside Malaysia); encryption, strict access control and reputable providers are recommended; the extracts say the Bar Council does not endorse or prohibit any provider and, in another place, that it does not regulate cloud service providers (to be checked against the PDF; only one source was found).
- The Malaysian Bar's practice directions page carries short reminders not to share confidential or sensitive information with AI tools and to verify AI-generated content independently (date not confirmed).

**Courts.** On 28 October 2026 the Chief Justice said the judiciary would issue a practice direction on the use of AI in legal proceedings, for legal practitioners and court officers, within a few weeks; judges already have their own guidelines (news reports: Bernama, The Star, The Sun, Malay Mail, New Straits Times, Free Malaysia Today). Free Malaysia Today reports a circular or guidelines from the Chief Registrar's office rather than a practice direction, so the final instrument may differ. No issued practice direction was found as at 15 November 2026.

## 6. Analysis

### 6.1 Is cloaked text still personal data?

In the firm's hands, probably yes. The firm holds the key, so each tag can be linked back to a person using "other information in the possession of" the firm (s.4). Even without the key, cloaked text can identify someone through facts that stay visible (Standard mode keeps dates and amounts), through the shape of the dispute, or through anything Cloak missed (section 3 records two measured results on made-up matters).

In the AI provider's hands the question is open. The provider does not have the key. Act 709 does not use the words "pseudonymised" or "anonymised" in anything found here, and no final Commissioner guidance on the point was found. A sector code for communications licensees treats properly anonymised data as outside "personal data", but that code is not general guidance and cloaked text is not anonymised in that sense while a key exists.

**Practical conclusion for review:** the firm should not rely on "it is no longer personal data" as its only basis for the AI step. It should treat the AI step as processing of personal data, with Cloak as one of its security measures under s.9.

### 6.2 Sending cloaked copies to an AI service outside Malaysia (s.129)

If the cloaked text is personal data and the AI service processes it outside Malaysia, s.129 applies. Possible routes, each for the firm and its adviser to decide:

- **s.129(2):** the firm judges that the destination has substantially similar law or ensures equivalent protection, documented (for example by a Transfer Impact Assessment, which Guidelines No. 3/2025 describe as optional).
- **s.129(3)(d):** the transfer is necessary for legal proceedings, for legal advice, or for establishing, exercising or defending legal rights. A disputes firm drafting for a live or threatened claim may fit this ground; Guidelines No. 3/2025 include pre-action correspondence, but say a mere possibility of future proceedings is not enough. Whether "necessary" is met when a lawyer uses an AI drafting tool by choice is the weak point.
- **s.129(3)(a):** the client's consent, with notice. This does not cover other people in the documents (opposing parties, witnesses).
- **s.129(3)(f):** all reasonable precautions and all due diligence. Cloak's review, double check and encrypted key may form part of the precautions, together with the AI provider's contract terms (retention, training, location, security). This is analysis, not a conclusion that the ground is met.

### 6.3 The AI provider as a data processor

If the AI provider processes cloaked personal data solely on the firm's behalf, it is likely a data processor. (Section 4 defines a processor as one that processes "solely on behalf of" the controller, so a provider whose terms let it use the inputs for its own purposes, for example training, may fall outside that definition. No Malaysian source found deals with AI providers.) The firm must then ensure that the provider gives sufficient guarantees about technical and organisational security measures and that the provider takes reasonable steps to comply with them (s.9(2)). In practice: read the provider's business terms on data retention, use for training, data location, security and deletion; prefer business or enterprise terms that rule out training on inputs; keep a copy. Ruling 7A.03 and Circular No 393/2024 point the same way: a confidentiality agreement with any third party handling client documents, encryption and access control. Whether the provider itself is bound by Act 709 depends on where it is established and processes, which was not researched.

### 6.4 Lawgistics' own role

On the facts in section 3, Lawgistics does not receive, store or process any documents, keys or cloaked text: the program runs on the firm's computers and the key file stays on the firm's drive. On that basis Lawgistics would not be a data processor for the documents. Two cautions: (a) if the firm sends Lawgistics a support file (the app suggests this when something fails), a screenshot or a sample document, that could contain personal data. A support file holds the Cloak version, system details, a self-test, counts about the open matter and the matter's log, which records the full names and computer logins of the firm's people who worked on the matter and what they did, but no document text; any value from the matter's key found in it is replaced by its tag. A support file made from a real matter would therefore give Lawgistics the personal data of the firm's staff, so support should be arranged so that nothing from a real matter is sent, or only after the firm decides to send it; (b) this depends on the product staying offline. If a future version sends anything to Lawgistics (for example licence checks or error reports), this paragraph must be revisited.

### 6.5 Security Principle and the key

The key file is the most sensitive file Cloak creates: with it, tags can be turned back into names. Cloak encrypts it with AES-256-GCM, protects it with a password of at least 10 characters and a recovery code, both stretched with scrypt, and refuses to save it in a folder it recognises as OneDrive, Google Drive or iManage Drive (other sync apps are not recognised) or beside the cloaked copies. A matter's password can be changed and its recovery code replaced in Matter settings, for example when someone leaves; an older copy of the key file still opens with the old password or code, because the matter key itself is not changed. Those are relevant security measures under s.9, but they do not replace the firm's own measures (device encryption, access control on the matter folder, backups, staff training). A weak password is the main weakness: anyone with a copy of the key file can try passwords offline for as long as they like.

### 6.6 Breach notification

Possible breach scenarios: a lost laptop or drive holding originals; a key file copied together with its password; cloaked copies that still contain a real name given to an AI service. Whether each is a notifiable breach depends on the DBN Guideline's significant harm tests. Whether the guideline treats encrypted data as lower risk was not checked. Cloak's log can help the firm reconstruct who did what and when, but it is a plain text file, not a tamper-proof audit trail.

### 6.7 Data protection officer

A disputes firm should count the data subjects it processes, including people named in case documents, not only clients. A firm over 20,000 data subjects, or over 10,000 for sensitive data, likely needs a DPO under the Commissioner's thresholds. Cloak does not change that count.

### 6.8 Confidentiality and privilege

The duty in r.35(b) is to preserve the client's confidence. Section 126 is a rule of evidence about compelled disclosure, but it reflects the same relationship. Giving cloaked text to an AI provider is a disclosure to a third party of material that may still be confidential (facts, the shape of the dispute, anything missed). Points for the reviewing advocate:

- Whether disclosure of cloaked material to an AI provider, under business terms that bar training and limit retention, is consistent with r.35(b).
- Whether such disclosure risks waiving privilege over the underlying communications. The memo found no Malaysian authority on AI tools; the general position on loss of confidentiality should be checked in the case law.
- Whether the firm should tell clients and obtain consent, in its engagement letter, before using AI on their matters. Circular No 242/2025 should be read in full for what it says on this.

Cloak reduces what is disclosed. It does not make the material non-confidential.

### 6.9 The Bar's generative AI guidance

Read as extracted, Circular No 242/2025 recommends redaction before input and records of oversight, which Cloak supports (the review screen, the double check and the matter log). It also discourages using generative AI for handling personal data, privileged information, confidential instructions or client-specific facts at all, and its list of uses to avoid includes (h) processing the personal data of employees, clients or any other persons and (i) disclosing or sharing information or documents subject to solicitor-client confidentiality or legal professional privilege. Cloaked text, especially in Standard mode, still contains client-specific facts, and section 6.1 concludes it is probably still personal data in the firm's hands and section 6.8 that it may still be confidential. **This is the main risk for a firm using Cloak with an AI tool:** on its face the circular may cover the cloaked workflow itself, not only a firm that might read it as discouraging the use. Cloak does not make a firm's use of AI consistent with Bar guidance, and nothing in Cloak's material says or implies that it does. Cloak helps with the redaction and record-keeping steps the guidance mentions; each firm decides whether and how to use AI. Section 6.9 should be checked against the full text of items (h) and (i).

### 6.10 What Cloak can support, and what it cannot

| Duty or guidance | What Cloak does | What it does not do |
|---|---|---|
| Security Principle (s.9) | Replaces identifiers before anything leaves the firm; encrypted key; refuses OneDrive, Google Drive and iManage Drive folders for the key when it recognises them (not other sync apps); review before export; double check before every export. | Does not secure the firm's computers, the originals or the AI provider. Misses some names. |
| Cross-border transfer (s.129) | Reduces what is transferred. | Does not choose or assess the AI service or its location. |
| Processor diligence (s.9) | Cloak sends nothing to Lawgistics. | Does not review AI provider terms. If the firm chooses to send a support file, it holds the Cloak version, system details, a self-test, counts about the open matter and the matter's log: the full names and computer logins of the firm's people who worked on the matter and what they did. It holds no document text, and any value from the matter key found in it is replaced by its tag (see 6.4). |
| Records of oversight (Circular No 242/2025) | Log of who reviewed, approved and exported, with times; report of what was read; "reviewed and double-checked" marker in each export. | The log is not tamper-proof and holds no record of what the lawyer then did with the AI. |
| Redaction before input (Circular No 242/2025) | The core function. | Not complete: names with no clue around them, nicknames, words in pictures and handwriting, non-Latin scripts (a file with five or more such characters is held for a manual check; a short name, such as a two- or three-character Chinese name, is neither hidden nor held: it is only noted on the review's Files tab), facts and the shape of the dispute. |
| Breach notification (s.12B) | Log helps reconstruct events. | Does not detect or report breaches. |
| Confidentiality (r.35) | Reduces disclosure. | Does not make the material non-confidential. |

## 7. Gaps and risks

1. **Bar guidance on GenAI** (Circular No 242/2025) may be read as discouraging any use of GenAI on client matters, cloaked or not. Its legal status was not confirmed.
2. **Court practice direction on AI** is expected soon (announced 28 October 2026). It may require disclosure of AI use or impose duties that affect the workflow.
3. **Commissioner's AI consultation** (Public Consultation Paper No. 1/2026) may lead to guidance on pseudonymised data or AI.
4. **No Malaysian authority** was found on whether pseudonymised text is personal data in a recipient's hands, or on privilege when using AI tools.
5. **Detection gaps.** Measured on made-up matters only (section 3): names still visible in 13 of 22 files in an earlier run, and 6 of 278 name places missed silently after the new rules on a matter written by the rules' own team. Any claim about completeness would be wrong.
6. **Sabah and Sarawak** were not researched.
7. **Source checking.** Every point in section 5 was read through search extracts, not full texts (see the box at the top).

## 8. Needs checking

Status key: **Extract (official)** means read in search extracts drawn only from the official website named; **Secondary** means seen only in law firm or news summaries; **Not confirmed** means sources conflict or nothing was found.

| Point | Status | Source to check |
|---|---|---|
| Act 709 Reprint 2026, as at 15 September 2026 | Extract (official) | AGC, Act 709 Reprint 2026 |
| Act A1727: Royal Assent 9 October 2024, published 17 October 2024 | Secondary (printed on a law firm's copy of the Act; repeated by Deloitte) | Act A1727 PDF (PDP site) |
| P.U.(B) 522/2024 (signed 19 December 2024, published 24 December 2024) and the three dates | Extract (official); signing and publication dates Secondary | Gazette PDF on PDP site; AGC listing |
| Mapping of Act A1727 ss.3, 8, 10, 13, 14 to Act 709 (s.4 inserts s.5(1A) and amends s.5(2); s.5 amends s.9(1)) | Not confirmed (s.4 mapping: Secondary) | Act A1727 text |
| Seven principles (s.5(1)) | Extract (official) (FAQ); operative text not seen | Reprint 2026, s.5 |
| s.4 definition of personal data | Extract (official) | Reprint 2026, s.4 |
| s.5(2) penalty RM1,000,000 or three years | Extract (official), but numbering unclear | Reprint 2026, ss.5 and 9 |
| Processor duty and processor offence (s.5(1A) inserted by Act A1727 s.4; controller's duty in s.9(2)) | Secondary (law firm's copy of Act A1727 and law-firm notes); no source cites s.9(1A); not read in the Reprint | Reprint 2026, ss.5 and 9 |
| s.12A DPO duty (controller and processor each appoint a DPO; notification duty in s.12A(3) is on the controller) | Extract (official); whether the Guideline also requires processors to register: sources differ | Reprint 2026, s.12A |
| DPO thresholds 20,000 / 10,000 / systematic monitoring; 21 days (set by the Guideline, not s.12A) | Extract (official) (FAQ) | DPO Guideline; circular number given as 1/2025 in some sources and 2/2025 in others |
| DPO must be resident in Malaysia (some briefings: present 180 days a year or easily contactable) | Secondary; unverified | DPO Guideline |
| s.12B duties | Extract (official) | Reprint 2026, s.12B |
| s.12B penalty (secondary sources say RM250,000 or two years) | Secondary (two law-firm sources); unverified, not read in the Act | Reprint 2026 |
| DBN Guideline: 25 February 2025, 72 hours, 1,000 data subjects, 30 days | Extract (official), trigger wording conflicts | DBN Guideline |
| DBN time limit for telling data subjects (some sources say 7 days) | Secondary; unverified | DBN Guideline |
| s.129 as amended; s.129(3)(a), (d), (f); (h) deleted | Extract (official) (Guidelines No. 3/2025, consultation paper) | Reprint 2026, s.129 |
| Guidelines No. 3/2025, version 1.0 dated 29 April 2025 | Extract (official) | PDP site |
| Law firms within the "services" class for registration | Secondary (professional body circular); unverified | P.U.(A) 336/2013 |
| s.40(1)(b) legal proceedings grounds | Extract (official) | Reprint 2026, s.40 |
| s.45 court order exemption | Extract (official), numbering not shown | Reprint 2026, s.45 |
| PDP Standard 2015 and whether a revised standard has been issued | Extract (official) / Not confirmed | PDP site |
| Public Consultation Paper No. 1/2026 on AI (issued 5 October 2026, comments closed 23 October 2026 per law-firm briefings; Commissioner's main page lists 29 October 2026) | Extract (official) and Secondary, text not read | PDP announcements and consultation paper page |
| Final guidelines on Data Protection by Design, DPIA and Automated Decision-Making and Profiling, 30 April 2026 | Secondary (law-firm bulletins), text not read | PDP site |
| Evidence Act ss.126 to 129 | Extract (official) (CommonLII Revised 1971 text) | Current AGC reprint of Act 56 |
| LPA ss.77, 94(2), 94(3)(d), 94(3)(k) | Extract (official) (CommonLII, Bar site), partly secondary | LPA reprint |
| LPA not extended to Sabah and Sarawak | Extract (official) (Bar site, older sources) | Current position |
| Rule 35 and Rule 3 of the 1978 Rules | Extract (official) (Bar site) | Bar site rule pages |
| Ruling 7A.03 | Extract (official) (Bar site) | Rules and Rulings as at 20 January 2026 |
| Circular No 342/2023 | Extract (official) | Bar site PDF |
| Circular No 242/2025 and its status (items (h) and (i) of the "should not be used" list added in this version of the memo) | Extract (official), fragmented; status not confirmed | Bar site PDF |
| Circular No 393/2024 (one source only; "does not endorse or prohibit" against "does not regulate" to be checked) | Extract (official) | Bar site PDF |
| Chief Justice's announcement of 28 October 2026 (the final instrument may be a Chief Registrar's circular or guidelines rather than a practice direction) | Secondary (news) | Judiciary website when issued |
| Malaysian case law on privilege and confidentiality | Not researched (paid databases needed) | CLJ, MLJ |

## 9. Questions for the reviewing advocate

1. Can the firm rely on s.129(3)(d) for drafting work on a live or threatened dispute, or should it rely on s.129(2) or s.129(3)(f)?
2. Is cloaked text, with the key held by the firm, personal data in the AI provider's hands?
3. Does Circular No 242/2025 have the force of a ruling, and does it permit AI use on cloaked material at all?
4. Should engagement letters disclose AI use and seek client consent? What should they say?
5. Does sharing cloaked material with an AI provider under no-training business terms risk waiving privilege?
6. What, if anything, changes for firms in Sabah and Sarawak?
7. Once issued, does the court practice direction on AI change the workflow (for example a duty to disclose AI use)?
8. Do items (h) and (i) of the "should not be used" list in Circular No 242/2025 cover cloaked text, given that the firm holds the key?
9. Does a processor's data protection officer need to be registered with the Commissioner as well as appointed, and what residence test applies to a data protection officer?

## 10. Sources

Statutes and gazette
- Act 709 (Reprint 2026): https://lom.agc.gov.my/ilims/upload/portal/akta/outputaktap/3301061_BI/Act%20709%20(Reprint%202026).pdf
- Act 709, original text: https://lom.agc.gov.my/ilims/upload/portal/akta/outputaktap/Act%20709%20ori.pdf
- Act A1727 (PDP site copy): https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/11/Act-A1727.pdf
- Act A1727 (AGC listing with commencement dates): https://lom.agc.gov.my/act-detail.php?language=BI&type=amendment&act=A1727
- P.U.(B) 522/2024 (PDP site copy): https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/12/PENETAPAN-TARIKH-PERMULAAN-KUAT-KUASA.pdf
- Commissioner's page on the Amendment Act: https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-amendment-act-2024/
- Evidence Act 1950 (Revised 1971), CommonLII: https://www.commonlii.org/my/legis/consol_act/ea19501971155/
- Legal Profession Act 1976, CommonLII: https://www.commonlii.org/my/legis/consol_act/lpa19762230/

Commissioner's guidelines and materials
- Guidelines No. 3/2025, Cross Border Personal Data Transfer: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_CBPDT_EN-1.pdf
- Cross-border guidelines page: https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-guidelines-on-cross-border-transfer-of-personal-data-cbpdt/
- Data Breach Notification guideline page: https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-guidelines-on-data-breach-notification-dbn/
- DBN form: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/03/PDPC_DBN_Form_BI_07032025.pdf
- FAQ (DPO thresholds, seven principles): https://www.pdp.gov.my/en/faq/
- Act 709 page (guidelines and circulars list): https://www.pdp.gov.my/en/akta709/
- SPDP user manual, DPO registration: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/07/Manual_Pengguna_Pendaftaran_DPO_EN.pdf
- Class of Data Users Order page: https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-order-class-of-data-users/
- Registration of data controllers: https://pdp.gov.my/ppdpv1/en/registration-of-data-controller
- Personal Data Protection Standard 2015: https://www.pdp.gov.my/ppdpv1/en/akta/personal-data-protection-standard-2015/
- Public Consultation Paper No. 2/2025, Data Protection by Design: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/JPDP-FSB-200325-DPBD-PCP-ENG-TC.pdf
- Public Consultation Paper No. 05/2024, Cross Border Transfer: https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/JPDP-FSB-241001-Cross-Border-PCP-ENG-TC.pdf
- Announcements (Public Consultation Paper No. 1/2026 on AI): https://www.pdp.gov.my/en/announcement/

Malaysian Bar
- Circular No 342/2023: https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20342-2023.pdf
- Circular No 242/2025: https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20242-2025.pdf
- Circular No 393/2024 (cloud services): https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20393-2024.pdf
- Rule 35, 1978 Rules: https://www.malaysianbar.org.my/article/members/laws-bc-rulings-and-practice-directions/legal-profession-practice-and-etiquette-rules-1978/rule-35-advocate-and-solicitor-not-to-abuse-confidence-reposed-in-him-by-client-
- Rule 3, 1978 Rules: https://www.malaysianbar.org.my/article/members/laws-bc-rulings-and-practice-directions/legal-profession-practice-and-etiquette-rules-1978/rule-3-advocate-and-solicitor-not-to-accept-brief-if-embarrassed-
- Ruling 7A.03: https://www.malaysianbar.org.my/article/members/laws-bc-rulings-and-practice-directions/bc-rules-and-rulings/7a-03-client-confidentiality
- Rules and Rulings of the Bar Council (as at 20 January 2026): https://www.malaysianbar.org.my/cms/upload_files/document/Rules%20and%20Rulings%20of%20the%20Bar%20Council%20(as%20at%2020%20Jan%202026).pdf
- Circular No 324/2021 (virtual offices): https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20324-2021.pdf
- Preface to the Rules and Rulings (misconduct under s.94(3)): https://www.malaysianbar.org.my/article/members/laws-bc-rulings-and-practice-directions/bc-rules-and-rulings/preface
- Malaysian Bar v Mutang Tagal 1985 (LPA not extended to Sabah and Sarawak): https://www.malaysianbar.org.my/article/news/court-judgments/judgments/malaysian-bar-v-mutang-tagal-1985-fc

Courts (news reports)
- Bernama, 28 October 2026: https://www.bernama.com/en/crime_courts/news.php?id=2626784
- The Star, 28 October 2026: https://www.thestar.com.my/news/nation/2026/10/28/judiciary-to-issue-ai-use-guidelines-for-lawyers-soon-says-cj
- New Straits Times: https://www.nst.com.my/news/nation/2026/10/1565273/judiciary-issue-ai-guidelines-lawyers-court-officers-coming-weeks
- The Sun: https://thesun.my/news/malaysia-news/people-issues/judiciary-to-release-ai-practice-direction-for-lawyers-soon-says-cj/
- Malay Mail: https://www.malaymail.com/news/malaysia/2026/10/28/malaysia-to-introduce-new-rules-on-ai-use-in-court-within-next-few-weeks-says-chief-justice/240978
- Free Malaysia Today: https://www.freemalaysiatoday.com/category/nation/2026/10/28/chief-registrar-s-office-to-provide-guidelines-on-ai-use-in-court

Secondary (used only where the table in section 8 says so)
- Digital Policy Alert, commencement order: https://digitalpolicyalert.org/event/30542-ministry-of-digital-adopted-order-on-appointment-of-date-of-coming-into-operation-for-personal-data-protection-amendment-act-2024-act-a1727
- Skrine, dates of coming into force: https://www.skrine.com/insights/alerts/december-2024/amendments-to-the-personal-data-protection-act-201
- DFDL, implementation: https://www.dfdl.com/insights/legal-and-tax-updates/malaysia-implementation-of-the-personal-data-protection-amendment-act-2024/
- CMS, DPO guidelines: https://cms.law/en/int/legal-updates/guidelines-on-appointment-of-data-protection-officers-in-malaysia
- CMS, breach notification guidelines: https://cms.law/en/sgp/legal-updates/new-guidelines-on-mandatory-breach-notifications-under-malaysia-s-personal-data-protection-act-2010
- DLA Piper, DBN and DPO guidelines: https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/
- Malaysian Institute of Accountants, Circular MF21/2013 (classes of data users): https://mia.org.my/?p=9381
- Christopher & Lee Ong, Act A1727 text: https://christopherleeong.com/wp-content/uploads/2024/12/PDPA-Amendment-Act-A1727.pdf
- Allen & Gledhill, final DPIA, automated decision-making and data protection by design guidelines (2026): https://www.allenandgledhill.com/perspectives/publications/bulletins-malaysia/2026/pdp-commissioner-launches-guidelines-on-data-protection-impact-assessment-automated-decision-making-and-profiling-and-data-protection-by-design/
- Conventus Law, consultation on AI and personal data protection (closed 23 October 2026): https://conventuslaw.com/report/malaysia-public-consultation-on-proposed-ai-and-personal-data-protection-framework-to-close-on-23-october-2026/
