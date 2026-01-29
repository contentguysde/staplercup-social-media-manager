import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function PrivacyPage() {
  const { i18n } = useTranslation();
  const isGerman = i18n.language === 'de';

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">
              {isGerman ? 'Zur\u00fcck' : 'Back'}
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
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
      <main className="max-w-4xl mx-auto px-6 py-12">
        {isGerman ? <GermanContent /> : <EnglishContent />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center text-sm text-gray-500">
          {`Florian M\u00fcller | Content Guys`}
        </div>
      </footer>
    </div>
  );
}

function GermanContent() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">{`Datenschutzerkl\u00e4rung`}</h1>

      <p className="text-gray-700 leading-relaxed mb-6">
        {`Wir freuen uns sehr \u00fcber Ihr Interesse an unserem Unternehmen. Datenschutz hat einen besonders hohen Stellenwert f\u00fcr die Gesch\u00e4ftsleitung der Florian M\u00fcller | Content Guys. Eine Nutzung der Internetseiten der Florian M\u00fcller | Content Guys ist grunds\u00e4tzlich ohne jede Angabe personenbezogener Daten m\u00f6glich. Sofern eine betroffene Person besondere Services unseres Unternehmens \u00fcber unsere Internetseite in Anspruch nehmen m\u00f6chte, k\u00f6nnte jedoch eine Verarbeitung personenbezogener Daten erforderlich werden. Ist die Verarbeitung personenbezogener Daten erforderlich und besteht f\u00fcr eine solche Verarbeitung keine gesetzliche Grundlage, holen wir generell eine Einwilligung der betroffenen Person ein.`}
      </p>

      <p className="text-gray-700 leading-relaxed mb-6">
        {`Die Verarbeitung personenbezogener Daten, beispielsweise des Namens, der Anschrift, E-Mail-Adresse oder Telefonnummer einer betroffenen Person, erfolgt stets im Einklang mit der Datenschutz-Grundverordnung und in \u00dcbereinstimmung mit den f\u00fcr die Florian M\u00fcller | Content Guys geltenden landesspezifischen Datenschutzbestimmungen. Mittels dieser Datenschutzerkl\u00e4rung m\u00f6chte unser Unternehmen die \u00d6ffentlichkeit \u00fcber Art, Umfang und Zweck der von uns erhobenen, genutzten und verarbeiteten personenbezogenen Daten informieren. Ferner werden betroffene Personen mittels dieser Datenschutzerkl\u00e4rung \u00fcber die ihnen zustehenden Rechte aufgekl\u00e4rt.`}
      </p>

      <p className="text-gray-700 leading-relaxed mb-6">
        {`Die Florian M\u00fcller | Content Guys hat als f\u00fcr die Verarbeitung Verantwortlicher zahlreiche technische und organisatorische Ma\u00dfnahmen umgesetzt, um einen m\u00f6glichst l\u00fcckenlosen Schutz der \u00fcber diese Internetseite verarbeiteten personenbezogenen Daten sicherzustellen. Dennoch k\u00f6nnen internetbasierte Daten\u00fcbertragungen grunds\u00e4tzlich Sicherheitsl\u00fccken aufweisen, sodass ein absoluter Schutz nicht gew\u00e4hrleistet werden kann. Aus diesem Grund steht es jeder betroffenen Person frei, personenbezogene Daten auch auf alternativen Wegen, beispielsweise telefonisch, an uns zu \u00fcbermitteln.`}
      </p>

      {/* Section 1 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">1. Begriffsbestimmungen</h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        {`Die Datenschutzerkl\u00e4rung der Florian M\u00fcller | Content Guys beruht auf den Begrifflichkeiten, die durch den Europ\u00e4ischen Richtlinien- und Verordnungsgeber beim Erlass der Datenschutz-Grundverordnung (DS-GVO) verwendet wurden.`}
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
        <li><strong>a) personenbezogene Daten</strong> {`\u2013 Alle Informationen, die sich auf eine identifizierte oder identifizierbare nat\u00fcrliche Person beziehen.`}</li>
        <li><strong>b) betroffene Person</strong> {`\u2013 Jede identifizierte oder identifizierbare nat\u00fcrliche Person, deren personenbezogene Daten verarbeitet werden.`}</li>
        <li><strong>c) Verarbeitung</strong> {`\u2013 Jeder Vorgang im Zusammenhang mit personenbezogenen Daten.`}</li>
        <li><strong>{`d) Einschr\u00e4nkung der Verarbeitung`}</strong> {`\u2013 Markierung gespeicherter Daten zur Einschr\u00e4nkung k\u00fcnftiger Verarbeitung.`}</li>
        <li><strong>e) Profiling</strong> {`\u2013 Automatisierte Verarbeitung zur Bewertung pers\u00f6nlicher Aspekte.`}</li>
        <li><strong>f) Pseudonymisierung</strong> {`\u2013 Verarbeitung, bei der Daten ohne Zusatzinformationen nicht mehr zugeordnet werden k\u00f6nnen.`}</li>
        <li><strong>g) Verantwortlicher</strong> {`\u2013 Die Stelle, die \u00fcber Zwecke und Mittel der Verarbeitung entscheidet.`}</li>
        <li><strong>h) Auftragsverarbeiter</strong> {`\u2013 Stelle, die Daten im Auftrag des Verantwortlichen verarbeitet.`}</li>
        <li><strong>{`i) Empf\u00e4nger`}</strong> {`\u2013 Stelle, der Daten offengelegt werden.`}</li>
        <li><strong>j) Dritter</strong> {`\u2013 Stelle au\u00dfer der betroffenen Person, dem Verantwortlichen und dem Auftragsverarbeiter.`}</li>
        <li><strong>k) Einwilligung</strong> {`\u2013 Freiwillige Willensbekundung der betroffenen Person.`}</li>
      </ul>

      {/* Section 2 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">2. Name und Anschrift des Verantwortlichen</h2>
      <div className="bg-gray-50 rounded-lg p-6 mb-6 text-gray-700">
        <p className="font-semibold mb-2">{`Florian M\u00fcller | Content Guys`}</p>
        <p>{`Marktfeldstra\u00dfe 2a`}</p>
        <p>{`41063 M\u00f6nchengladbach`}</p>
        <p>Deutschland</p>
        <p className="mt-2">Tel.: +491786960851</p>
        <p>E-Mail: flo@content-guys.de</p>
        <p>Website: <a href="https://content-guys.de" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">https://content-guys.de</a></p>
      </div>

      {/* Section 3 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">3. Name und Anschrift des Datenschutzbeauftragten</h2>
      <div className="bg-gray-50 rounded-lg p-6 mb-6 text-gray-700">
        <p className="font-semibold mb-2">{`Florian M\u00fcller | Content Guys`}</p>
        <p>{`Marktfeldstra\u00dfe 2a`}</p>
        <p>{`41063 M\u00f6nchengladbach`}</p>
        <p>Deutschland</p>
        <p className="mt-2">Tel.: +491786960851</p>
        <p>E-Mail: flo@content-guys.de</p>
      </div>

      {/* Section 4 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">4. Cookies</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        {`Die Internetseiten verwenden Cookies. Cookies sind Textdateien, die \u00fcber einen Internetbrowser auf einem Computersystem gespeichert werden. Die betroffene Person kann die Setzung von Cookies jederzeit verhindern.`}
      </p>

      {/* Section 5 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">5. Erfassung von allgemeinen Daten und Informationen</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Die Internetseite erfasst allgemeine Daten wie Browsertypen, Betriebssystem, Referrer, Unterseiten, Zugriffszeitpunkt, IP-Adresse und Internet-Service-Provider.
      </p>

      {/* Section 6 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">{`6. Kontaktm\u00f6glichkeit \u00fcber die Internetseite`}</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        {`Bei Kontaktaufnahme per E-Mail oder Kontaktformular werden die \u00fcbermittelten Daten automatisch gespeichert. Es erfolgt keine Weitergabe an Dritte.`}
      </p>

      {/* Section 7 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">7. Kommentarfunktion im Blog</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Bei Kommentaren werden Angaben zum Zeitpunkt, Nutzernamen und IP-Adresse gespeichert.
      </p>

      {/* Section 8 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">{`8. Routinem\u00e4\u00dfige L\u00f6schung und Sperrung`}</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Personenbezogene Daten werden nur so lange gespeichert, wie es der Speicherungszweck erfordert.
      </p>

      {/* Section 9 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">9. Rechte der betroffenen Person</h2>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
        <li><strong>a)</strong> {`Recht auf Best\u00e4tigung`}</li>
        <li><strong>b)</strong> Recht auf Auskunft</li>
        <li><strong>c)</strong> Recht auf Berichtigung</li>
        <li><strong>d)</strong> {`Recht auf L\u00f6schung (Recht auf Vergessen werden)`}</li>
        <li><strong>e)</strong> {`Recht auf Einschr\u00e4nkung der Verarbeitung`}</li>
        <li><strong>f)</strong> {`Recht auf Daten\u00fcbertragbarkeit`}</li>
        <li><strong>g)</strong> Recht auf Widerspruch</li>
        <li><strong>h)</strong> {`Automatisierte Entscheidungen einschlie\u00dflich Profiling`}</li>
        <li><strong>i)</strong> Recht auf Widerruf einer datenschutzrechtlichen Einwilligung</li>
      </ul>

      {/* Section 10 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">10. Rechtsgrundlage der Verarbeitung</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Art. 6 I lit. a DS-GVO (Einwilligung), Art. 6 I lit. b DS-GVO (Vertrag), Art. 6 I lit. c DS-GVO (rechtliche Verpflichtung), Art. 6 I lit. d DS-GVO (lebenswichtige Interessen), Art. 6 I lit. f DS-GVO (berechtigte Interessen).
      </p>

      {/* Section 11 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">11. Berechtigte Interessen an der Verarbeitung</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        {`Berechtigtes Interesse ist die Durchf\u00fchrung unserer Gesch\u00e4ftst\u00e4tigkeit zugunsten des Wohlergehens aller Mitarbeiter und Anteilseigner.`}
      </p>

      {/* Section 12 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">12. Dauer der Speicherung</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        {`Kriterium ist die jeweilige gesetzliche Aufbewahrungsfrist. Nach Ablauf werden die Daten routinem\u00e4\u00dfig gel\u00f6scht.`}
      </p>

      {/* Section 13 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">13. Gesetzliche oder vertragliche Vorschriften zur Bereitstellung</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Die Bereitstellung personenbezogener Daten ist teilweise gesetzlich oder vertraglich vorgeschrieben.
      </p>

      {/* Section 14 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">14. Bestehen einer automatisierten Entscheidungsfindung</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Wir setzen keine automatische Entscheidungsfindung oder Profiling ein.
      </p>
    </article>
  );
}

function EnglishContent() {
  return (
    <article className="prose prose-gray max-w-none">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>

      <p className="text-gray-700 leading-relaxed mb-6">
        {`We are very pleased about your interest in our company. Data protection is of particularly high priority for the management of Florian M\u00fcller | Content Guys. The use of the websites of Florian M\u00fcller | Content Guys is generally possible without providing any personal data. However, if a data subject wishes to use special services of our company via our website, processing of personal data may become necessary. If the processing of personal data is required and there is no legal basis for such processing, we generally obtain consent from the data subject.`}
      </p>

      <p className="text-gray-700 leading-relaxed mb-6">
        {`The processing of personal data, such as the name, address, email address, or telephone number of a data subject, is always carried out in accordance with the General Data Protection Regulation and in compliance with the country-specific data protection regulations applicable to Florian M\u00fcller | Content Guys. By means of this privacy policy, our company wishes to inform the public about the nature, scope, and purpose of the personal data we collect, use, and process. Furthermore, data subjects are informed of their rights by means of this privacy policy.`}
      </p>

      <p className="text-gray-700 leading-relaxed mb-6">
        {`As the controller, Florian M\u00fcller | Content Guys has implemented numerous technical and organizational measures to ensure the most complete protection of personal data processed through this website. Nevertheless, internet-based data transmissions may have security gaps, so absolute protection cannot be guaranteed. For this reason, every data subject is free to transmit personal data to us by alternative means, for example by telephone.`}
      </p>

      {/* Section 1 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">1. Definitions</h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        {`The privacy policy of Florian M\u00fcller | Content Guys is based on the terminology used by the European legislator when adopting the General Data Protection Regulation (GDPR).`}
      </p>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
        <li><strong>a) Personal data</strong> {'\u2013'} Any information relating to an identified or identifiable natural person.</li>
        <li><strong>b) Data subject</strong> {'\u2013'} Any identified or identifiable natural person whose personal data is processed.</li>
        <li><strong>c) Processing</strong> {'\u2013'} Any operation related to personal data.</li>
        <li><strong>d) Restriction of processing</strong> {'\u2013'} Marking of stored data to limit their future processing.</li>
        <li><strong>e) Profiling</strong> {'\u2013'} Automated processing for the evaluation of personal aspects.</li>
        <li><strong>f) Pseudonymisation</strong> {'\u2013'} Processing in which data can no longer be attributed without additional information.</li>
        <li><strong>g) Controller</strong> {'\u2013'} The entity that determines the purposes and means of processing.</li>
        <li><strong>h) Processor</strong> {'\u2013'} An entity that processes data on behalf of the controller.</li>
        <li><strong>i) Recipient</strong> {'\u2013'} An entity to which data is disclosed.</li>
        <li><strong>j) Third party</strong> {'\u2013'} An entity other than the data subject, the controller, and the processor.</li>
        <li><strong>k) Consent</strong> {'\u2013'} A voluntary expression of will by the data subject.</li>
      </ul>

      {/* Section 2 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">2. Name and Address of the Controller</h2>
      <div className="bg-gray-50 rounded-lg p-6 mb-6 text-gray-700">
        <p className="font-semibold mb-2">{`Florian M\u00fcller | Content Guys`}</p>
        <p>{`Marktfeldstra\u00dfe 2a`}</p>
        <p>{`41063 M\u00f6nchengladbach`}</p>
        <p>Germany</p>
        <p className="mt-2">Phone: +491786960851</p>
        <p>Email: flo@content-guys.de</p>
        <p>Website: <a href="https://content-guys.de" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">https://content-guys.de</a></p>
      </div>

      {/* Section 3 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">3. Name and Address of the Data Protection Officer</h2>
      <div className="bg-gray-50 rounded-lg p-6 mb-6 text-gray-700">
        <p className="font-semibold mb-2">{`Florian M\u00fcller | Content Guys`}</p>
        <p>{`Marktfeldstra\u00dfe 2a`}</p>
        <p>{`41063 M\u00f6nchengladbach`}</p>
        <p>Germany</p>
        <p className="mt-2">Phone: +491786960851</p>
        <p>Email: flo@content-guys.de</p>
      </div>

      {/* Section 4 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">4. Cookies</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        The websites use cookies. Cookies are text files that are stored on a computer system via an internet browser. The data subject can prevent the setting of cookies at any time.
      </p>

      {/* Section 5 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">5. Collection of General Data and Information</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        The website collects general data such as browser types, operating system, referrer, sub-pages accessed, time of access, IP address, and internet service provider.
      </p>

      {/* Section 6 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">6. Contact via the Website</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        When contacting us via email or contact form, the transmitted data is automatically stored. No data is shared with third parties.
      </p>

      {/* Section 7 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">7. Comment Function in the Blog</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        For comments, information about the time, username, and IP address is stored.
      </p>

      {/* Section 8 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">8. Routine Deletion and Blocking</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Personal data is only stored for as long as the purpose of storage requires.
      </p>

      {/* Section 9 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">9. Rights of the Data Subject</h2>
      <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-6">
        <li><strong>a)</strong> Right to confirmation</li>
        <li><strong>b)</strong> Right to access</li>
        <li><strong>c)</strong> Right to rectification</li>
        <li><strong>d)</strong> Right to erasure (right to be forgotten)</li>
        <li><strong>e)</strong> Right to restriction of processing</li>
        <li><strong>f)</strong> Right to data portability</li>
        <li><strong>g)</strong> Right to object</li>
        <li><strong>h)</strong> Automated individual decision-making, including profiling</li>
        <li><strong>i)</strong> Right to withdraw consent under data protection law</li>
      </ul>

      {/* Section 10 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">10. Legal Basis for Processing</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Art. 6(1)(a) GDPR (consent), Art. 6(1)(b) GDPR (contract), Art. 6(1)(c) GDPR (legal obligation), Art. 6(1)(d) GDPR (vital interests), Art. 6(1)(f) GDPR (legitimate interests).
      </p>

      {/* Section 11 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">11. Legitimate Interests in Processing</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        The legitimate interest is the conduct of our business for the well-being of all employees and shareholders.
      </p>

      {/* Section 12 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">12. Duration of Storage</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        The criterion is the respective statutory retention period. After expiration, the data is routinely deleted.
      </p>

      {/* Section 13 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">13. Legal or Contractual Requirements for Providing Data</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        The provision of personal data is partly required by law or contract.
      </p>

      {/* Section 14 */}
      <h2 className="text-xl font-semibold text-gray-900 mt-10 mb-4">14. Existence of Automated Decision-Making</h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        We do not use automated decision-making or profiling.
      </p>
    </article>
  );
}
