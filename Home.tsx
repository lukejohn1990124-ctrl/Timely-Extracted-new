import { ArrowRight, Shield, CheckCircle2 } from "lucide-react";
import { Link } from "react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@getmocha/users-service/react";

export default function HomePage() {
  const { user } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) {
      setMessage(`${params.get('connected')} connected successfully!`);
      window.history.replaceState({}, '', '/');
      setTimeout(() => setMessage(null), 5000);
    }
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#0A1929] text-white">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-2xl font-bold">Timely</h1>
            <nav className="hidden md:flex gap-6 text-sm">
              <a href="#pricing" className="hover:text-blue-400 transition">Pricing</a>
              <a href="#resources" className="hover:text-blue-400 transition">Resources</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <Link to="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm hover:text-blue-400 transition">Log In</Link>
                <Link to="/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition">
                  Start Free Trial
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          {message && (
            <div className="mb-6 p-4 rounded-lg border bg-green-50 border-green-200 text-green-800 inline-flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}
          <h2 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-blue-600">Meet Timely.</span>
            <br />
            Your tool to stop chasing payments
            <br />
            and get paid automatically.
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Connect your payment platform, set up smart reminders, and watch overdue invoices get paid — on autopilot.
          </p>
          {!user && (
            <>
              <Link to="/signup" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-medium inline-flex items-center gap-2 transition shadow-lg hover:shadow-xl">
                Try For Free <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-sm text-gray-500 mt-4">
                7 Day Free Trial • No credit card required • Cancel Anytime
              </p>
            </>
          )}
          {user && (
            <Link to="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-medium inline-flex items-center gap-2 transition shadow-lg hover:shadow-xl">
              Go to Dashboard <ArrowRight className="w-5 h-5" />
            </Link>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          {/* Feature 1 */}
          <div className="mb-20 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <p className="text-blue-600 text-sm font-semibold mb-2 uppercase tracking-wider">CATEGORY NAME</p>
              <h3 className="text-3xl font-bold mb-4">Title that describes the feature</h3>
              <p className="text-gray-600 leading-relaxed">
                More detailed description about the feature. More detailed description about the feature. More detailed description about the feature.
              </p>
            </div>
            <div className="flex-1 bg-gray-200 rounded-xl h-64 w-full"></div>
          </div>

          {/* Feature 2 */}
          <div className="mb-20 flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="flex-1">
              <p className="text-blue-600 text-sm font-semibold mb-2 uppercase tracking-wider">CATEGORY NAME</p>
              <h3 className="text-3xl font-bold mb-4">Title that describes the feature</h3>
              <p className="text-gray-600 leading-relaxed">
                More detailed description about the feature. More detailed description about the feature. More detailed description about the feature.
              </p>
            </div>
            <div className="flex-1 bg-gray-200 rounded-xl h-64 w-full"></div>
          </div>

          {/* Feature 3 */}
          <div className="mb-20 flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <p className="text-blue-600 text-sm font-semibold mb-2 uppercase tracking-wider">CATEGORY NAME</p>
              <h3 className="text-3xl font-bold mb-4">Title that describes the feature</h3>
              <p className="text-gray-600 leading-relaxed">
                More detailed description about the feature. More detailed description about the feature. More detailed description about the feature.
              </p>
            </div>
            <div className="flex-1 bg-gray-200 rounded-xl h-64 w-full"></div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-3xl font-bold mb-12">We'll help you save money, time and stress</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div className="bg-gray-100 p-6 rounded-lg text-left">
              <p className="text-2xl font-semibold text-gray-900 mb-1">60% less time</p>
              <p className="text-sm text-gray-600">spent working on reminders</p>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg text-left">
              <p className="text-2xl font-semibold text-gray-900 mb-1">60% less time</p>
              <p className="text-sm text-gray-600">spent working on reminders</p>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg text-left">
              <p className="text-2xl font-semibold text-gray-900 mb-1">60% less time</p>
              <p className="text-sm text-gray-600">spent working on reminders</p>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg text-left">
              <p className="text-2xl font-semibold text-gray-900 mb-1">60% less time</p>
              <p className="text-sm text-gray-600">spent working on reminders</p>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg text-left">
              <p className="text-2xl font-semibold text-gray-900 mb-1">60% less time</p>
              <p className="text-sm text-gray-600">spent working on reminders</p>
            </div>
            <div className="bg-gray-100 p-6 rounded-lg text-left">
              <p className="text-2xl font-semibold text-gray-900 mb-1">60% less time</p>
              <p className="text-sm text-gray-600">spent working on reminders</p>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-5xl">
          <div className="border-2 border-blue-600 rounded-3xl p-12 text-center">
            <h3 className="text-3xl font-bold mb-8">
              Connect Invoices
              <br />
              From The Platforms
              <br />
              You Are Already Using
            </h3>
            <div className="flex flex-wrap justify-center items-center gap-12">
              <div className="text-4xl font-bold text-blue-600">PayPal</div>
              <div className="text-4xl font-bold text-blue-600">stripe</div>
              <div className="text-3xl font-bold">Revolut</div>
              <div className="text-3xl font-bold">Wise</div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-6xl">
          <h3 className="text-3xl font-bold text-center mb-12">
            Built With Privacy and
            <br />
            Security in mind
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="text-center">
                <div className="bg-[#0A1929] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <h4 className="font-bold mb-2">Data and Storage</h4>
                <p className="text-sm text-gray-600 mb-4">
                  We protect your data and information by following all CCPA, GDPR and SOC-2 guidelines.
                </p>
                <a href="#" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
                  How we handle data <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-6 bg-white">
        <div className="container mx-auto max-w-3xl">
          <h3 className="text-3xl font-bold mb-8">
            Frequently
            <br />
            Asked
            <br />
            Questions
          </h3>
          <div className="space-y-0">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="border-b border-gray-200 py-6 flex items-center justify-between hover:bg-gray-50 transition cursor-pointer px-2">
                <span className="font-medium text-gray-900">This is a question about the tool feature?</span>
                <span className="text-2xl text-gray-400 font-light">+</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A1929] text-white py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="text-2xl font-bold mb-4">Timely</h4>
              <div className="flex gap-4">
                <a href="#" className="text-white hover:text-blue-400 transition">
                  <div className="w-8 h-8 bg-white rounded-full"></div>
                </a>
                <a href="#" className="text-white hover:text-blue-400 transition">
                  <div className="w-8 h-8 bg-white rounded-full"></div>
                </a>
                <a href="#" className="text-white hover:text-blue-400 transition">
                  <div className="w-8 h-8 bg-white rounded-full"></div>
                </a>
              </div>
            </div>
            <div>
              <h5 className="font-semibold mb-3">Company</h5>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white transition">About Us</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">Referral Program</a></li>
              </ul>
            </div>
            <div>
              <h5 className="font-semibold mb-3">Resources</h5>
              <ul className="space-y-2 text-sm text-gray-300">
                <li><a href="#" className="hover:text-white transition">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">Templates</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-700 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <div className="flex gap-6 mb-4 md:mb-0">
              <a href="#" className="hover:text-white transition">Terms Of Service</a>
              <a href="#" className="hover:text-white transition">Privacy Policy</a>
              <a href="#" className="hover:text-white transition">Cookie Policy</a>
              <a href="#" className="hover:text-white transition">Do Not Sell My Information (CCPA)</a>
            </div>
            <p>© 2025 PRA. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
