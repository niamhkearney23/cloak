# Cloak: legal check of the research memo

Second check of the legal statements in `compliance-notes.md` (the research memo, "Cloak: PDPA, confidentiality and Bar guidance"), made on 15 November 2026 before the sales pack was merged. The memo remains **for review by a Malaysian advocate and solicitor**. Nothing here is legal advice, and nothing here replaces that review.

## What this check could and could not do

- Twenty legal claims were checked. Each was searched for on the open web, and each result below says what was found and where.
- **Nothing was read in full at the pinpoint.** In the session that did the check, four hosts were blocked: `lom.agc.gov.my` (the Attorney General's Chambers), `www.pdp.gov.my` (the Personal Data Protection Commissioner), `www.malaysianbar.org.my` (the Malaysian Bar) and `www.commonlii.org` (CommonLII). Official pages and PDFs on those hosts could be seen only through search extracts, and law-firm, news and other copies were used instead. So "confirmed" below means "agreed by the extracts and summaries found", not "read in the official text".
- **A later check is possible.** An environment named "cloak" now allows those four hosts. Re-run this check in a session that uses it, and read each source in full.
- The checker's claim list recorded 27 further statements as dropped before checking; the reason was not recorded. Treat anything not in the table below as not checked in this round (the memo's section 8 still gives its own status for each).

## Result in one line

15 claims confirmed, 5 partly right (L2, L6, L14, L18, L20). None was contradicted outright. The five were corrected in the memo and wherever they were repeated.

## Table of checked claims

| ID | Where in the memo | Claim | Status | What was found | Still unverified |
|---|---|---|---|---|---|
| L1 | 5.3, Circular No 242/2025 | Circular No 242/2025 (3 July 2025) says generative AI should not be used for personal data, privileged information, confidential instructions or client-specific work, and tells lawyers to redact client and personal data, keep names and client-specific facts out of any AI tool, and keep records of oversight. | Confirmed (in extracts or summaries) | Every element seen in search extracts of the circular itself and in two press reports. Items (h) and (i) of the same list (processing personal data of employees, clients or others; sharing material subject to solicitor-client confidentiality or privilege) were not in the memo; now added. | Full text of the circular (extracts only); whether it is advisory or a ruling within LPA s.94(3)(k). |
| L2 | 6.9 | Cloak helps with the redaction and record-keeping steps in Circular No 242/2025, but cloaked text still carries client-specific facts, so the circular may be read as discouraging the use Cloak is built for; Cloak's material must not imply that it makes AI use consistent with Bar guidance. | Partly right; memo corrected | Premise holds. The memo understated the risk: items (h) and (i) of the circular's list arguably cover the cloaked workflow itself. Memo 6.9 now quotes them and no longer calls this a selling risk only. | Full text of items (h) and (i) and how they apply to cloaked text. |
| L3 | 2 (item 2) and 6.1 | Cloaked text is probably still personal data in the firm's hands (the firm holds the key; s.4 covers a person identifiable from the data plus other information the controller holds); in the AI provider's hands it is an open question. | Confirmed (in extracts or summaries) | s.4 wording and the 'data user' to 'data controller' change (from 1 April 2025) match copies of the Act. No Malaysian source decides the position for a recipient without the key. Also stale: the Commissioner issued final Data Protection by Design, DPIA and automated decision-making guidelines on 30 April 2026, and the AI consultation closed on 23 October 2026, not 29 October. | Official text of s.4 (AGC site blocked); any Malaysian authority on pseudonymised text in a recipient's hands; text of the 30 April 2026 final guideline and the AI consultation paper. |
| L4 | 5.1, transfers (s.129) | Since 1 April 2025 the transfer whitelist is gone; a firm may transfer abroad if it judges the destination to have substantially similar law or equivalent protection (s.129(2)); the s.129(3) exceptions remain (consent (a), legal proceedings or advice (d), precautions and due diligence (f)); the public-interest ground (h) was deleted. | Confirmed (in extracts or summaries) | Law-firm briefings and a copy of the Act A1727 text agree on the amended s.129 and the deleted paragraph (h). Official texts not opened. | Official AGC and PDP texts of s.129 as amended. |
| L5 | 5.3, Courts | On 28 October 2026 the Chief Justice announced a practice direction on AI in legal proceedings within weeks; none had been issued by 15 November 2026. | Confirmed (in extracts or summaries) | Bernama (English and Malay), The Sun, Malay Mail and NST report the announcement; nothing issued by 15 November 2026 was found. Caution: Free Malaysia Today reports a circular or guidelines from the Chief Registrar's office, so the final instrument may not be a practice direction. Memo and deck corrected. | The instrument when issued (practice direction or Chief Registrar's circular); the judiciary's eArahan database could not be checked. |
| L6 | 5.1, Pending or proposed | The Commissioner's site lists Public Consultation Paper No. 1/2026 on AI and personal data protection (dated 29 October 2026, not read); no final Commissioner guidance on AI or pseudonymised data was found. | Partly right; memo corrected | Gist right (draft guideline under s.48(g), no final text). But 29 October is only the main-page listing date: the consultation page and briefings give 5 October 2026 issue and 23 October 2026 close. The 'no final guidance' statement was out of date (30 April 2026 final guidelines). Memo corrected. | Text of Public Consultation Paper No. 1/2026; text of the final 2026 guidelines; whether the final Data Protection by Design text keeps the pseudonymisation advice. |
| L7 | 6.4 | Because Cloak runs on the firm's computers and Lawgistics never receives documents, keys or cloaked text, Lawgistics would not be a data processor for the documents, provided the product stays offline and support uses no real-matter material. | Confirmed (in extracts or summaries) | The legal test holds on copies of Act 709 s.4 and a KL Bar article. No Malaysian authority applies it to software on the client's own machines. Real caveat: the support file includes the matter log, which records staff names and logins, so a support file from a real matter would give Lawgistics personal data. Memo 6.4 and 6.10 corrected. | No authority applying the processor definition to offline software; the product facts come from Cloak, not public sources. |
| L8 | 5.3, opening paragraph | The Bar Council's guidance on generative AI and cloud services does not endorse or approve any product. | Confirmed (in extracts or summaries) | Extracts of the Bar's PDFs for 342/2023, 393/2024 and 242/2025, with FMT and The Edge. No Bar approval or sandbox scheme for any product was found (the product name was not searched). | Full circular texts (extracts only). |
| L9 | 5.2, Legal Profession Act | Breach of a practice and etiquette rule, or of a Bar Council direction or ruling, is misconduct (LPA s.94(3)(d) and (k)); s.94(2) penalties include striking off and suspension for up to five years. | Confirmed (in extracts or summaries) | Bar sources agree on (d) and (k). s.94(2) as rewritten by Act A1444 allows one or more of striking off, suspension up to five years, a fine up to RM50,000, reprimand or censure. Nuance: the Bar's preface says non-compliance 'may be regarded' as misconduct, so a finding is not automatic. | Current LPA reprint; whether any later amendment to s.94 exists (none found). |
| L10 | 5.2, Rule 35 | Rule 35 of the 1978 Practice and Etiquette Rules requires an advocate and solicitor to preserve the client's confidence and not exploit it; the duty survives the retainer. | Confirmed (in extracts or summaries) | The Bar's page for Rule 35 and a course reading give the same text. Strictly, the survival words belong to (b); (a) covers abuse for personal benefit or gain only. The memo's paraphrase is accurate. | Current Bar text of Rule 35 (extract only). |
| L11 | 5.1, Penalties | Since 1 April 2025 the maximum penalty for breaching the data protection principles is RM1,000,000 or three years or both (was RM300,000 or two years). | Confirmed (in extracts or summaries) | Section 4 of Act A1727 amends s.5(2); P.U.(B) 522/2024 brought it into force on 1 April 2025. Four law-firm sources agree; no later change found. Read in search extracts of a law firm's copy of the Act. | Official Reprint 2026 numbering of ss.5 and 9 (official sites blocked). |
| L12 | 5.1, Commencement | Act A1727 came into force in three stages (1 January, 1 April, 1 June 2025) under P.U.(B) 522/2024, so all of it has applied since 1 June 2025. | Confirmed (in extracts or summaries) | P.U.(B) 522/2024 brought ss.7, 11, 13, 14 into force on 1 January 2025, ss.2, 3, 4, 5, 8, 10, 12 on 1 April 2025, ss.6 and 9 on 1 June 2025. Detail: the notice was signed 19 December 2024 and gazetted 24 December 2024; Royal Assent (9 October 2024) and publication (17 October 2024) are printed on a law firm's copy and repeated by Deloitte. | Gazette PDF and AGC listing (read through a law firm's copy). |
| L13 | 5.1, Data processors and the Security Principle | Under s.9 the firm must get sufficient security guarantees from any processor; since 1 April 2025 the processor must itself comply or commit an offence (RM1,000,000 or three years). | Confirmed (in extracts or summaries) | Section 4 of Act A1727 inserted s.5(1A) (processor shall comply with the Security Principle in s.9) and amended s.5(2). The controller's duty to get sufficient guarantees stays in s.9(2). Section 5 of Act A1727 also amends s.9(1) (wording not confirmed). No source cites a 's.9(1A)'. Read in search extracts and law-firm notes. | Where the processor duty sits in the Reprint (s.5(1A) per secondary sources; wording of amended s.9(1)); not read in the official text. |
| L14 | 6.3 | The AI provider the lawyer chooses is likely the firm's data processor, so under s.9 the firm must get sufficient security guarantees and ensure reasonable steps to comply. | Partly right; memo corrected | Partly. The s.9(2) duty is on the firm: it must ensure that the processor gives sufficient guarantees and that the processor takes reasonable steps to comply. 'Likely a processor' needs a condition: s.4 defines a processor as acting 'solely on behalf of' the controller, so a provider that uses inputs for its own purposes (for example training) falls outside it. No Malaysian source deals with AI providers. Memo 6.3 corrected. | Position of an AI provider that uses inputs for its own purposes; no Malaysian authority. |
| L15 | 5.1, Guidelines No. 3/2025 | Guidelines No. 3/2025 (1.0, 29 April 2025) make a Transfer Impact Assessment optional and read s.129(3)(d) broadly (mediation, arbitration, pre-action correspondence, advice on a claim) but not a mere possibility of future proceedings. | Confirmed (in extracts or summaries) | Search extracts of the official PDF (paras 10.2 and 10.3) and four law-firm summaries agree: the assessment 'may' be done; legal proceedings read broadly; 'only a possibility' is not enough. Some summaries call the assessment mandatory, which the official text does not. | Pre-action and legal-risk limbs of para 10.3 have no secondary source; read only in extracts of the PDF. |
| L16 | 5.2, Evidence Act s.126 | Evidence Act 1950 s.126 forbids an advocate, without the client's express consent, to disclose professional communications, document contents or advice; the duty continues after the engagement. | Confirmed (in extracts or summaries) | Two independent copies of s.126 and Malaysia's WIPO submissions match. The provisos (illegal purpose; crime or fraud since the employment began) are in the memo. CommonLII itself could not be opened. | Current AGC reprint of the Evidence Act. |
| L17 | 5.1, Data breach notification (s.12B) | Since 1 June 2025 s.12B requires a controller to notify the Commissioner of a personal data breach as soon as practicable and to tell affected people without unnecessary delay where significant harm is likely; the guideline sets a 72-hour limit. | Confirmed (in extracts or summaries) | Briefings agree on s.12B (in force 1 June 2025), the duty to notify the Commissioner, notice to data subjects where significant harm is caused or likely, and the 72-hour outer limit (25 February 2025 guideline). Caveats: the guideline confines Commissioner notification to significant-harm breaches (one limb: more than 1,000 data subjects); sources differ on whether 72 hours runs from the breach or from becoming aware. Secondary sources give 7 days for notice to data subjects and, under s.12B(3), up to RM250,000, two years or both; not read in an official text. | s.12B penalty (RM250,000 or two years per secondary sources) and the data-subject notification deadline (7 days per secondary sources) in the Act and the guideline; whether the 72 hours runs from the breach or from awareness. |
| L18 | 5.1, Data protection officer (s.12A) | Since 1 June 2025 s.12A requires controllers and processors to appoint a data protection officer and notify the Commissioner within 21 days; thresholds above 20,000 data subjects, above 10,000 for sensitive data, or regular and systematic monitoring. | Partly right; memo corrected | Partly. s.12A commenced 1 June 2025; thresholds and the 21-day period (set by the Guideline, not s.12A) confirmed. Wrong in the memo: a controller and a processor each appoint a DPO and the processor's DPO is accountable to the processor; the s.12A(3) duty to notify the Commissioner is on the controller. Some briefings read the Guideline as also requiring processors to register. Circular numbering: 1/2025 (DPO) and 2/2025 (breach) in three sources. Residence test reported as 180 days a year in Malaysia or being easily contactable. Memo corrected. | Data-user registration is separate (see below). DPO residence test (180 days or easily contactable, secondary); whether processors must register; the Guideline text and its circular number (1/2025 or 2/2025). |
| L19 | 5.3, Circular No 342/2023 | Circular No 342/2023 (24 November 2023): the Bar Council neither endorses nor regulates generative AI; output must be checked; confidentiality risk; the lawyer remains responsible. | Confirmed (in extracts or summaries) | Search extracts of the Bar's PDF ('does not endorse or regulate', independent verification, redaction, responsibility) plus FMT and The Edge. The 'does not endorse or regulate' and responsibility points were seen only in the circular's own extracts. | Full circular text (extracts only). |
| L20 | 5.3, Circular No 393/2024 | Circular No 393/2024 (21 November 2024): cloud guidance is advisory, does not object to informed use, treats confidentiality as covering cybersecurity, flags overseas servers as a personal data issue, recommends encryption and access control. | Partly right; memo corrected | Partly. Search extracts of the Bar's PDF confirm the advisory status, informed use, cybersecurity, overseas servers (para 3.1(e): check the laws where servers sit; as best practice tell clients in writing) and encryption and access control (para 3.1(g)). One source only. The memo's 'does not endorse or prohibit any provider' appears in extracts as 'does not regulate cloud service providers' (para 1.7); to be checked against the PDF. | Full circular text; 'endorse or prohibit' against 'regulate'; single source. |

## The points still unverified

These are the exact points that the search could not settle. Each needs the official text, read in full.

1. **The Bar circulars: full texts, and whether they bind.** Circular No 342/2023, No 393/2024 and No 242/2025 were seen only in search extracts of the Bar's PDFs. Their full texts have not been read. Nothing found says whether No 242/2025 is advisory guidance (it is described as guidance prepared by the Bar Council's Legal Tech, AI and Sandbox Committee) or a Bar Council ruling within LPA s.94(3)(k). The Bar's preface says non-compliance "may be regarded" as misconduct. Items (h) and (i) of the 242/2025 list, and the wording "does not endorse or prohibit" against "does not regulate" in 393/2024, need the full text.
2. **The s.12B penalty and the notification deadline.** Secondary sources (Azmi & Associates; Raja, Darryl & Loh) say s.12B(3) carries a fine of up to RM250,000, up to two years' imprisonment or both, and that data subjects must be told within 7 days of the Commissioner being notified. Neither was read in the Act or in the Guideline on Data Breach Notification. Also open: whether the 72-hour limit runs from the breach or from becoming aware of it.
3. **Where the processor duty sits.** Secondary sources and a law firm's copy of Act A1727 place it in s.5(1A) (inserted by s.4 of Act A1727), with the penalty in s.5(2) and the controller's duty to get sufficient guarantees in s.9(2). The wording of the amended s.9(1) (s.5 of Act A1727) was not confirmed, and no source cites a "s.9(1A)". The Reprint 2026 was not read.
4. **Data-user registration for law firms.** The memo's statement that law firms fall within the "services" class of the Personal Data Protection (Class of Data Users) Order 2013 rests on a 2013 circular of a professional body (the Malaysian Institute of Accountants). The Order itself (P.U.(A) 336/2013, amended by P.U.(A) 326/2016) was not read, and this round did not check it.
5. **The data protection officer's residence.** Law-firm briefings say the officer must be resident or physically present in Malaysia, and describe the test as 180 days a year or being easily contactable. The Guideline was not read. Also open: whether the Guideline requires processors to register their officers, and whether the Guideline is numbered 1/2025 or 2/2025.

Other points not covered by this round: s.40(1)(b) and s.45 of Act 709, the Personal Data Protection Standard 2015, Rule 3 and Ruling 7A.03, Evidence Act ss.127 to 129, LPA s.77, the position in Sabah and Sarawak, and Malaysian case law (which needs a paid database). The memo's section 8 gives the status of each.

## Corrections made in the memo as a result

- **DPO (L18).** A controller and a processor each appoint an officer; the processor's officer answers to the processor; the duty to notify the Commissioner is on the controller; the 21 days come from the Guideline; residence test reported, unverified.
- **Processor duty (L13).** Placed at s.5(1A) and s.9(2) as reported by secondary sources, still marked as not read in the Reprint.
- **AI provider as processor (L14).** Likely a processor only if it acts solely on the firm's behalf; one that uses inputs for itself may fall outside the definition.
- **Bar circular 242/2025 (L1, L2).** Items (h) and (i) added; section 6.9 now says the circular may cover the cloaked workflow itself.
- **Cloud circular 393/2024 (L20).** Wording difference flagged for checking against the PDF.
- **Commissioner's 2026 texts (L3, L6).** Consultation No. 1/2026: issued 5 October 2026, comments closed 23 October 2026 (29 October is the main-page listing). Final guidelines on Data Protection by Design, DPIA and automated decision-making reported as issued 30 April 2026 (secondary; not read).
- **Court practice direction (L5).** The announcement is confirmed by four outlets (Bernama, The Sun, Malay Mail, New Straits Times); the final instrument may be a Chief Registrar's circular or guidelines. The pitch deck no longer says the courts "have announced" a direction.
- **Commencement (L12).** Notice signed 19 December 2024 and published 24 December 2024; Royal Assent and publication dates marked as printed on a law firm's copy.
- **Lawgistics' own role (L7).** The support file carries staff names and logins from the matter log, so it must not be made from a real matter without the firm's decision.

## Sources


**L1**

- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20242-2025.pdf
- https://www.malaysianbar.org.my/document/members/circulars/2025/2025&rid=49428
- https://theedgemalaysia.com/node/809649
- https://theedgemalaysia.com/node/799091
- https://www.techandjustice.bsg.ox.ac.uk/ai-in-malaysian-criminal-justice-sentencing-tools-and-regulations-ai-atlas

**L2**

- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20242-2025.pdf
- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20342-2023.pdf
- https://theedgemalaysia.com/node/809649
- https://www.techandjustice.bsg.ox.ac.uk/ai-in-malaysian-criminal-justice-sentencing-tools-and-regulations-ai-atlas

**L3**

- https://www.gatewayklia2.com.my/pdf/LAWS_OF_MALAYSIA_PDPA.pdf
- https://miea.com.my/sites/default/files/webmaster/Personal%20Data%20Protection%20Act%202010%20Act%20709_15Jun2016.pdf
- https://klbar.blogspot.com/2013/08/article-personal-data-protection-act.html
- https://www.roedl.com/en/insights/malaysia-personal-data-protection-amendment-act-2024/
- https://www.christopherleeong.com/viewpoints/launch-of-personal-data-protection-guideline-for-data-protection-by-design/
- https://www.allenandgledhill.com/perspectives/publications/bulletins-malaysia/2026/pdp-commissioner-launches-guidelines-on-data-protection-impact-assessment-automated-decision-making-and-profiling-and-data-protection-by-design/
- https://www.bakermckenzie.com/en/insight/publications/2026/10/malaysia-consultation-on-proposed-ai-and-personal-data-protection-framework
- https://conventuslaw.com/report/malaysia-public-consultation-on-proposed-ai-and-personal-data-protection-framework-to-close-on-23-october-2026/

**L4**

- https://christopherleeong.com/wp-content/uploads/2024/12/PDPA-Amendment-Act-A1727.pdf
- https://www.hoganlovells.com/en/publications/malaysias-groundbreaking-cross-border-data-transfer-guidelines-explained
- https://cms.law/en/int/legal-updates/malaysian-guidelines-on-cross-border-data-transfers
- https://www.azmilaw.com/insights/cross-border-personal-data-transfer-under-the-personal-data-protection-act-2010-as-explained-by-the-cross-border-personal-data-transfer-guideline/
- https://www.nagashima.com/en/publications/publication20250527-2/
- https://www.rahmatlim.com/perspectives/articles/30564/mykh-new-guidelines-on-cross-border-personal-data-transfer
- https://hhq.com.my/posts/exceptions-to-conduct-cross-border-personal-data-transfer/
- https://oneasia.legal/en/wp-content/themes/standard_black_cmspro/img/EN_09-2024-Amendments-to-Personal-Data-Protection-Act-2024_20241124.pdf

**L5**

- https://www.bernama.com/en/crime_courts/news.php?id=2626784
- https://www.bernama.com/bm/am/news.php?id=2626778
- https://thesun.my/news/malaysia-news/people-issues/judiciary-to-release-ai-practice-direction-for-lawyers-soon-says-cj/
- https://www.malaymail.com/news/malaysia/2026/10/28/malaysia-to-introduce-new-rules-on-ai-use-in-court-within-next-few-weeks-says-chief-justice/240978
- https://www.nst.com.my/news/nation/2026/10/1565273/judiciary-issue-ai-guidelines-lawyers-court-officers-coming-weeks
- https://www.freemalaysiatoday.com/category/nation/2026/10/28/chief-registrar-s-office-to-provide-guidelines-on-ai-use-in-court
- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20358-2026.pdf

**L6**

- https://www.pdp.gov.my/en/main-page/
- https://pdp.gov.my/jpdpv2/laws-of-malaysia-pdpa/public-consultation-paper/?lang=en
- https://digitalpolicyalert.org/change/21853-artificial-intelligence-and-personal-data-protection-framework
- https://digitalpolicyalert.org/event/44378-personal-data-protection-commissioner-opened-consultation-on-artificial-intelligence-and-personal-data-protection-framework
- https://www.bakermckenzie.com/en/insight/publications/2026/10/malaysia-consultation-on-proposed-ai-and-personal-data-protection-framework
- https://conventuslaw.com/report/malaysia-public-consultation-on-proposed-ai-and-personal-data-protection-framework-to-close-on-23-october-2026/
- https://ppc.land/malaysias-data-regulator-sets-23-october-deadline-for-ai-framework-comments/
- https://www.allenandgledhill.com/perspectives/publications/bulletins-malaysia/2026/pdp-commissioner-launches-guidelines-on-data-protection-impact-assessment-automated-decision-making-and-profiling-and-data-protection-by-design/
- https://www.bakermckenzie.com/en/insight/publications/2026/05/malaysia-new-personal-data-protection-guidelines
- https://www.hoganlovells.com/en/publications/malaysia-issues-three-data-protection-risk-management-guides
- https://www.roedl.com/en/insights/malaysia-new-personal-data-protection-guidelines/

**L7**

- https://www.scribd.com/doc/255178072/Laws-of-Malaysia-Pdpa
- https://www.gatewayklia2.com.my/pdf/LAWS_OF_MALAYSIA_PDPA.pdf
- https://klbar.blogspot.com/2013/08/article-personal-data-protection-act.html
- https://ww2.bsa.org/files/policy-filings/10122022controllerprodistinction.pdf

**L8**

- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20342-2023.pdf
- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20393-2024.pdf
- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20242-2025.pdf
- https://www.freemalaysiatoday.com/category/nation/2023/12/02/bar-sound-warning-on-using-chatgpt-in-legal-work
- https://theedgemalaysia.com/node/809649

**L9**

- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20057-2025.pdf
- https://www.malaysianbar.org.my/article/about-us/committees/conveyancing-practice/guidelines-for-referral-of-queries
- https://www.malaysianbar.org.my/cms/upload_files/document/Resolution%20to%20Recognise%20Workplace%20Bullying%20as%20a%20Form%20of%20Misconduct.pdf
- https://www.malaysianbar.org.my/article/news/bar-news/news/why-do-law-firms-now-need-approval-for-logos-bar-council-explains-new-rule-as-lawyers-debate
- https://www.malaysianbar.org.my/article/news/court-judgments/judgments/dato-kanagalingam-velupillai-v-majlis-peguam-anor-2004-hc
- https://www.malaysianbar.org.my/cms/upload_files/document/1)%20Legal%20Profession%20(Amendment)Act%202012%20%5B%20A1444%5D.pdf
- https://www.malaysianbar.org.my/article/news/press-statements/press-statements/press-release-the-ongoing-fight-against-dishonesty-in-the-legal-profession
- https://www.malaysianbar.org.my/article/members/practice-management/disciplinary-matters/disciplinary-orders/disciplinary-orders-november-2025-
- https://www.malaysianbar.org.my/bc_rulings/preface.html
- https://www.malaysianbar.org.my/cms/upload_files/document/Legal%20Profession%20Act%201976%20as%20at%201%20August%202018%20(English).from%20AGC%20website.pdf

**L10**

- https://www.malaysianbar.org.my/article/members/laws-bc-rulings-and-practice-directions/legal-profession-practice-and-etiquette-rules-1978/rule-35-advocate-and-solicitor-not-to-abuse-confidence-reposed-in-him-by-client-
- https://www.scribd.com/document/692267825/W4-Confidentiality
- https://www.scribd.com/document/661647768/Notes-ethics

**L11**

- https://christopherleeong.com/wp-content/uploads/2024/12/PDPA-Amendment-Act-A1727.pdf
- https://www.dfdl.com/insights/legal-and-tax-updates/malaysia-implementation-of-the-personal-data-protection-amendment-act-2024/
- https://www.dataprotectionreport.com/2025/01/new-horizons-in-data-protection-malaysias-personal-data-protection-amendment-act-2024/
- https://insightplus.bakermckenzie.com/bm/data-technology/malaysia-personal-data-protection-amendment-act-2024-to-come-into-force
- https://www.rajahtannasia.com/?p=161886

**L12**

- https://christopherleeong.com/wp-content/uploads/2024/12/PDPA-Amendment-PUB.pdf
- https://www.skrine.com/insights/alerts/december-2024/amendments-to-the-personal-data-protection-act-201
- https://www.rajahtannasia.com/?p=161886
- https://www.dataprotectionreport.com/2025/01/new-horizons-in-data-protection-malaysias-personal-data-protection-amendment-act-2024/
- https://digitalpolicyalert.org/event/30542-ministry-of-digital-adopted-order-on-appointment-of-date-of-coming-into-operation-for-personal-data-protection-amendment-act-2024-act-a1727
- https://christopherleeong.com/wp-content/uploads/2024/12/PDPA-Amendment-Act-A1727.pdf
- https://www.deloitte.com/southeast-asia/en/services/consulting-risk/perspectives/my-pdpa-amendments.html

**L13**

- https://christopherleeong.com/wp-content/uploads/2024/12/PDPA-Amendment-Act-A1727.pdf
- https://www.rajahtannasia.com/?p=154128
- https://insightplus.bakermckenzie.com/bm/data-technology/malaysia-personal-data-protection-amendment-act-2024-to-come-into-force
- https://conventuslaw.com/report/malaysia-save-the-dates-personal-data-protection-amendments-now-in-operation/
- https://conventuslaw.com/report/malaysia-dewan-rakyat-passes-proposed-amendments-to-pdpa/
- https://www.financierworldwide.com/transfers-of-personal-data-from-malaysia-understanding-the-requirements-of-the-personal-data-protection-act-2010

**L14**

- https://www.financierworldwide.com/transfers-of-personal-data-from-malaysia-understanding-the-requirements-of-the-personal-data-protection-act-2010
- https://dnh.com.my/protecting-personal-data-what-should-your-business-do/
- https://www.linklaters.com/insights/data-protected/data-protected---malaysia
- https://resourcehub.bakermckenzie.com/en/resources/global-data-and-cyber-handbook/asia-pacific/malaysia/topics/key-definitions
- https://conventuslaw.com/report/malaysia-protecting-personal-data-legal-obligations-and-practical-steps-for-malaysian-companies/
- https://www.rajahtannasia.com/?p=154128

**L15**

- https://www.pdp.gov.my/wp-content/uploads/2025/08/GP_CBPDT_EN-1.pdf
- https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2025/08/GP_CBPDT_EN.pdf
- https://cms.law/en/int/legal-updates/malaysian-guidelines-on-cross-border-data-transfers
- https://www.rajahtannasia.com/?p=172963
- https://hhq.com.my/?p=39654
- https://www.mayerbrown.com/en/insights/publications/2025/07/from-legislative-reform-to-practical-guidance-key-amendments-to-malaysias-pdpa-and-the-launch-of-cross-border-transfer-guidelines

**L16**

- https://www.lowpartners.com/evidence-act-1950/
- https://www.easylaw.com.my/statutes/general-litigation/evidence-act-1950
- https://www.wipo.int/documents/d/scp/docs-en-confidentiality-advisors-clients-docs-03_malaysia.pdf
- https://www.wipo.int/edocs/mdocs/mdocs/en/wipo_aippi_ip_ge_08/wipo_aippi_ip_ge_08_www_100616.pdf
- https://www.commonlii.org/my/legis/consol_act/ea19501971155/

**L17**

- https://insightplus.bakermckenzie.com/bm/data-technology/malaysia-personal-data-protection-amendment-act-2024-to-come-into-force
- https://www.rajahtannasia.com/?p=161886
- https://www.dfdl.com/insights/legal-and-tax-updates/malaysia-implementation-of-the-personal-data-protection-amendment-act-2024/
- https://cms.law/en/sgp/legal-updates/new-guidelines-on-mandatory-breach-notifications-under-malaysia-s-personal-data-protection-act-2010
- https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/
- https://hhq.com.my/posts/navigating-malaysias-mandatory-personal-data-breach-notification-obligations-under-the-pdpa/
- https://www.christopherleeong.com/viewpoints/launch-of-the-personal-data-protection-guidelines-for-mandatory-data-breach-notification-and-data-protection-officer-appointment/
- https://taypartners.com.my/data-breach-the-first-72-hours/
- https://alumni.azmilaw.com/protecting-personal-data-legal-obligations-and-practical-steps-for-malaysian-companies/
- https://rajadarrylloh.com/the-personal-data-protection-amendment-act-2024-and-guidelines-on-the-appointment-of-data-protection-officer-and-data-breach-notification/

**L18**

- https://www.pdp.gov.my/ppdpv1/wp-content/uploads/2024/11/Act-A1727.pdf
- https://www.christopherleeong.com/wp-content/uploads/2024/12/PDPA-Amendment-Act-A1727.pdf
- https://mylaw.my/legislation/akta-perlindungan-data-peribadi-pindaan-2024
- https://connectontech.bakermckenzie.com/malaysia-qa-on-appointment-of-data-protection-officer-and-data-breach-notification/
- https://www.azmilaw.com/insights/overview-on-the-appointment-of-personal-data-protection-officer-under-the-personal-data-protection-act-2010/
- https://www.christopherleeong.com/viewpoints/launch-of-the-personal-data-protection-guidelines-for-mandatory-data-breach-notification-and-data-protection-officer-appointment/
- https://cms.law/en/int/legal-updates/guidelines-on-appointment-of-data-protection-officers-in-malaysia
- https://privacymatters.dlapiper.com/2025/03/malaysia-guidelines-issued-on-data-breach-notification-and-data-protection-officer-appointment/
- https://jlpw.com.my/wp-content/uploads/2025/03/Legal%20Updates%20on%20DPO%20Guideline%20-%20280225%20JLPW%20v2.pdf
- https://www.hlc.com/en/publications/malaysia-introduces-mandatory-data-officer-appointment-what-this-means-for-your-business
- https://shooklin.com.my/legal-update/action-required-new-guidelines-on-data-protection-officer-appointment-data-breach-notification-and-cross-border-personal-data-transfers/
- https://www.maicsa.org.my/resources/technical-research/technical-announcements/2025/250228-dpdp-circulars-guidelines-on-personal-data-protection
- https://digitalpolicyalert.org/event/30315-personal-data-protection-commissioner-published-circular-on-personal-data-breach-notification-which-specifies-requirements-for-compliance-with-related-guidelines
- https://www.dfdl.com/insights/legal-and-tax-updates/malaysia-implementation-of-the-personal-data-protection-amendment-act-2024/

**L19**

- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20342-2023.pdf
- https://www.freemalaysiatoday.com/category/nation/2023/12/02/bar-sound-warning-on-using-chatgpt-in-legal-work
- https://theedgemalaysia.com/node/799091

**L20**

- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20393-2024.pdf
- https://www.malaysianbar.org.my/list/about-us/committees/cyberlaw
- https://www.malaysianbar.org.my/cms/upload_files/document/Circular%20No%20238-2023.pdf
