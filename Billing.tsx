import SettingsLayout from "@/react-app/components/SettingsLayout";
import { CheckCircle2, CreditCard, Download } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "$0",
    features: ["Up to 5 invoices/month", "Basic email templates", "Single integration", "Email support"],
    current: false
  },
  {
    name: "Pro",
    price: "$49",
    period: "/month",
    features: ["Unlimited invoices", "Custom email templates", "All integrations", "Priority support", "Advanced analytics"],
    current: true,
    popular: true
  },
  {
    name: "Team",
    price: "$99",
    period: "/month",
    features: ["Everything in Pro", "Multi-user access", "API access", "Dedicated support", "Custom branding"],
    current: false
  }
];

const invoices = [
  { id: "1", date: "Jan 1, 2025", amount: "$49.00", status: "Paid" },
  { id: "2", date: "Dec 1, 2024", amount: "$49.00", status: "Paid" },
  { id: "3", date: "Nov 1, 2024", amount: "$49.00", status: "Paid" },
];

export default function BillingPage() {
  return (
    <SettingsLayout>
      <div className="space-y-6">
        {/* Current Plan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Current Plan</h2>
          <div className="flex items-center justify-between p-5 bg-blue-50 border border-blue-200 rounded-lg">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-2xl font-bold text-gray-900">Pro Plan</h3>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                  Active
                </span>
              </div>
              <p className="text-gray-600">$49/month • Next billing: Feb 1, 2025</p>
            </div>
            <button className="text-sm text-gray-600 hover:text-gray-900 transition px-4 py-2 border border-gray-300 rounded-lg font-medium bg-white">
              Manage Subscription
            </button>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Usage This Month</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Invoices Tracked</p>
              <p className="text-2xl font-bold text-gray-900">127</p>
              <p className="text-xs text-gray-500 mt-1">Unlimited on Pro plan</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Reminders Sent</p>
              <p className="text-2xl font-bold text-gray-900">43</p>
              <p className="text-xs text-green-600 mt-1">85% delivery rate</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Payments Recovered</p>
              <p className="text-2xl font-bold text-gray-900">$3,247</p>
              <p className="text-xs text-green-600 mt-1">+12% from last month</p>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Payment Method</h2>
          <div className="flex items-center justify-between p-5 border border-gray-200 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Visa ending in 4242</p>
                <p className="text-sm text-gray-600">Expires 12/2026</p>
              </div>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 transition font-medium">
              Update
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Available Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`border rounded-lg p-6 ${
                  plan.current
                    ? "border-blue-600 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300"
                } transition relative`}
              >
                {plan.popular && (
                  <span className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">
                    Popular
                  </span>
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="text-gray-600">{plan.period}</span>}
                </div>
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.current ? (
                  <button className="w-full py-2.5 rounded-lg text-sm font-medium bg-gray-200 text-gray-500 cursor-not-allowed">
                    Current Plan
                  </button>
                ) : (
                  <button className="w-full py-2.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition">
                    {plan.name === "Free" ? "Downgrade" : "Upgrade"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Billing History */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Billing History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-gray-900">{invoice.date}</td>
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">{invoice.amount}</td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3" />
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="text-gray-400 hover:text-blue-600 transition">
                        <Download className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
