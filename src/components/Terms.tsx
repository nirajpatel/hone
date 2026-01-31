import { Button } from './ui/button';

interface TermsProps {
  onBack: () => void;
}

export function Terms({ onBack }: TermsProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <Button onClick={onBack} variant="outline" className="mb-6 cursor-pointer">
          ← Back to App
        </Button>
        
        <h1 className="text-3xl mb-6">Terms and Conditions</h1>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using this coffee extraction tracking application ("Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">2. Description of Service</h2>
            <p>
              This Service provides tools for tracking coffee extractions, managing coffee inventory, and receiving SMS notifications related to extraction quality ratings. The Service includes:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Extraction logging with brew parameters and quality ratings</li>
              <li>Coffee inventory management with roaster and roast date tracking</li>
              <li>QR code generation for coffee identification</li>
              <li>SMS reminder notifications for rating extractions</li>
              <li>Photo analysis using AI for coffee bag information extraction</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mb-3">3. User Account</h2>
            <p>
              You must create an account using Google authentication to use this Service. You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">4. SMS Notifications</h2>
            <p>
              By using this Service, you consent to receive SMS text messages related to extraction rating reminders. Standard message and data rates may apply. You may receive up to 2 messages per extraction (initial notification at 5 minutes plus 1 reminder at 15 minutes). You can stop receiving messages at any time by responding "STOP" to any SMS message from our service.
            </p>
            <p className="mt-2">
              Message frequency varies based on your usage of the extraction logging feature. We use Twilio for SMS delivery.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">5. Data Collection and Use</h2>
            <p>
              The Service collects and stores:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>User profile information (name, email, profile photo from Google)</li>
              <li>Coffee extraction data (brew parameters, ratings, timestamps)</li>
              <li>Coffee inventory information (roaster, name, roast date, regions, tasting notes)</li>
              <li>Phone numbers for SMS notification delivery</li>
              <li>Photos uploaded for coffee bag analysis</li>
            </ul>
            <p className="mt-2">
              For more details on how we handle your data, please see our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">6. User Conduct</h2>
            <p>
              You agree not to use the Service to:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Upload malicious content or attempt to compromise the Service</li>
              <li>Share access credentials with unauthorized users</li>
              <li>Abuse the SMS notification system</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mb-3">7. AI-Powered Features</h2>
            <p>
              The Service uses OpenAI's GPT-4 Vision API to analyze coffee bag photos. The accuracy of extracted information depends on photo quality and is provided "as-is" without guarantees. You are responsible for verifying all auto-populated information.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">8. Disclaimer of Warranties</h2>
            <p>
              The Service is provided "as is" and "as available" without any warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, timely, secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">9. Limitation of Liability</h2>
            <p>
              In no event shall the Service operators be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the Service following any changes constitutes acceptance of those changes.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">11. Termination</h2>
            <p>
              We may terminate or suspend your access to the Service immediately, without prior notice or liability, for any reason, including breach of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">12. Contact</h2>
            <p>
              If you have any questions about these Terms, please contact us through the application.
            </p>
          </section>

          <p className="text-sm text-gray-500 mt-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}