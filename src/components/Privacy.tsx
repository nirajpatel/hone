import { Button } from './ui/button';

interface PrivacyProps {
  onBack: () => void;
}

export function Privacy({ onBack }: PrivacyProps) {
  return (
    <div className="bg-gray-50 py-8 px-4" style={{ minHeight: '100dvh' }}>
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <Button onClick={onBack} variant="outline" className="mb-6 cursor-pointer">
          ← Back to App
        </Button>
        
        <h1 className="text-3xl mb-6">Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl mb-3">1. Information We Collect</h2>
            
            <h3 className="font-semibold mt-4 mb-2">1.1 Personal Information</h3>
            <p>
              When you sign in with Google authentication, we collect:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Name</li>
              <li>Email address</li>
              <li>Profile photo</li>
              <li>Google account ID</li>
            </ul>

            <h3 className="font-semibold mt-4 mb-2">1.2 Phone Numbers</h3>
            <p>
              We collect phone numbers that you provide to receive SMS notifications about extraction ratings. Phone numbers are stored securely and used solely for sending extraction-related reminders.
            </p>

            <h3 className="font-semibold mt-4 mb-2">1.3 Extraction Data</h3>
            <p>
              We collect and store information about your coffee extractions, including:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Brew method (espresso, pour over, etc.)</li>
              <li>Grind settings</li>
              <li>Coffee dosage</li>
              <li>Extraction time and weight</li>
              <li>Quality ratings (1-3 stars)</li>
              <li>Date and time of extraction</li>
              <li>Associated coffee and barista information</li>
            </ul>

            <h3 className="font-semibold mt-4 mb-2">1.4 Coffee Inventory Data</h3>
            <p>
              We store information about your coffee inventory:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Roaster name</li>
              <li>Coffee name</li>
              <li>Roast date</li>
              <li>Origin regions</li>
              <li>Tasting notes</li>
              <li>Temperature preferences</li>
            </ul>

            <h3 className="font-semibold mt-4 mb-2">1.5 Photos and Images</h3>
            <p>
              When you upload photos of coffee bags for automatic information extraction, these images are:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Sent to OpenAI's GPT-4 Vision API for processing</li>
              <li>Not permanently stored by our Service</li>
              <li>Processed in accordance with OpenAI's privacy policy</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mb-3">2. How We Use Your Information</h2>
            <p>
              We use the collected information to:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Provide and maintain the Service</li>
              <li>Authenticate your identity and manage your account</li>
              <li>Store and retrieve your extraction and coffee data</li>
              <li>Send SMS notifications for extraction rating reminders</li>
              <li>Generate QR codes for coffee identification</li>
              <li>Analyze coffee bag photos to auto-populate coffee information</li>
              <li>Calculate aggregate statistics and average ratings</li>
              <li>Improve and optimize the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mb-3">3. SMS Communications</h2>
            <p>
              We use Twilio to send SMS text messages. When you provide a phone number:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>You consent to receive extraction rating reminders via SMS</li>
              <li>You may receive up to 2 messages per extraction</li>
              <li>Standard message and data rates may apply</li>
              <li>You can opt out at any time by replying "STOP" to any message</li>
              <li>Your phone number is shared with Twilio for message delivery</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mb-3">4. Third-Party Services</h2>
            
            <h3 className="font-semibold mt-4 mb-2">4.1 Google Authentication</h3>
            <p>
              We use Google OAuth for authentication. Your use of Google sign-in is subject to Google's Privacy Policy.
            </p>

            <h3 className="font-semibold mt-4 mb-2">4.2 Supabase</h3>
            <p>
              We use Supabase for database hosting, authentication, and storage. Data is stored on Supabase's secure infrastructure.
            </p>

            <h3 className="font-semibold mt-4 mb-2">4.3 OpenAI</h3>
            <p>
              Coffee bag photos are processed using OpenAI's GPT-4 Vision API. Photos sent to OpenAI are subject to OpenAI's privacy policy and data retention practices.
            </p>

            <h3 className="font-semibold mt-4 mb-2">4.4 Twilio</h3>
            <p>
              We use Twilio for SMS message delivery. Your phone number and message content are processed by Twilio in accordance with their privacy policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">5. Data Storage and Security</h2>
            <p>
              We implement security measures to protect your data:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Data is stored in secure Supabase databases with encryption</li>
              <li>Authentication uses industry-standard OAuth 2.0</li>
              <li>Access to data is restricted to authenticated users</li>
              <li>QR codes use unique identifiers, not personally identifiable information</li>
            </ul>
            <p className="mt-2">
              However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide the Service. You can request deletion of your data by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">7. Your Rights</h2>
            <p>
              You have the right to:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of SMS notifications</li>
              <li>Export your extraction and coffee data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl mb-3">8. Children's Privacy</h2>
            <p>
              This Service is not intended for users under the age of 13. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">9. International Users</h2>
            <p>
              Your data may be transferred to and processed in countries other than your country of residence. By using the Service, you consent to such transfers.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">10. Changes to Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl mb-3">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us through the application.
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