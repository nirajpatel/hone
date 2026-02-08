import { Button } from './ui/button';
import screenshotImage from '../assets/98f92a7c018f00bd3ddf208b090d1f31d63015b6.webp';

interface A2POptInProofProps {
  onBack: () => void;
}

export function A2POptInProof({ onBack }: A2POptInProofProps) {
  return (
    <div className="bg-gray-50 py-8 px-4" style={{ minHeight: '100dvh' }}>
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <Button onClick={onBack} variant="outline" className="mb-6 cursor-pointer">
          ← Back to App
        </Button>
        
        <h1 className="text-3xl mb-6">A2P 10DLC Opt-In Proof</h1>
        
        <div className="space-y-6">
          <section>
            <h2 className="text-xl mb-3">SMS Consent Flow Documentation</h2>
            <p className="text-gray-700 mb-4">
              This page provides proof of our A2P (Application-to-Person) SMS opt-in consent flow for 10DLC compliance. 
              Users must explicitly consent to receive SMS notifications by adding their phone number in the Account Settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">Opt-In Mechanism</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2">User Consent Requirements:</h3>
              <ul className="list-disc ml-6 space-y-1 text-gray-700">
                <li>Users must log into the Hone website</li>
                <li>Users must navigate to Profile (Account Settings)</li>
                <li>Users must manually enter their mobile phone number</li>
                <li>Users must check an unchecked checkbox explicitly consenting to receive SMS/text messages</li>
                <li>Clear consent language is displayed before submission</li>
                <li>Users must click "Save Changes" to confirm opt-in</li>
                <li>Links to Terms and Conditions and Privacy Policy are provided in the consent language</li>
                <li>Opt-out instructions are clearly stated (reply STOP or uncheck the box)</li>
                <li>SMS consent is not required to use the app and is not bundled with acceptance of Terms of Service</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl mb-3">Consent Language</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-800">
                "By checking this box, you agree to receive recurring SMS messages from Hone related to rating your coffee extractions. Message frequency varies (up to 2 messages per extraction). Msg & data rates may apply. Reply STOP to unsubscribe or HELP for help. See Terms and Conditions (link) and Privacy Policy (link)."
              </p>
            </div>
            <p className="text-gray-700 text-sm">
              <strong>Links provided in consent:</strong>
            </p>
            <ul className="list-disc ml-6 text-sm text-gray-700 mt-2">
              <li>Terms and Conditions: <a href="https://start-erase-30181626.figma.site/terms" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">https://start-erase-30181626.figma.site/terms</a></li>
              <li>Privacy Policy: <a href="https://start-erase-30181626.figma.site/privacy" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">https://start-erase-30181626.figma.site/privacy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mb-3">Screenshot Evidence</h2>
            <p className="text-gray-700 mb-4">
              Below is a screenshot of the Account Settings dialog showing the phone number field with complete consent language 
              and links to our Terms and Conditions and Privacy Policy pages.
            </p>
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <img 
                src={screenshotImage} 
                alt="Account Settings showing SMS opt-in consent with phone number field and consent language including links to Terms and Conditions and Privacy Policy" 
                className="w-full h-auto"
              />
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl mb-3">Message Use Case</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-700 mb-2">
                <strong>Purpose:</strong> Coffee extraction quality rating reminders
              </p>
              <p className="text-gray-700 mb-2">
                <strong>Message Frequency:</strong> Up to 2 messages per extraction (initial message at 5 minutes + 1 reminder at 15 minutes)
              </p>
              <p className="text-gray-700 mb-2">
                <strong>Sample Message:</strong> "Hey! How was your extraction of Ritual - Guatemala from Jan 25 at 10:30 AM? Reply with 1 (Bad), 2 (Decent), or 3 (Exceptional)."
              </p>
              <p className="text-gray-700">
                <strong>Opt-Out:</strong> Reply STOP to any message or remove phone number from profile
              </p>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl mb-3">Compliance Information</h2>
            <div className="space-y-2 text-gray-700">
              <p><strong>Application Name:</strong> Hone</p>
              <p><strong>Message Type:</strong> Transactional/Notification</p>
              <p><strong>Opt-In Method:</strong> Web Form with Explicit Consent</p>
              <p><strong>SMS Provider:</strong> Twilio</p>
              <p><strong>Privacy Policy:</strong> <a href="https://start-erase-30181626.figma.site/privacy" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">https://start-erase-30181626.figma.site/privacy</a></p>
              <p><strong>Terms and Conditions:</strong> <a href="https://start-erase-30181626.figma.site/terms" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">https://start-erase-30181626.figma.site/terms</a></p>
            </div>
          </section>

          <p className="text-sm text-gray-500 mt-8">
            Documentation generated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}