import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';

const deContent = {
  title:
    'Allgemeine Geschäftsbedingungen von Content Guys / Florian Müller – im folgenden „Content Guys" genannt',
  date: 'Stand: 01.07.2018',
  sections: [
    {
      heading: '1. Zusammenarbeit',
      paragraphs: [
        '1.1. Die Parteien arbeiten vertrauensvoll zusammen und unterrichten sich bei Abweichungen von dem vereinbarten Vorgehen oder Zweifeln an der Richtigkeit der Vorgehensweise des anderen unverzüglich gegenseitig.',
        '1.2. Erkennt der Kunde, dass eigene Angaben und Anforderungen fehlerhaft, unvollständig, nicht eindeutig oder nicht durchführbar sind, hat er dies und die ihm erkennbaren Folgen Content Guys unverzüglich mitzuteilen.',
        '1.3. Die Vertragsparteien nennen einander Ansprechpartner und deren Stellvertreter, die die Durchführung des Vertragsverhältnisses verantwortlich und sachverständig leiten.',
        '1.4. Veränderungen in den benannten Personen haben die Parteien sich jeweils unverzüglich mitzuteilen. Bis zum Zugang einer solchen Mitteilung gelten die zuvor benannten Ansprechpartner und/oder deren Stellvertreter als berechtigt, im Rahmen ihrer bisherigen Vertretungsmacht Erklärungen abzugeben und entgegenzunehmen.',
        '1.5. Die Ansprechpartner verständigen sich in regelmäßigen Abständen über Fortschritte und Hindernisse bei der Vertragsdurchführung, um gegebenenfalls lenkend in die Durchführung des Vertrages eingreifen zu können.',
      ],
    },
    {
      heading: '2. Mitwirkungspflichten des Kunden',
      paragraphs: [
        '2.1. Der Kunde unterstützt Content Guys bei der Erfüllung ihrer vertraglich geschuldeten Leistungen. Dazu gehört insbesondere das rechtzeitige zur Verfügung stellen von Informationen, Datenmaterial sowie von Hard- und Software, soweit die Mitwirkungsleistungen des Kunden dies erfordern. Der Kunde wird Content Guys hinsichtlich der von Content Guys zu erbringenden Leistungen eingehend instruieren.',
        '2.2. Der Kunde stellt in der erforderlichen Zahl eigene Mitarbeiter zur Durchführung des Vertragsverhältnisses zur Verfügung, die über die erforderliche Fachkunde verfügen.',
        '2.3. Sofern sich der Kunde verpflichtet hat, Content Guys im Rahmen der Vertragsdurchführung (Bild-, Ton-, Text- o.ä.) Materialien zu beschaffen, wird der Kunde diese Content Guys schnellstmöglich und in einem gängigen, unmittelbar verwertbaren, digitalen Format zur Verfügung stellen. Ist eine Konvertierung des vom Kunden überlassenen Materials in ein anderes Format erforderlich, so übernimmt der Kunde die hierfür anfallenden Kosten. Der Kunde stellt sicher, dass Content Guys die zur Nutzung dieser Materialien erforderlichen Rechte erhält.',
        '2.4. Mitwirkungshandlungen nimmt der Kunde auf seine Kosten vor.',
      ],
    },
    {
      heading: '3. Beteiligung Dritter',
      paragraphs: [
        '3.1. Für Dritte, die auf Veranlassung oder unter Duldung des Kunden für ihn im Tätigkeitsbereich von Content Guys tätig werden, hat der Kunde wie für Erfüllungsgehilfen einzustehen. Content Guys hat es gegenüber dem Kunden nicht zu vertreten, wenn Content Guys aufgrund des Verhaltens eines der vorbezeichneten Dritten seinen Verpflichtungen gegenüber dem Kunden ganz oder teilweise nicht oder nicht rechtzeitig nachkommen kann.',
      ],
    },
    {
      heading: '4. Termine',
      paragraphs: [
        '4.1. Termine zur Leistungserbringung dürfen auf Seiten von Content Guys nur durch den Ansprechpartner zugesagt werden.',
        '4.2. Die Vertragsparteien werden Termine möglichst schriftlich festlegen. Termine, durch deren Nichteinhalten eine Vertragspartei nach § 286 Absatz 2 des Bürgerlichen Gesetzbuchs ohne Mahnung in Verzug gerät (verbindliche Termine), sind stets schriftlich festzulegen und als verbindlich zu bezeichnen. Eine angemessene Nachfrist ist durch den Kunden zu erteilen.',
        '4.3. Leistungsverzögerungen aufgrund höherer Gewalt (z. B. Streik, Aussperrung, behördliche Anordnungen, allgemeine Störungen der Telekommunikation usw.) und Umständen im Verantwortungsbereich des Kunden hat Content Guys nicht zu vertreten und berechtigen Content Guys, das Erbringen der betroffenen Leistungen um die Dauer der Behinderung zzgl. einer angemessenen Anlaufzeit hinauszuschieben. Content Guys wird dem Kunden Leistungsverzögerungen aufgrund höherer Gewalt anzeigen.',
      ],
    },
    {
      heading: '5. Leistungsänderungen',
      paragraphs: [
        '5.1. Will der Kunde den vertraglich bestimmten Umfang der von Content Guys zu erbringenden Leistungen ändern, wird er Content Guys seine Änderungswünsche schriftlich mitteilen. Das weitere Verfahren richtet sich nach den nachfolgenden Bestimmungen. Bei Änderungswünschen, die rasch geprüft und voraussichtlich innerhalb von 8 Arbeitsstunden umgesetzt werden können, kann Content Guys von dem Verfahren nach Absatz 5.2 bis 5.5 absehen.',
        '5.2. Content Guys prüft, welche Auswirkungen die gewünschte Änderung insbesondere hinsichtlich Vergütung, Mehraufwänden und Terminen haben wird.',
        '5.3. Nach Prüfung des Änderungswunsches wird Content Guys dem Kunden die Auswirkungen des Änderungswunsches auf die getroffenen Vereinbarungen darlegen.',
        '5.4. Die Vertragsparteien werden sich über den Inhalt eines Vorschlags für die Umsetzung des Änderungswunsches unverzüglich abstimmen und das Ergebnis einer erfolgreichen Abstimmung dem Text der Vereinbarung, auf die sich die Änderung bezieht, als Nachtragsvereinbarung beifügen.',
        '5.5. Kommt eine Einigung nicht zustande oder endet das Änderungsverfahren aus einem anderen Grund, so verbleibt es beim ursprünglichen Leistungsumfang.',
        '5.6. Die von dem Änderungsverfahren betroffenen Termine werden unter Berücksichtigung der Dauer der Prüfung, der Dauer der Abstimmung über den Änderungsvorschlag und gegebenenfalls der Dauer der auszuführenden Änderungswünsche zuzüglich einer angemessenen Anlauffrist soweit erforderlich verschoben.',
        '5.7. Der Kunde hat die durch das Änderungsverlangen entstehenden Aufwände zu tragen.',
        '5.8. Content Guys ist berechtigt, die nach dem Vertrag zu erbringenden Leistungen zu ändern oder von ihnen abzuweichen, wenn die Änderung oder Abweichung notwendig ist und für den Kunden zumutbar ist.',
      ],
    },
    {
      heading: '6. Vergütung',
      paragraphs: [
        '6.1. Der Kunde trägt gegen Nachweis und vorheriger Abstimmung sämtliche Auslagen wie Reise- und Übernachtungskosten, Spesen und im Rahmen der Vertragsdurchführung anfallenden Entgeltforderungen Dritter. Reisekosten werden nur ersetzt, wenn der Anreiseweg vom Sitz von Content Guys mehr als 50 Km beträgt. Für die Abwicklung von Aufträgen mit Dritten wird Content Guys eine Handling Fee in Höhe von 15% des Nettovolumens erheben.',
        '6.2. Die Vergütung von Content Guys erfolgt grundsätzlich nach Pauschalvereinbarungen im Angebot oder nach Zeitaufwand.',
        '6.3. Haben die Parteien keine gesonderte Vereinbarung über die Vergütung einer Leistung getroffen, hat der Kunde die übliche Vergütung zu entrichten.',
        '6.4. Alle vertraglich vereinbarten Vergütungen verstehen sich in Euro und zzgl. der gesetzlichen Umsatzsteuer.',
        '6.5. Gemäß Richtlinie 2011/7/EU sind die in der Rechnung aufgeführten Beträge sofort und ohne Abzug fällig. Der Verzug tritt 8 Tage nach Rechnungsstellung ein. Verzugszinsen: 9% zzgl. Basiszinssatz. Mahngebühr: 40,00 EUR je Mahnung.',
        '6.6. Urheberrechte an Präsentations- und Pitcharbeiten verbleiben bei Content Guys bis zur Auftragserteilung.',
        '6.7. Eine Herausgabe- und Aufbewahrungspflicht besteht nicht.',
      ],
    },
    {
      heading: '7. Rechte',
      paragraphs: [
        '7.1. Content Guys gewährt dem Kunden das einfache, räumlich und zeitlich nicht beschränkte Recht zur vertragsgemäßen Nutzung.',
        '7.2. Weitergehende Nutzung ist unzulässig. Insbesondere keine Unterlizenzen.',
        '7.3. Content Guys darf Software beliebig weiterverwenden, sofern der Kunde nicht bei Projektstart widerspricht.',
        '7.4. Bis zur vollständigen Zahlung ist der Einsatz nur widerruflich gestattet.',
        '7.5. Content Guys stellt den Kunden von Schutzrechtsverletzungen frei.',
        '7.6. Bei Schutzrechtsverletzungen darf Content Guys Änderungen vornehmen oder Nutzungsrechte erwerben.',
      ],
    },
    {
      heading: '8. Eigentumsvorbehalt',
      paragraphs: [
        '8.1. Ohne förmliche Abnahme gilt die Leistung mit Nutzung als abgenommen.',
        '8.2. Bis zur vollständigen Zahlung bleibt die Leistung Eigentum von Content Guys.',
      ],
    },
    {
      heading: '9. Gewährleistung & Haftungsbeschränkung',
      paragraphs: [
        '9.1. Gewährleistungsfrist: 6 Monate.',
        '9.2. Mängel ergeben sich nur aus der Funktionsspezifikation.',
        '9.3. Haftung für zugesicherte Eigenschaften unbeschränkt. Sonstige Haftung auf 30% des Auftragsvolumens beschränkt.',
        '9.4. Haftung für entgangenen Gewinn ausgeschlossen.',
        '9.5. Keine Haftung für Drittsysteme.',
        '9.6. Open-Source-Software als kostenlose Dreingabe.',
      ],
    },
    {
      heading: '10. Haftung',
      paragraphs: [
        '10.1. Haftung für Vorsatz und grobe Fahrlässigkeit. Leichte Fahrlässigkeit nur bei Kardinalpflichtverletzung.',
        '10.2. Haftung bei leichter Fahrlässigkeit: max. 50% Netto-Auftragswert, max. 100.000 EUR.',
        '10.3. Keine Haftung für Datenverlust bei fehlender Datensicherung des Kunden.',
        '10.4. Keine Haftung für Datendiebstahl außer bei grober Fahrlässigkeit.',
        '10.5. Gilt auch für Erfüllungsgehilfen.',
      ],
    },
    {
      heading: '11. Abwerbungsverbot',
      paragraphs: [
        '11.1. Abwerbungsverbot für 1 Jahr nach Zusammenarbeit. Vertragsstrafe bei Verstoß.',
      ],
    },
    {
      heading: '12. Geheimhaltung, Presseerklärung',
      paragraphs: [
        '12.1-12.8. Vertraulichkeit, Referenzrecht für Content Guys, Impressumspflicht.',
      ],
    },
    {
      heading: '13. Schlichtung',
      paragraphs: [
        '13.1-13.5. Schlichtungsverfahren vor Gerichtsweg.',
      ],
    },
    {
      heading: '14. Sonstiges',
      paragraphs: [
        '14.1-14.8. Abtretung zulässig, Schriftform, Salvatorische Klausel, deutsches Recht, Gerichtsstand Mönchengladbach.',
      ],
    },
  ],
};

const enContent = {
  title:
    "General Terms and Conditions of Content Guys / Florian Müller – hereinafter referred to as 'Content Guys'",
  date: 'Effective: July 1, 2018',
  sections: [
    {
      heading: '1. Cooperation',
      paragraphs: [
        '1.1. The parties shall cooperate in a spirit of mutual trust and shall immediately inform each other of any deviations from the agreed procedure or any doubts regarding the correctness of the other party\'s approach.',
        '1.2. If the client recognizes that their own information and requirements are erroneous, incomplete, ambiguous, or not feasible, the client shall immediately notify Content Guys of this and the consequences recognizable to the client.',
        '1.3. The contracting parties shall designate contact persons and their deputies who shall responsibly and competently manage the execution of the contractual relationship.',
        '1.4. The parties shall immediately notify each other of any changes to the designated persons. Until receipt of such notification, the previously designated contact persons and/or their deputies shall be deemed authorized to make and receive declarations within the scope of their previous authority.',
        '1.5. The contact persons shall communicate at regular intervals about progress and obstacles in the execution of the contract in order to be able to intervene in the execution of the contract if necessary.',
      ],
    },
    {
      heading: '2. Client Cooperation Obligations',
      paragraphs: [
        '2.1. The client shall support Content Guys in fulfilling its contractually owed services. This includes in particular the timely provision of information, data material, and hardware and software, insofar as the client\'s cooperation obligations require this. The client shall provide Content Guys with detailed instructions regarding the services to be provided by Content Guys.',
        '2.2. The client shall make available the required number of its own employees for the execution of the contractual relationship who have the necessary expertise.',
        '2.3. If the client has committed to procuring materials (image, audio, text, or similar) for Content Guys within the scope of contract execution, the client shall provide these to Content Guys as quickly as possible and in a common, immediately usable digital format. If conversion of the material provided by the client into another format is required, the client shall bear the costs incurred. The client shall ensure that Content Guys receives the rights necessary to use these materials.',
        '2.4. The client shall perform cooperation obligations at its own expense.',
      ],
    },
    {
      heading: '3. Involvement of Third Parties',
      paragraphs: [
        '3.1. The client shall be liable for third parties who act on behalf of or with the tolerance of the client in the area of activity of Content Guys as if they were vicarious agents. Content Guys shall not be liable to the client if Content Guys is unable to fulfill its obligations to the client in whole or in part, or in a timely manner, due to the conduct of any of the aforementioned third parties.',
      ],
    },
    {
      heading: '4. Deadlines',
      paragraphs: [
        '4.1. Deadlines for service provision may only be agreed upon on the part of Content Guys by the designated contact person.',
        '4.2. The contracting parties shall, as far as possible, set deadlines in writing. Deadlines whose non-compliance would cause a contracting party to be in default without a reminder pursuant to Section 286 paragraph 2 of the German Civil Code (binding deadlines) shall always be set in writing and designated as binding. The client shall grant a reasonable grace period.',
        '4.3. Content Guys shall not be liable for delays in performance due to force majeure (e.g., strikes, lockouts, official orders, general disruptions in telecommunications, etc.) and circumstances within the client\'s area of responsibility, and such events shall entitle Content Guys to postpone the provision of the affected services by the duration of the impediment plus a reasonable start-up period. Content Guys shall notify the client of performance delays due to force majeure.',
      ],
    },
    {
      heading: '5. Changes to Services',
      paragraphs: [
        '5.1. If the client wishes to change the contractually defined scope of services to be provided by Content Guys, the client shall notify Content Guys of the desired changes in writing. The further procedure shall be governed by the following provisions. For change requests that can be quickly reviewed and are expected to be implemented within 8 working hours, Content Guys may waive the procedure described in paragraphs 5.2 to 5.5.',
        '5.2. Content Guys shall examine what effects the desired change will have, particularly with regard to remuneration, additional costs, and deadlines.',
        '5.3. After reviewing the change request, Content Guys shall explain to the client the effects of the change request on the agreements made.',
        '5.4. The contracting parties shall immediately coordinate on the content of a proposal for implementing the change request and attach the result of a successful coordination to the text of the agreement to which the change relates as a supplementary agreement.',
        '5.5. If no agreement is reached or the change process ends for another reason, the original scope of services shall remain in effect.',
        '5.6. The deadlines affected by the change process shall be postponed as necessary, taking into account the duration of the review, the duration of the coordination on the change proposal, and, if applicable, the duration of the change requests to be executed, plus a reasonable start-up period.',
        '5.7. The client shall bear the costs arising from the change request.',
        '5.8. Content Guys shall be entitled to change or deviate from the services to be provided under the contract if the change or deviation is necessary and reasonable for the client.',
      ],
    },
    {
      heading: '6. Remuneration',
      paragraphs: [
        '6.1. The client shall bear, upon proof and prior agreement, all expenses such as travel and accommodation costs, per diem allowances, and third-party payment claims arising in the course of contract execution. Travel costs shall only be reimbursed if the travel distance from Content Guys\' registered office exceeds 50 km. For the handling of orders with third parties, Content Guys shall charge a handling fee of 15% of the net volume.',
        '6.2. Remuneration of Content Guys shall generally be based on lump-sum agreements in the offer or on time spent.',
        '6.3. If the parties have not made a separate agreement on remuneration for a service, the client shall pay the customary remuneration.',
        '6.4. All contractually agreed remunerations are in euros and are exclusive of the statutory value-added tax.',
        '6.5. In accordance with Directive 2011/7/EU, the amounts listed in the invoice are due immediately and without deduction. Default occurs 8 days after invoicing. Default interest: 9% plus base rate. Reminder fee: EUR 40.00 per reminder.',
        '6.6. Copyrights to presentation and pitch work shall remain with Content Guys until the order is placed.',
        '6.7. There is no obligation to surrender or store materials.',
      ],
    },
    {
      heading: '7. Rights',
      paragraphs: [
        '7.1. Content Guys grants the client the simple, spatially and temporally unrestricted right to use the services in accordance with the contract.',
        '7.2. Further use is not permitted. In particular, no sublicensing is allowed.',
        '7.3. Content Guys may freely reuse software, provided the client does not object at the start of the project.',
        '7.4. Until full payment, use is only permitted on a revocable basis.',
        '7.5. Content Guys shall indemnify the client against intellectual property rights infringements.',
        '7.6. In the event of intellectual property rights infringements, Content Guys may make changes or acquire usage rights.',
      ],
    },
    {
      heading: '8. Retention of Title',
      paragraphs: [
        '8.1. Without formal acceptance, the service shall be deemed accepted upon use.',
        '8.2. Until full payment, the service shall remain the property of Content Guys.',
      ],
    },
    {
      heading: '9. Warranty & Limitation of Liability',
      paragraphs: [
        '9.1. Warranty period: 6 months.',
        '9.2. Defects are determined solely by the functional specification.',
        '9.3. Liability for guaranteed characteristics is unlimited. Other liability is limited to 30% of the order volume.',
        '9.4. Liability for lost profits is excluded.',
        '9.5. No liability for third-party systems.',
        '9.6. Open-source software is provided as a free addition.',
      ],
    },
    {
      heading: '10. Liability',
      paragraphs: [
        '10.1. Liability for intent and gross negligence. Liability for slight negligence only in the case of breach of cardinal obligations.',
        '10.2. Liability for slight negligence: max. 50% of the net order value, max. EUR 100,000.',
        '10.3. No liability for data loss in the absence of data backup by the client.',
        '10.4. No liability for data theft except in the case of gross negligence.',
        '10.5. This also applies to vicarious agents.',
      ],
    },
    {
      heading: '11. Non-Solicitation',
      paragraphs: [
        '11.1. Non-solicitation clause for 1 year after cooperation. Contractual penalty in case of violation.',
      ],
    },
    {
      heading: '12. Confidentiality, Press Releases',
      paragraphs: [
        '12.1-12.8. Confidentiality, reference rights for Content Guys, imprint obligations.',
      ],
    },
    {
      heading: '13. Mediation',
      paragraphs: [
        '13.1-13.5. Mediation procedure before legal proceedings.',
      ],
    },
    {
      heading: '14. Miscellaneous',
      paragraphs: [
        '14.1-14.8. Assignment permitted, written form requirement, severability clause, German law, jurisdiction: Mönchengladbach.',
      ],
    },
  ],
};

export function TermsPage() {
  const { i18n } = useTranslation();
  const isGerman = i18n.language === 'de';
  const content = isGerman ? deContent : enContent;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={16} />
            <span>{isGerman ? 'Zurück' : 'Back'}</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-white"
              >
                <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                <line x1="6" x2="6" y1="2" y2="4" />
                <line x1="10" x2="10" y1="2" y2="4" />
                <line x1="14" x2="14" y1="2" y2="4" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-900">StaplerCup Social</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {content.title}
        </h1>
        <p className="text-sm text-gray-500 mb-10">{content.date}</p>

        <div className="space-y-8">
          {content.sections.map((section, sectionIndex) => (
            <section key={sectionIndex}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {section.heading}
              </h2>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph, pIndex) => (
                  <p
                    key={pIndex}
                    className="text-sm leading-relaxed text-gray-700"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-gray-400">
            Content Guys / Florian Müller
          </p>
          <p className="text-xs text-gray-400 mt-1">
            StaplerCup Social Media Manager
          </p>
        </div>
      </footer>
    </div>
  );
}
